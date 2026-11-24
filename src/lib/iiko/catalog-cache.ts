import { revalidatePath } from "next/cache";
import {
  fetchIikoCatalog,
  type IikoCatalog,
  type IikoDefaultModifier,
} from "@/lib/iiko/menu";
import { prisma } from "@/lib/prisma";

const CACHE_ID = "main";

const resolveTtlMs = (): number => {
  const raw = Number(process.env.IIKO_MENU_CACHE_MINUTES);
  const minutes = Number.isFinite(raw) && raw >= 1 && raw <= 1440 ? raw : 5;
  return Math.round(minutes * 60 * 1000);
};

/** Short process memory to avoid re-parsing JSON on every request. */
const MEMORY_TTL_MS = 60_000;

export type IikoCatalogSource = "cache" | "live";

export type IikoCatalogLoadResult =
  | {
      ok: true;
      catalog: IikoCatalog;
      source: IikoCatalogSource;
      fetchedAt: string;
      /** Served from cache while a background refresh runs or failed. */
      stale: boolean;
    }
  | { ok: false; error: string };

export type IikoCatalogCacheMeta = {
  hasCache: boolean;
  fetchedAt: string | null;
  isFresh: boolean;
  menuId: string;
  menuName: string;
  categories: number;
  items: number;
};

type MemorySlot = {
  catalog: IikoCatalog;
  fetchedAt: Date;
  loadedAtMs: number;
};

let memorySlot: MemorySlot | null = null;
let backgroundRefresh: Promise<void> | null = null;

const isFreshCache = (fetchedAt: Date, now = new Date()): boolean =>
  now.getTime() - fetchedAt.getTime() < resolveTtlMs();

