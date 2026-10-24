import type { CartLine, CartProduct } from "@/store/cartSlice";
import type { MenuCategory, SiteMenu } from "@/types/site";

export type CartSuggestionsResult = {
  products: CartProduct[];
  /** Short label under kicker, e.g. «К завтраку» */
  title: string;
  kicker: string;
};

type ItemRole =
  | "breakfast"
  | "salad"
  | "soup"
  | "main"
  | "bakery"
  | "dessert"
  | "hot_drink"
  | "cold_drink"
  | "other";

type ScoredProduct = CartProduct & {
  role: ItemRole;
  score: number;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const ROLE_CATEGORY_RULES: Array<{ role: ItemRole; patterns: RegExp[] }> = [
  {
    role: "breakfast",
    patterns: [/завтрак/, /завтраки/, /breakfast/, /утром/, /brunch/],
  },
  {
    role: "salad",
    patterns: [/закуск/, /салат/, /холодн/, /стартер/, /snack/],
  },
  {
    role: "soup",
    patterns: [/суп/, /бульон/, /щи/, /борщ/, /soup/],
  },
  {
    role: "main",
    patterns: [
      /основн/,
      /горяч/,
      /второе/,
      /блюда/,
      /мясо/,
      /рыба/,
      /паста/,
      /main/,
    ],
  },
  {
    role: "bakery",
    patterns: [/выпечк/, /пирож/, /пирог/, /хлеб/, /булоч/, /сдоб/, /bakery/],
  },
  {
    role: "dessert",
    patterns: [/десерт/, /сладк/, /торт/, /пирожен/, /мороженое/, /dessert/],
  },
  {
    role: "hot_drink",
    patterns: [/чай/, /кофе/, /какао/, /горяч.*напит/, /tea/, /coffee/],
  },
  {
    role: "cold_drink",
    patterns: [
      /напитк/,
      /сок/,
      /лимонад/,
      /морс/,
      /вода/,
      /смузи/,
      /drink/,
    ],
  },
];

const ROLE_ITEM_RULES: Array<{ role: ItemRole; patterns: RegExp[] }> = [
  {
    role: "hot_drink",
    patterns: [
      /\bчай\b/,
      /кофе/,
      /капучино/,
      /латте/,
      /американо/,
      /эспр/,
      /какао/,
      /матча/,
    ],
  },
  {
    role: "cold_drink",
    patterns: [/сок\b/, /лимонад/, /морс/, /смузи/, /компот/, /вода\b/, /айран/],
  },
  {
    role: "dessert",
    patterns: [/торт/, /чизкейк/, /тирамису/, /мороженое/, /брауни/, /эклер/],
  },
  {
    role: "bakery",
    patterns: [/пирожок/, /пирог/, /булоч/, /круассан/, /слойк/, /хачапур/],
  },
  {
    role: "soup",
    patterns: [/\bщи\b/, /борщ/, /суп\b/, /бульон/, /солянка/, /харчо/],
  },
  {
    role: "salad",
    patterns: [/салат/, /закуск/, /мимоза/, /огурц/, /холодец/],
  },
  {
    role: "breakfast",
    patterns: [
      /скрембл/,
      /омлет/,
      /яичниц/,
      /каша/,
      /драник/,
      /пашот/,
      /крок.?месье/,
      /сырник/,
      /блин/,
    ],
  },
];

/** What pairs well with what is already in the cart (priority order). */
const PAIRINGS: Record<ItemRole, ItemRole[]> = {
  breakfast: ["hot_drink", "bakery", "cold_drink", "salad", "dessert"],
  salad: ["soup", "main", "bakery", "cold_drink", "hot_drink"],
  soup: ["bakery", "main", "salad", "cold_drink", "hot_drink"],
  main: ["salad", "soup", "bakery", "cold_drink", "hot_drink", "dessert"],
  bakery: ["hot_drink", "cold_drink", "breakfast", "soup", "dessert"],
  dessert: ["hot_drink", "cold_drink", "bakery"],
  hot_drink: ["bakery", "dessert", "breakfast", "salad"],
  cold_drink: ["bakery", "salad", "main", "dessert"],
  other: ["bakery", "hot_drink", "salad", "soup", "dessert"],
};

const ROLE_COPY: Partial<
  Record<ItemRole, { kicker: string; title: string }>
> = {
  breakfast: { kicker: "К завтраку", title: "Дополнит утро" },
  salad: { kicker: "К закускам", title: "Хорошо рядом" },
  soup: { kicker: "К супу", title: "С чем подать" },
  main: { kicker: "К основному", title: "Дополните стол" },
  bakery: { kicker: "К выпечке", title: "Что взять ещё" },
  dessert: { kicker: "К десерту", title: "Сладкая пара" },
  hot_drink: { kicker: "К чаю и кофе", title: "Что взять с напитком" },
  cold_drink: { kicker: "К напитку", title: "Может подойти" },
};

const matchRole = (
  text: string,
  rules: Array<{ role: ItemRole; patterns: RegExp[] }>,
): ItemRole | null => {
  const n = normalize(text);
  if (!n) return null;
  for (const rule of rules) {
    if (rule.patterns.some((re) => re.test(n))) return rule.role;
  }
  return null;
};

const roleForCategory = (categoryName: string): ItemRole =>
  matchRole(categoryName, ROLE_CATEGORY_RULES) ?? "other";

const roleForItem = (
  itemName: string,
  categoryName: string,
): ItemRole =>
  matchRole(itemName, ROLE_ITEM_RULES) ??
  matchRole(categoryName, ROLE_CATEGORY_RULES) ??
  "other";

const dayPartBoost = (role: ItemRole, hour: number): number => {
  // Morning: breakfast + hot drinks + bakery
  if (hour >= 6 && hour < 11) {
    if (role === "breakfast" || role === "hot_drink" || role === "bakery")
      return 3;
    if (role === "cold_drink") return 1;
  }
  // Lunch: soup / salad / main
  if (hour >= 11 && hour < 16) {
    if (role === "soup" || role === "salad" || role === "main") return 3;
    if (role === "bakery" || role === "cold_drink") return 2;
  }
  // Afternoon tea window
  if (hour >= 16 && hour < 19) {
    if (role === "hot_drink" || role === "bakery" || role === "dessert")
      return 3;
  }
  // Evening: mains + drinks
  if (hour >= 19 || hour < 6) {
    if (role === "main" || role === "salad" || role === "cold_drink") return 2;
    if (role === "dessert" || role === "hot_drink") return 1;
  }
  return 0;
};

const dominantCartRole = (
  cartItems: CartLine[],
): { role: ItemRole; counts: Map<ItemRole, number> } => {
  const counts = new Map<ItemRole, number>();
  for (const line of cartItems) {
    const role = roleForItem(line.name, line.categoryName);
    counts.set(role, (counts.get(role) ?? 0) + line.qty);
  }
  let best: ItemRole = "other";
  let bestQty = -1;
  for (const [role, qty] of counts) {
    if (qty > bestQty) {
      best = role;
      bestQty = qty;
    }
  }
  return { role: best, counts };
};

const toProduct = (
  item: { id: string; name: string; price: string; image: string },
  category: MenuCategory,
): CartProduct | null => {
  if (!item.id || !item.name?.trim()) return null;
  return {
    id: item.id,
    name: item.name,
    price: item.price ?? "",
    image: item.image ?? "",
    categoryId: category.id,
    categoryName: category.name,
  };
};

/**
 * Suggest add-ons that complement what is already in the cart
 * (breakfast → drinks/bakery, mains → salad/soup, tea → pastry, etc.).
 */
export const getSuggestedProducts = (
  menu: SiteMenu,
  cartItems: CartLine[],
  limit = 6,
  now: Date = new Date(),
): CartSuggestionsResult => {
  const empty: CartSuggestionsResult = {
    products: [],
    title: "Может подойти",
    kicker: "К вашему заказу",
  };

  if (!cartItems.length || !menu.categories?.length) return empty;

  const inCart = new Set(cartItems.map((line) => line.id));

  // Admin-curated upsell takes priority over heuristics.
  const curated: Array<CartProduct & { order: number }> = [];
  for (const category of menu.categories) {
    for (const item of category.items || []) {
      if (
        !item.showInUpsell ||
        item.inStock === false ||
        item.showInDelivery === false
      )
        continue;
      if (inCart.has(item.id)) continue;
      const product = toProduct(item, category);
      if (!product) continue;
      curated.push({
        ...product,
        order: item.upsellSortOrder ?? 0,
      });
    }
  }
  if (curated.length) {
    curated.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ru"));
    return {
      products: curated.slice(0, limit).map(({ order: _order, ...p }) => p),
      title: "Добавить к заказу",
      kicker: "Допродажа",
    };
  }

  const { role: focusRole, counts } = dominantCartRole(cartItems);
  const wanted = PAIRINGS[focusRole] ?? PAIRINGS.other;
  const hour = now.getHours();
  const copy = ROLE_COPY[focusRole] ?? empty;

  const scored: ScoredProduct[] = [];

  for (const category of menu.categories) {
    const categoryRole = roleForCategory(category.name);
    for (const item of category.items || []) {
      if (item.inStock === false || item.showInDelivery === false) continue;
      const product = toProduct(item, category);
      if (!product || inCart.has(product.id)) continue;

      const role = roleForItem(item.name, category.name);
      // Prefer complementary roles; same-role only as weak filler
      const pairIndex = wanted.indexOf(role);
      const isComplement = pairIndex >= 0;
      const alreadyHaveRole = counts.get(role) ?? 0;

      let score = 0;
      if (isComplement) {
        score += 40 - pairIndex * 5;
      } else if (role === focusRole) {
        // Same category upsell is low priority (more of the same)
        score += 4;
      } else if (categoryRole !== "other" && wanted.includes(categoryRole)) {
        score += 12;
      } else {
        score += 1;
      }

      // Soft cap: if cart already has this role, push others first
      if (alreadyHaveRole >= 2) score -= 15;
      else if (alreadyHaveRole >= 1) score -= 6;

      score += dayPartBoost(role, hour);

      // Tiny stable tie-break from id so order is not jumpy
      score += (product.id.charCodeAt(0) % 7) * 0.01;

      scored.push({ ...product, role, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Diversify: avoid flooding with one role
  const roleSeen = new Map<ItemRole, number>();
  const picked: CartProduct[] = [];
  for (const row of scored) {
    const used = roleSeen.get(row.role) ?? 0;
    if (used >= 2 && picked.length < limit - 1) continue;
    roleSeen.set(row.role, used + 1);
    picked.push({
      id: row.id,
      name: row.name,
      price: row.price,
      image: row.image,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
    });
    if (picked.length >= limit) break;
  }

  // Fill if diversity filter left gaps
  if (picked.length < limit) {
    const pickedIds = new Set(picked.map((p) => p.id));
    for (const row of scored) {
      if (pickedIds.has(row.id)) continue;
      picked.push({
        id: row.id,
        name: row.name,
        price: row.price,
        image: row.image,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
      });
      if (picked.length >= limit) break;
    }
  }

  return {
    products: picked,
    title: copy.title,
    kicker: copy.kicker,
  };
};

/**
 * Related dishes for a product page: same category first, then complementary.
 */
export const getRelatedMenuProducts = (
  menu: SiteMenu,
  current: { id: string; name: string; categoryId: string; categoryName: string },
  limit = 8,
): CartProduct[] => {
  if (!menu.categories?.length) return [];

  const exclude = new Set([current.id]);
  const focusRole = roleForItem(current.name, current.categoryName);
  const wanted = PAIRINGS[focusRole] ?? PAIRINGS.other;
  const scored: ScoredProduct[] = [];

  for (const category of menu.categories) {
    for (const item of category.items || []) {
      if (
        exclude.has(item.id) ||
        item.inStock === false ||
        item.showInDelivery === false
      ) {
        continue;
      }
      const product = toProduct(item, category);
      if (!product) continue;

      const role = roleForItem(item.name, category.name);
      let score = 0;
      if (category.id === current.categoryId) score += 50;
      const pairIndex = wanted.indexOf(role);
      if (pairIndex >= 0) score += 30 - pairIndex * 4;
      else if (role === focusRole) score += 8;
      else score += 2;
      if (item.showInUpsell) score += 15 - Math.min(item.upsellSortOrder ?? 0, 10);
      score += (product.id.charCodeAt(0) % 7) * 0.01;
      scored.push({ ...product, role, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ role: _r, score: _s, ...p }) => p);
};
