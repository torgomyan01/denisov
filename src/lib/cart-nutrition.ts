import type { CartLine } from "@/store/cartSlice";
import type { MenuItem, SiteMenu } from "@/types/site";

export type CartNutritionTotals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** True if at least one line had any nutrient value. */
  hasAny: boolean;
};

const asFinite = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Build id → menu item map for nutrition lookup. */
export const menuItemNutritionIndex = (
  menu: SiteMenu,
): Map<string, Pick<MenuItem, "kcal" | "protein" | "fat" | "carbs">> => {
  const map = new Map<
    string,
    Pick<MenuItem, "kcal" | "protein" | "fat" | "carbs">
  >();
  for (const category of menu.categories || []) {
    for (const item of category.items || []) {
      if (!item?.id) continue;
      map.set(item.id, {
        kcal: item.kcal ?? null,
        protein: item.protein ?? null,
        fat: item.fat ?? null,
        carbs: item.carbs ?? null,
      });
    }
  }
  return map;
};

/**
 * Sum КБЖУ across cart lines × qty using values from menu cards
 * (same numbers as on the product page).
 */
export const cartNutritionTotals = (
  items: CartLine[],
  menu: SiteMenu,
): CartNutritionTotals => {
  const index = menuItemNutritionIndex(menu);
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let hasAny = false;

  for (const line of items) {
    const row = index.get(line.id);
    if (!row) continue;
    const qty = Math.max(1, line.qty);

    const k = asFinite(row.kcal);
    const p = asFinite(row.protein);
    const f = asFinite(row.fat);
    const c = asFinite(row.carbs);

    if (k != null) {
      hasAny = true;
      kcal += k * qty;
    }
    if (p != null) {
      hasAny = true;
      protein += p * qty;
    }
    if (f != null) {
      hasAny = true;
      fat += f * qty;
    }
    if (c != null) {
      hasAny = true;
      carbs += c * qty;
    }
  }

  return {
    kcal: Math.round(kcal),
    protein: round1(protein),
    fat: round1(fat),
    carbs: round1(carbs),
    hasAny,
  };
};

export const formatCartNutritionLine = (
  totals: CartNutritionTotals,
): string => {
  if (!totals.hasAny) return "";
  const parts: string[] = [];
  if (totals.kcal > 0 || totals.hasAny) {
    parts.push(`~${totals.kcal} ккал`);
  }
  parts.push(`Б ${totals.protein}`);
  parts.push(`Ж ${totals.fat}`);
  parts.push(`У ${totals.carbs}`);
  return parts.join(" · ");
};
