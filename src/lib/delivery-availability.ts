import type { MenuCategory } from "@/types/site";

const parseHm = (value: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

/**
 * Whether a menu category is within its delivery availability window.
 * Empty from/to = always available.
 */
export const isCategoryAvailableNow = (
  category: Pick<MenuCategory, "availableFrom" | "availableTo">,
  now: Date = new Date(),
): boolean => {
  const from = parseHm(category.availableFrom ?? "");
  const to = parseHm(category.availableTo ?? "");
  if (from == null && to == null) return true;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = from ?? 0;
  const end = to ?? 24 * 60 - 1;

  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  // Overnight window, e.g. 22:00–02:00
  return minutes >= start || minutes < end;
};

export const categoryAvailableFromLabel = (
  category: Pick<MenuCategory, "availableFrom">,
): string | null => {
  const from = category.availableFrom?.trim();
  return from || null;
};
