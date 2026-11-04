import type {
  FulfillmentMode,
  PickupTimeMode,
} from "@/lib/cart-fulfillment";
import { buildCartLineKey } from "@/lib/menu-modifiers";
import { prisma } from "@/lib/prisma";
import type { CartLine, CartModifier, PersistedCart } from "@/store/cartSlice";

export const emptyCustomerCart = (): PersistedCart => ({
  items: [],
  utensils: 0,
  comment: "",
  fulfillmentMode: "pickup",
  pickupPointId: null,
  deliveryAddress: "",
  deliveryLat: null,
  deliveryLng: null,
  timeMode: "asap",
  scheduledAt: null,
});

/** After checkout: drop items, keep last pickup / delivery selection. */
export const clearCartItemsKeepingFulfillment = (
  cart: PersistedCart,
): PersistedCart => ({
  ...cart,
  items: [],
  utensils: 0,
  comment: "",
  timeMode: "asap",
  scheduledAt: null,
});

const parseModifiersJson = (raw: string | null | undefined): CartModifier[] => {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CartModifier[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      const groupId = typeof r.groupId === "string" ? r.groupId : "";
      if (!productId || !groupId) continue;
      out.push({
        groupId,
        groupName: typeof r.groupName === "string" ? r.groupName : "",
        productId,
        name: typeof r.name === "string" ? r.name : "",
        amount:
          typeof r.amount === "number" && Number.isFinite(r.amount)
            ? Math.max(1, Math.min(99, Math.round(r.amount)))
            : 1,
      });
    }
    return out;
  } catch {
    return [];
  }
};

const toPersisted = (row: {
  utensils: number;
  comment: string;
  fulfillmentMode: FulfillmentMode;
  pickupPointId: string | null;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: string;
  scheduledAt: Date | null;
  items: Array<{
    productId: string;
    lineKey?: string | null;
    name: string;
    price: string;
    image: string;
    categoryId: string;
    categoryName: string;
    qty: number;
    modifiersJson?: string | null;
  }>;
}): PersistedCart => ({
  utensils: Math.max(0, Math.min(20, row.utensils)),
  comment: row.comment.slice(0, 500),
  fulfillmentMode: row.fulfillmentMode === "delivery" ? "delivery" : "pickup",
  pickupPointId: row.pickupPointId,
  deliveryAddress: row.deliveryAddress.slice(0, 240),
  deliveryLat: row.deliveryLat,
  deliveryLng: row.deliveryLng,
  timeMode: row.timeMode === "scheduled" ? "scheduled" : "asap",
  scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
  items: row.items.map((item): CartLine => {
    const modifiers = parseModifiersJson(item.modifiersJson);
    const lineKey =
      (item.lineKey || "").trim() ||
      buildCartLineKey(item.productId, modifiers);
    return {
      id: item.productId,
      lineKey,
      name: item.name,
      price: item.price,
      image: item.image,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      modifiers,
      qty: Math.max(1, Math.min(99, item.qty)),
    };
  }),
});

export const loadCustomerCart = async (
  customerId: string,
): Promise<PersistedCart> => {
  const row = await prisma.customerCart.findUnique({
    where: { customerId },
    include: { items: true },
  });
  if (row) return toPersisted(row);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      fulfillmentMode: true,
      deliveryAddress: true,
      deliveryLat: true,
      deliveryLng: true,
      pickupPointId: true,
    },
  });
  if (!customer) return emptyCustomerCart();
  return {
    ...emptyCustomerCart(),
    fulfillmentMode:
      customer.fulfillmentMode === "delivery" ? "delivery" : "pickup",
    deliveryAddress: (customer.deliveryAddress ?? "").slice(0, 240),
    deliveryLat: customer.deliveryLat,
    deliveryLng: customer.deliveryLng,
    pickupPointId: customer.pickupPointId,
  };
};

