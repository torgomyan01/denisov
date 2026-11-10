import { getIikoConfig, isIikoConfigured } from "@/lib/iiko/config";
import { iikoRequest } from "@/lib/iiko/client";

/** One child option inside an iiko modifier group (external menu v3). */
export type IikoModifierOption = {
  productId: string;
  name: string;
  price: number;
};

export type IikoModifierGroup = {
  id: string;
  name: string;
  minQuantity: number;
  maxQuantity: number;
  options: IikoModifierOption[];
};

/** Default modifier lines to satisfy required groups (minQuantity ≥ 1). */
export type IikoDefaultModifier = {
  productId: string;
  productGroupId: string;
  amount: number;
  name: string;
};

export type IikoCatalogItem = {
  productId: string;
  menuItemId: string;
  name: string;
  description: string;
  price: number | null;
  weight: number | null;
  imageUrl: string;
  sku: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  modifierGroups: IikoModifierGroup[];
  /** Auto-picked modifiers so delivery create passes iiko minQuantity checks. */
  defaultModifiers: IikoDefaultModifier[];
  missing: {
    description: boolean;
    price: boolean;
    image: boolean;
  };
};

export type IikoCatalogCategory = {
  id: string;
  name: string;
  items: IikoCatalogItem[];
};

export type IikoCatalog = {
  menuId: string;
  menuName: string;
  categories: IikoCatalogCategory[];
  stats: {
    categories: number;
    items: number;
    withPrice: number;
    withImage: number;
    withDescription: number;
  };
};

type MenusResponse = {
  externalMenus?: Array<{ id: string | number; name?: string }>;
};

type MenuV3Modifier = {
  id?: string;
  name?: string;
  sizePrices?: Array<{ price?: number }>;
};

type MenuV3Response = {
  id?: string | number;
  name?: string;
  modifiers?: MenuV3Modifier[];
  itemsGroups?: Array<{
    id?: string;
    name?: string;
    items?: Array<{
      productId?: string;
      menuItemId?: string;
      name?: string;
      description?: string;
      buttonImageUrl?: string;
      sizePrices?: Array<{
        price?: number;
        weight?: number;
        sku?: string;
        buttonImageUrl?: string;
        isDefault?: boolean;
        nutritions?: {
          fats?: number;
          proteins?: number;
          carbs?: number;
          energy?: number;
        };
      }>;
      modifierGroups?: Array<{
        id?: string;
        name?: string;
        restrictions?: { minQuantity?: number; maxQuantity?: number };
        items?: Array<{ id?: string }>;
      }>;
    }>;
  }>;
};

const buildModifierGroups = (
  rawGroups: NonNullable<
    NonNullable<MenuV3Response["itemsGroups"]>[number]["items"]
  >[number]["modifierGroups"],
  modifierById: Map<string, MenuV3Modifier>,
): { groups: IikoModifierGroup[]; defaults: IikoDefaultModifier[] } => {
  const groups: IikoModifierGroup[] = [];
  const defaults: IikoDefaultModifier[] = [];

  for (const raw of rawGroups || []) {
    const groupId = String(raw.id || "").trim();
    if (!groupId) continue;
    const minQuantity = Math.max(0, Number(raw.restrictions?.minQuantity ?? 0) || 0);
    const maxRaw = Number(raw.restrictions?.maxQuantity);
    const maxQuantity = Math.max(
      minQuantity,
      Number.isFinite(maxRaw) ? maxRaw : minQuantity,
    );
    const options: IikoModifierOption[] = [];
    for (const child of raw.items || []) {
      const productId = String(child.id || "").trim();
      if (!productId) continue;
      const meta = modifierById.get(productId);
      const price =
        typeof meta?.sizePrices?.[0]?.price === "number" &&
        Number.isFinite(meta.sizePrices[0].price)
          ? meta.sizePrices[0].price
          : 0;
      options.push({
        productId,
        name: (meta?.name || productId).trim(),
        price,
      });
    }
    groups.push({
      id: groupId,
      name: (raw.name || "").trim() || "Модификатор",
      minQuantity,
      maxQuantity,
      options,
    });

    // Satisfy required groups: pick first options until minQuantity is met.
    for (let i = 0; i < minQuantity; i += 1) {
      const option = options[i] ?? options[0];
      if (!option) break;
      defaults.push({
        productId: option.productId,
        productGroupId: groupId,
        amount: 1,
        name: option.name,
      });
    }
  }

  return { groups, defaults };
};

