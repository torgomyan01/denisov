import { moscowDayKey } from "@/lib/admin-analytics";
import {
  fetchIikoCatalog,
  type IikoCatalog,
  type IikoDefaultModifier,
} from "@/lib/iiko/menu";
import { prisma } from "@/lib/prisma";

const CACHE_ID = "main";

export type IikoCatalogSource = "cache" | "live";

export type IikoCatalogLoadResult =
  | {
      ok: true;
      catalog: IikoCatalog;
      source: IikoCatalogSource;
      fetchedAt: string;
      /** Served from DB while a live refresh failed. */
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

/** Short process memory to avoid re-parsing JSON on every request. */
let memorySlot: MemorySlot | null = null;
const MEMORY_TTL_MS = 60_000;

const isFreshForToday = (fetchedAt: Date, now = new Date()): boolean =>
  moscowDayKey(fetchedAt) === moscowDayKey(now);

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

const fromMemory = (
  now = new Date(),
): IikoCatalogLoadResult | null => {
  if (!memorySlot) return null;
  if (Date.now() - memorySlot.loadedAtMs > MEMORY_TTL_MS) return null;
  return {
    ok: true,
    catalog: memorySlot.catalog,
    source: "cache",
    fetchedAt: memorySlot.fetchedAt.toISOString(),
    stale: !isFreshForToday(memorySlot.fetchedAt, now),
  };
};

/**
 * iiko catalog with daily DB cache.
 * - Same Moscow calendar day → serve cache (no iiko call).
 * - New day / empty → fetch live, save, return.
 * - Live fail + any cache → serve stale cache (site stays up).
 */
export const getIikoCatalog = async (options?: {
  force?: boolean;
}): Promise<IikoCatalogLoadResult> => {
  const force = Boolean(options?.force);
  const now = new Date();

  if (!force) {
    const mem = fromMemory(now);
    if (mem?.ok && !mem.stale) return mem;

    const cached = await readDbCache();
    if (cached && isFreshForToday(cached.fetchedAt, now)) {
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
        stale: false,
      };
    }

    // Keep stale cache ready if live refresh fails.
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
        stale: true,
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
    isFresh: isFreshForToday(cached.fetchedAt),
    menuId: cached.menuId,
    menuName: cached.menuName,
    categories: cached.catalog.stats?.categories ?? cached.catalog.categories.length,
    items:
      cached.catalog.stats?.items ??
      cached.catalog.categories.reduce((n, c) => n + c.items.length, 0),
  };
};

/** Default modifiers map from the daily catalog cache (for order create). */
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