export const saveCustomerCart = async (
  customerId: string,
  cart: PersistedCart,
): Promise<PersistedCart> => {
  const timeMode: PickupTimeMode =
    cart.timeMode === "scheduled" ? "scheduled" : "asap";
  const scheduledAt =
    timeMode === "scheduled" && cart.scheduledAt
      ? new Date(cart.scheduledAt)
      : null;

  const existing = await prisma.customerCart.findUnique({
    where: { customerId },
    select: { id: true },
  });

  const meta = {
    utensils: Math.max(0, Math.min(20, Math.round(cart.utensils))),
    comment: cart.comment.slice(0, 500),
    fulfillmentMode:
      cart.fulfillmentMode === "delivery"
        ? ("delivery" as const)
        : ("pickup" as const),
    pickupPointId: cart.pickupPointId,
    deliveryAddress: cart.deliveryAddress.slice(0, 240),
    deliveryLat: cart.deliveryLat,
    deliveryLng: cart.deliveryLng,
    timeMode,
    scheduledAt:
      scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
  };

  const itemsData = cart.items
    .filter((line) => line.id && line.name)
    .map((line) => {
      const modifiers = line.modifiers || [];
      const lineKey =
        line.lineKey || buildCartLineKey(line.id, modifiers);
      return {
        productId: line.id,
        lineKey: lineKey.slice(0, 255),
        name: line.name.slice(0, 255),
        price: String(line.price ?? "").slice(0, 64),
        image: String(line.image ?? "").slice(0, 500),
        categoryId: String(line.categoryId ?? "").slice(0, 64),
        categoryName: String(line.categoryName ?? "").slice(0, 255),
        qty: Math.max(1, Math.min(99, Math.round(line.qty))),
        modifiersJson: JSON.stringify(modifiers).slice(0, 2000),
      };
    });

  if (existing) {
    await prisma.$transaction([
      prisma.customerCartItem.deleteMany({ where: { cartId: existing.id } }),
      prisma.customerCart.update({
        where: { id: existing.id },
        data: {
          ...meta,
          items: { create: itemsData },
        },
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: {
          fulfillmentMode: meta.fulfillmentMode,
          ...(meta.deliveryAddress
            ? { deliveryAddress: meta.deliveryAddress }
            : {}),
          deliveryLat: meta.deliveryLat,
          deliveryLng: meta.deliveryLng,
          ...(meta.pickupPointId ? { pickupPointId: meta.pickupPointId } : {}),
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.customerCart.create({
        data: {
          customerId,
          ...meta,
          items: { create: itemsData },
        },
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: {
          fulfillmentMode: meta.fulfillmentMode,
          ...(meta.deliveryAddress
            ? { deliveryAddress: meta.deliveryAddress }
            : {}),
          deliveryLat: meta.deliveryLat,
          deliveryLng: meta.deliveryLng,
          ...(meta.pickupPointId ? { pickupPointId: meta.pickupPointId } : {}),
        },
      }),
    ]);
  }

  return loadCustomerCart(customerId);
};

const mergeLines = (
  primary: CartLine[],
  secondary: CartLine[],
  mode: "sum" | "max",
): CartLine[] => {
  const map = new Map<string, CartLine>();
  for (const line of primary) {
    const key = line.lineKey || buildCartLineKey(line.id, line.modifiers || []);
    map.set(key, { ...line, lineKey: key, modifiers: line.modifiers || [] });
  }
  for (const line of secondary) {
    const key = line.lineKey || buildCartLineKey(line.id, line.modifiers || []);
    const existing = map.get(key);
    if (existing) {
      const qty =
        mode === "sum"
          ? Math.min(99, existing.qty + line.qty)
          : Math.min(99, Math.max(existing.qty, line.qty));
      map.set(key, {
        ...existing,
        qty,
        name: line.name || existing.name,
        price: line.price || existing.price,
        image: line.image || existing.image,
        categoryId: line.categoryId || existing.categoryId,
        categoryName: line.categoryName || existing.categoryName,
        modifiers: line.modifiers?.length
          ? line.modifiers
          : existing.modifiers,
      });
    } else {
      map.set(key, {
        ...line,
        lineKey: key,
        modifiers: line.modifiers || [],
      });
    }
  }
  return [...map.values()];
};

/**
 * Combine two guest snapshots (Redux + localStorage) without double-counting
 * the same mirror of the cart — same product keeps the higher qty.
 */
export const coalesceGuestCarts = (
  a: PersistedCart,
  b: PersistedCart,
): PersistedCart => {
  if (!a.items.length) return b;
  if (!b.items.length) return a;
  return {
    ...a,
    ...b,
    items: mergeLines(a.items, b.items, "max"),
  };
};

/**
 * Merge guest cart (`local`) into account cart (`remote`).
 * Same product → qty summed (cap 99). Account settings kept; guest lines added on top.
 */
export const mergePersistedCarts = (
  local: PersistedCart,
  remote: PersistedCart,
): PersistedCart => {
  if (!local.items.length) return remote;
  if (!remote.items.length) return local;

  return {
    ...remote,
    items: mergeLines(remote.items, local.items, "sum"),
  };
};
