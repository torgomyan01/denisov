import type { MenuCategory, MenuItem, SiteMenu } from "@/types/site";

export type HomeFeaturedDish = MenuItem & {
  categoryId: string;
  categoryName: string;
  availableFrom: string;
  availableTo: string;
};

const PER_OTHER_CATEGORY = 2;

/** Homepage-only category — hidden on /menu, still used in the home slider. */
export const isBlyudaCategory = (name: string): boolean =>
  name.trim().toLowerCase() === "блюда";

const eligibleItems = (
  items: MenuItem[] | undefined,
  usedIds: Set<string>,
): MenuItem[] =>
  (items || []).filter(
    (it) =>
      Boolean(it?.id) &&
      !usedIds.has(it.id) &&
      Boolean(it.image?.trim()) &&
      Boolean(it.name?.trim()) &&
      it.inStock !== false &&
      it.showInDelivery !== false,
  );

/**
 * Homepage slider:
 * — all eligible items from «Блюда»
 * — then 1–2 from every other category
 */
export const getHomeFeaturedDishes = (
  menu: SiteMenu,
): HomeFeaturedDish[] => {
  const categories = (menu.categories || []).filter(
    (c) => c && (c.name || (c.items && c.items.length)),
  );
  const picked: HomeFeaturedDish[] = [];
  const usedIds = new Set<string>();

  const pushItem = (item: MenuItem, category: MenuCategory) => {
    if (!item?.id || usedIds.has(item.id)) return false;
    usedIds.add(item.id);
    picked.push({
      ...item,
      categoryId: category.id || "",
      categoryName: category.name || "",
      availableFrom: category.availableFrom || "",
      availableTo: category.availableTo || "",
    });
    return true;
  };

  const blyuda = categories.find((c) => isBlyudaCategory(c.name || ""));
  if (blyuda) {
    for (const item of eligibleItems(blyuda.items, usedIds)) {
      pushItem(item, blyuda);
    }
  }

  for (const category of categories) {
    if (isBlyudaCategory(category.name || "")) continue;
    const pool = eligibleItems(category.items, usedIds);
    for (const item of pool.slice(0, PER_OTHER_CATEGORY)) {
      pushItem(item, category);
    }
  }

  return picked;
};
