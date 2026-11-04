import type { MenuCategory, MenuItem, SiteMenu } from "@/types/site";

export type HomeFeaturedDish = MenuItem & {
  categoryId: string;
  categoryName: string;
  availableFrom: string;
  availableTo: string;
};

const PER_CATEGORY = 2;

/** @deprecated kept for MenuPage filters that still import the name */
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
 * Homepage slider: prefer upsell items, then up to 2 imaged items per category.
 * (Works with iiko categories — no special «Блюда» bucket required.)
 */
export const getHomeFeaturedDishes = (
  menu: SiteMenu,
): HomeFeaturedDish[] => {
  const categories = (menu.categories || []).filter(
    (c) =>
      c &&
      c.showOnSite !== false &&
      (c.name || (c.items && c.items.length)),
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

  const upsell: Array<{ item: MenuItem; category: MenuCategory }> = [];
  for (const category of categories) {
    for (const item of category.items || []) {
      if (item.showInUpsell && eligibleItems([item], usedIds).length) {
        upsell.push({ item, category });
      }
    }
  }
  upsell.sort(
    (a, b) => (a.item.upsellSortOrder || 0) - (b.item.upsellSortOrder || 0),
  );
  for (const row of upsell) {
    pushItem(row.item, row.category);
  }

  for (const category of categories) {
    const pool = eligibleItems(category.items, usedIds);
    for (const item of pool.slice(0, PER_CATEGORY)) {
      pushItem(item, category);
    }
  }

  return picked;
};
