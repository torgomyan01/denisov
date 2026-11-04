import {
  createDefaultMenuCategory,
  createDefaultMenuItem,
} from "@/lib/delivery-defaults";
import { fetchIikoCatalog, type IikoCatalog } from "@/lib/iiko/menu";
import { prisma } from "@/lib/prisma";
import type { MenuCategory, MenuItem, SiteMenu } from "@/types/site";

export type IikoMenuLoadResult = {
  categories: SiteMenu["categories"];
  catalog: IikoCatalog | null;
  error: string | null;
};

const formatIikoPrice = (price: number | null): string => {
  if (price == null || !Number.isFinite(price)) return "";
  return Number.isInteger(price) ? String(price) : String(price);
};

const formatIikoWeight = (weight: number | null): string => {
  if (weight == null || !Number.isFinite(weight) || weight <= 0) return "";
  return `${Math.round(weight)} г`;
};

type OverrideRow = {
  iikoProductId: string;
  name: string;
  description: string;
  price: string;
  image: string;
  weight: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  showInDelivery: boolean;
  inStock: boolean;
  showInUpsell: boolean;
  upsellSortOrder: number;
};

const mergeItem = (
  catalogItem: IikoCatalog["categories"][number]["items"][number],
  override: OverrideRow | undefined,
): MenuItem =>
  createDefaultMenuItem({
    id: catalogItem.productId,
    name: override?.name.trim() || catalogItem.name,
    description: override?.description.trim() || catalogItem.description,
    price: override?.price.trim() || formatIikoPrice(catalogItem.price),
    image: override?.image.trim() || catalogItem.imageUrl,
    weight: override?.weight.trim() || formatIikoWeight(catalogItem.weight),
    kcal: override?.kcal ?? catalogItem.kcal,
    protein: override?.protein ?? catalogItem.protein,
    fat: override?.fat ?? catalogItem.fat,
    carbs: override?.carbs ?? catalogItem.carbs,
    showInDelivery: override ? override.showInDelivery : true,
    inStock: override ? override.inStock : true,
    showInUpsell: override ? override.showInUpsell : false,
    upsellSortOrder: override ? override.upsellSortOrder : 0,
    iikoProductId: catalogItem.productId,
    modifierGroups: (catalogItem.modifierGroups || []).map((group) => ({
      id: group.id,
      name: group.name,
      minQuantity: group.minQuantity,
      maxQuantity: group.maxQuantity,
      options: group.options.map((opt) => ({
        productId: opt.productId,
        name: opt.name,
        price: opt.price,
      })),
    })),
  });

export const loadMergedIikoMenu = async (): Promise<IikoMenuLoadResult> => {
  const fetched = await fetchIikoCatalog();
  if (!fetched.ok) {
    return { categories: [], catalog: null, error: fetched.error };
  }

  const [itemOverrides, categoryOverrides] = await Promise.all([
    prisma.iikoMenuOverride.findMany(),
    prisma.iikoCategoryOverride.findMany(),
  ]);
  const byProductId = new Map(
    itemOverrides.map((row) => [row.iikoProductId, row]),
  );
  const byCategoryId = new Map(
    categoryOverrides.map((row) => [row.iikoCategoryId, row]),
  );

  const withSort = fetched.catalog.categories.map((group, index) => {
    const catId = group.id || group.name;
    const catOv = byCategoryId.get(catId);
    const category: MenuCategory & { _sort: number } = {
      ...createDefaultMenuCategory({
        id: catId,
        name: group.name,
        availableFrom: "",
        availableTo: "",
        showOnSite: catOv ? catOv.showOnSite : true,
        items: group.items.map((raw) =>
          mergeItem(raw, byProductId.get(raw.productId)),
        ),
      }),
      _sort: catOv?.sortOrder ?? index,
    };
    return category;
  });

  withSort.sort((a, b) => a._sort - b._sort || a.name.localeCompare(b.name, "ru"));

  const categories: MenuCategory[] = withSort.map(({ _sort: _, ...cat }) => cat);

  return { categories, catalog: fetched.catalog, error: null };
};
