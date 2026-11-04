import { z } from "zod";

const cartModifierSchema = z.object({
  groupId: z.string().min(1).max(64),
  groupName: z.string().max(255).default(""),
  productId: z.string().min(1).max(64),
  name: z.string().max(255).default(""),
  amount: z.number().int().min(1).max(99).default(1),
});

const cartLineSchema = z
  .object({
    id: z.string().min(1).max(64),
    lineKey: z.string().max(255).optional(),
    name: z.string().min(1).max(255),
    price: z.string().max(64).default(""),
    image: z.string().max(500).default(""),
    categoryId: z.string().max(64).default(""),
    categoryName: z.string().max(255).default(""),
    qty: z.number().int().min(1).max(99),
    modifiers: z.array(cartModifierSchema).max(20).default([]),
  })
  .transform((line) => {
    const modifiers = line.modifiers ?? [];
    const lineKey =
      (line.lineKey || "").trim() ||
      (modifiers.length
        ? `${line.id}__${modifiers
            .map((m) => `${m.groupId}:${m.productId}:${m.amount}`)
            .sort()
            .join("|")}`
        : line.id);
    return { ...line, modifiers, lineKey: lineKey.slice(0, 255) };
  });

export const persistedCartSchema = z.object({
  items: z.array(cartLineSchema).max(100),
  utensils: z.number().int().min(0).max(20),
  comment: z.string().max(500),
  fulfillmentMode: z.enum(["pickup", "delivery"]),
  pickupPointId: z.string().max(64).nullable(),
  deliveryAddress: z.string().max(240),
  deliveryLat: z.number().finite().nullable(),
  deliveryLng: z.number().finite().nullable(),
  timeMode: z.enum(["asap", "scheduled"]),
  scheduledAt: z.string().max(64).nullable(),
});

export type PersistedCartInput = z.infer<typeof persistedCartSchema>;