const pickSize = (
  sizes: NonNullable<
    NonNullable<MenuV3Response["itemsGroups"]>[number]["items"]
  >[number]["sizePrices"],
) => {
  if (!sizes?.length) return null;
  return sizes.find((s) => s.isDefault) ?? sizes[0] ?? null;
};

export const fetchIikoCatalog = async (): Promise<
  | { ok: true; catalog: IikoCatalog }
  | { ok: false; error: string }
> => {
  const config = getIikoConfig();
  if (!isIikoConfigured(config)) {
    return { ok: false, error: "iiko не настроен (.env)" };
  }

  try {
    const menus = await iikoRequest<MenusResponse>("/api/2/menu", {}, config);
    const external = menus.externalMenus?.[0];
    if (!external?.id) {
      return { ok: false, error: "В iiko нет внешнего меню (externalMenus пуст)" };
    }

    const externalMenuId = String(external.id);
    const detail = await iikoRequest<MenuV3Response>(
      "/api/menu/v3/by_id",
      {
        externalMenuId,
        organizationId: config.organizationId,
      },
      config,
    );

    const modifierById = new Map<string, MenuV3Modifier>();
    for (const mod of detail.modifiers || []) {
      const id = String(mod.id || "").trim();
      if (id) modifierById.set(id, mod);
    }

    const categories: IikoCatalogCategory[] = (detail.itemsGroups || []).map(
      (group) => {
        const items: IikoCatalogItem[] = (group.items || []).map((raw) => {
          const size = pickSize(raw.sizePrices);
          const imageUrl = (
            size?.buttonImageUrl ||
            raw.buttonImageUrl ||
            ""
          ).trim();
          const description = (raw.description || "").trim();
          const price =
            typeof size?.price === "number" && Number.isFinite(size.price)
              ? size.price
              : null;
          const weight =
            typeof size?.weight === "number" && Number.isFinite(size.weight)
              ? size.weight
              : null;
          const nutritions = size?.nutritions;
          const numOrNull = (v: number | undefined): number | null =>
            typeof v === "number" && Number.isFinite(v) ? v : null;
          const { groups: modifierGroups, defaults: defaultModifiers } =
            buildModifierGroups(raw.modifierGroups, modifierById);

          return {
            productId: String(raw.productId || ""),
            menuItemId: String(raw.menuItemId || ""),
            name: (raw.name || "Без названия").trim(),
            description,
            price,
            weight,
            imageUrl,
            sku: String(size?.sku || "").trim(),
            kcal: numOrNull(nutritions?.energy),
            protein: numOrNull(nutritions?.proteins),
            fat: numOrNull(nutritions?.fats),
            carbs: numOrNull(nutritions?.carbs),
            modifierGroups,
            defaultModifiers,
            missing: {
              description: !description,
              price: price == null,
              image: !imageUrl,
            },
          };
        });

        return {
          id: String(group.id || group.name || ""),
          name: (group.name || "Без категории").trim(),
          items,
        };
      },
    );

    const flat = categories.flatMap((c) => c.items);
    return {
      ok: true,
      catalog: {
        menuId: externalMenuId,
        menuName: detail.name || external.name || "Меню",
        categories,
        stats: {
          categories: categories.length,
          items: flat.length,
          withPrice: flat.filter((i) => !i.missing.price).length,
          withImage: flat.filter((i) => !i.missing.image).length,
          withDescription: flat.filter((i) => !i.missing.description).length,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить меню iiko";
    return { ok: false, error: message };
  }
};
