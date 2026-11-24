import {
  fetchIikoCatalog,
  type IikoCatalog,
  type IikoDefaultModifier,
} from "@/lib/iiko/menu";
import { prisma } from "@/lib/prisma";

const CACHE_ID = "main";

/** Freshness indicator for admin UI (cron runs every 10 min, allow 20 min window). */
const FRESH_WINDOW_MS = 20 * 60 * 1000;

/** Short process memory to avoid re-parsing JSON on every request while picking up cron DB updates fast. */
const MEMORY_TTL_MS = 30_000;

export type IikoCatalogSource = "cache" | "live";

export type IikoCatalogLoadResult =
  | {
      ok: true;
      catalog: IikoCatalog;
      source: IikoCatalogSource;
      fetchedAt: string;
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

const isFreshCache = (fetchedAt: Date, now = new Date()): boolean =>
  now.getTime() - fetchedAt.getTime() < FRESH_WINDOW_MS;

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

/**
 * iiko catalog backed by MySQL `IikoMenuCache`:
 * - Normal reads (`force: false`) serve from DB (populated by server cron `npm run iiko:sync-menu`).
 * - Cold start (empty DB) or `force: true` (cron / admin button) fetches live from iiko and saves to DB.
 */
export const getIikoCatalog = async (options?: {
  force?: boolean;
}): Promise<IikoCatalogLoadResult> => {
  const force = Boolean(options?.force);
  const now = new Date();

  if (!force) {
    const mem = fromMemory(now);
    if (mem?.ok) return mem;

    const cached = await readDbCache();
    if (cached) {
      memorySlot = {
        catalog: cached.catalog,
        fetchedAt: cached.fetchedAt,
        loadedAtMs: Date.now(),
      };
      return {
        ok: true,
        catalog: cached.catalog,
        source: "cache",
        fetchedAt: cached.fetchedAt.toISOString(),
        stale: !isFreshCache(cached.fetchedAt, now),
      };
    }

    // Cold start (no DB snapshot yet) — fetch once so the site still works.
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