const parseCatalog = (json: string): IikoCatalog | null => {
  try {
    const parsed = JSON.parse(json) as IikoCatalog;
    if (!parsed || !Array.isArray(parsed.categories)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const readDbCache = async (): Promise<{
  catalog: IikoCatalog;
  fetchedAt: Date;
  menuId: string;
  menuName: string;
} | null> => {
  try {
    const row = await prisma.iikoMenuCache.findUnique({
      where: { id: CACHE_ID },
    });
    if (!row?.payloadJson) return null;
    const catalog = parseCatalog(row.payloadJson);
    if (!catalog) return null;
    return {
      catalog,
      fetchedAt: row.fetchedAt,
      menuId: row.menuId,
      menuName: row.menuName,
    };
  } catch {
    // Table may be missing until prisma db push.
    return null;
  }
};

const writeDbCache = async (catalog: IikoCatalog, fetchedAt: Date) => {
  const payloadJson = JSON.stringify(catalog);
  await prisma.iikoMenuCache.upsert({
    where: { id: CACHE_ID },
    create: {
      id: CACHE_ID,
      menuId: catalog.menuId,
      menuName: catalog.menuName,
      payloadJson,
      fetchedAt,
    },
    update: {
      menuId: catalog.menuId,
      menuName: catalog.menuName,
      payloadJson,
      fetchedAt,
    },
  });
  memorySlot = {
    catalog,
    fetchedAt,
    loadedAtMs: Date.now(),
  };
};

const fromMemory = (now = new Date()): IikoCatalogLoadResult | null => {
  if (!memorySlot) return null;
  if (Date.now() - memorySlot.loadedAtMs > MEMORY_TTL_MS) return null;
  return {
    ok: true,
    catalog: memorySlot.catalog,
    source: "cache",
    fetchedAt: memorySlot.fetchedAt.toISOString(),
    stale: !isFreshCache(memorySlot.fetchedAt, now),
  };
};

/** Single deduplicated background refresh so visitors never wait on iiko. */
const triggerBackgroundRefresh = (): void => {
  if (backgroundRefresh) return;

  const run = async () => {
    try {
      const live = await fetchIikoCatalog();
      if (!live.ok) return;
      const fetchedAt = new Date();
      try {
        await writeDbCache(live.catalog, fetchedAt);
      } catch {
        memorySlot = {
          catalog: live.catalog,
          fetchedAt,
          loadedAtMs: Date.now(),
        };
      }
      try {
        revalidatePath("/");
        revalidatePath("/menu");
      } catch {
        /* outside request context — memory/DB already updated */
      }
    } finally {
      backgroundRefresh = null;
    }
  };

  backgroundRefresh = (async () => {
    try {
      const { after } = await import("next/server");
      after(() => {
        void run();
      });
    } catch {
      await run();
    }
  })();
};

/**
 * iiko catalog with Stale-While-Revalidate cache (default 5 min TTL):
 * - Fresh cache → serve immediately (0ms iiko wait).
 * - Stale cache → serve immediately AND refresh from iiko in the background.
 * - Empty cache / force: true → fetch live directly, save, return.
 */
export const getIikoCatalog = async (options?: {
  force?: boolean;
}): Promise<IikoCatalogLoadResult> => {
  const force = Boolean(options?.force);
  const now = new Date();

  if (!force) {
    const mem = fromMemory(now);
    if (mem?.ok) {
      if (mem.stale) triggerBackgroundRefresh();
      return mem;
    }

    const cached = await readDbCache();
    if (cached) {
      memorySlot = {
        catalog: cached.catalog,
        fetchedAt: cached.fetchedAt,
        loadedAtMs: Date.now(),
      };
      const fresh = isFreshCache(cached.fetchedAt, now);
      if (!fresh) {
        triggerBackgroundRefresh();
      }
      return {
        ok: true,
        catalog: cached.catalog,
        source: "cache",
        fetchedAt: cached.fetchedAt.toISOString(),
        stale: !fresh,
      };
    }

    // Cold start (no DB cache yet) — fetch synchronously once.
    const live = await fetchIikoCatalog();
    if (live.ok) {
      try {
        await writeDbCache(live.catalog, now);
      } catch {
        memorySlot = {
          catalog: live.catalog,
          fetchedAt: now,
          loadedAtMs: Date.now(),
        };
      }
      return {
        ok: true,
        catalog: live.catalog,
        source: "live",
        fetchedAt: now.toISOString(),
        stale: false,
      };
    }

    return { ok: false, error: live.error };
  }

  const live = await fetchIikoCatalog();
  if (!live.ok) {
    const cached = await readDbCache();
    if (cached) {
      return {
        ok: false,
        error: `${live.error} (локальный кэш сохранён: ${cached.fetchedAt.toISOString()})`,
      };
    }
    return live;
  }

  try {
    await writeDbCache(live.catalog, now);
  } catch {
    memorySlot = {
      catalog: live.catalog,
      fetchedAt: now,
      loadedAtMs: Date.now(),
    };
  }

  return {
    ok: true,
    catalog: live.catalog,
    source: "live",
    fetchedAt: now.toISOString(),
    stale: false,
  };
};

export const getIikoCatalogCacheMeta = async (): Promise<IikoCatalogCacheMeta> => {
  const cached = await readDbCache();
  if (!cached) {
    return {
      hasCache: false,
      fetchedAt: null,
      isFresh: false,
      menuId: "",
      menuName: "",
      categories: 0,
      items: 0,
    };
  }
  return {
    hasCache: true,
    fetchedAt: cached.fetchedAt.toISOString(),
    isFresh: isFreshCache(cached.fetchedAt),
    menuId: cached.menuId,
    menuName: cached.menuName,
    categories:
      cached.catalog.stats?.categories ?? cached.catalog.categories.length,
    items:
      cached.catalog.stats?.items ??
      cached.catalog.categories.reduce((n, c) => n + c.items.length, 0),
  };
};

/** Default modifiers map from the catalog cache (for order create). */
export const loadIikoDefaultModifiersByProductId = async (): Promise<
  Map<string, IikoDefaultModifier[]>
> => {
  const result = await getIikoCatalog();
  const map = new Map<string, IikoDefaultModifier[]>();
  if (!result.ok) return map;
  for (const category of result.catalog.categories) {
    for (const item of category.items) {
      if (item.productId && item.defaultModifiers.length) {
        map.set(item.productId, item.defaultModifiers);
      }
    }
  }
  return map;
};
