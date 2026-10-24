import { matchesMenuItemSlug } from "@/lib/menu-slug";
import type { MenuCategory, MenuItem, SiteMenu } from "@/types/site";

export type MenuItemRef = {
  item: MenuItem;
  category: MenuCategory;
};

export const findMenuItemBySlug = (
  menu: SiteMenu,
  slug: string,
): MenuItemRef | null => {
  const candidates: MenuItemRef[] = [];
  for (const category of menu.categories || []) {
    for (const item of category.items || []) {
      if (matchesMenuItemSlug(item, slug)) {
        candidates.push({ item, category });
      }
    }
  }
  if (!candidates.length) return null;
  // Prefer exact full-slug match if several share a short id tail.
  const exact = candidates.find(
    (row) =>
      matchesMenuItemSlug(row.item, slug) &&
      row.item.id.length >= 8,
  );
  return exact ?? candidates[0] ?? null;
};
