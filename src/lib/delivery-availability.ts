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

export type CategorySchedulePhase = "open" | "before" | "after";

type ScheduleCategory = Pick<MenuCategory, "availableFrom" | "availableTo">;

/**
 * Where "now" sits relative to the category delivery window.
 * Empty from/to = always open. Overnight windows treat the midday gap as "before"
 * the next opening (so we still say «Доступно с …»).
 */
export const getCategorySchedulePhase = (
  category: ScheduleCategory,
  now: Date = new Date(),
): CategorySchedulePhase => {
  const from = parseHm(category.availableFrom ?? "");
  const to = parseHm(category.availableTo ?? "");
  if (from == null && to == null) return "open";

  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = from ?? 0;
  const end = to ?? 24 * 60 - 1;

  if (start === end) return "open";

  if (start < end) {
    if (minutes < start) return "before";
    if (minutes >= end) return "after";
    return "open";
  }

  // Overnight window, e.g. 22:00–02:00
  if (minutes >= start || minutes < end) return "open";
  return "before";
};

/**
 * Whether a menu category is within its delivery availability window.
 * Empty from/to = always available.
 */
export const isCategoryAvailableNow = (
  category: ScheduleCategory,
  now: Date = new Date(),
): boolean => getCategorySchedulePhase(category, now) === "open";

export const categoryAvailableFromLabel = (
  category: Pick<MenuCategory, "availableFrom">,
): string | null => {
  const from = category.availableFrom?.trim();
  return from || null;
};

export const categoryAvailableToLabel = (
  category: Pick<MenuCategory, "availableTo">,
): string | null => {
  const to = category.availableTo?.trim();
  return to || null;
};

/** Short RU copy when the category window is closed. */
export const categoryUnavailableMessage = (
  category: ScheduleCategory,
  now: Date = new Date(),
): string => {
  const phase = getCategorySchedulePhase(category, now);
  const fromLabel = categoryAvailableFromLabel(category);
  const toLabel = categoryAvailableToLabel(category);

  if (phase === "after") {
    return toLabel
      ? `Время до ${toLabel} закончилось`
      : "Время категории закончилось";
  }

  if (phase === "before" && fromLabel) {
    return `Доступно с ${fromLabel}`;
  }

  return "Сейчас недоступно";
};
