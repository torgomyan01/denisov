import { z } from "zod";

const cartLineSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  price: z.string().max(64).default(""),
  image: z.string().max(500).default(""),
  categoryId: z.string().max(64).default(""),
  categoryName: z.string().max(255).default(""),
  qty: z.number().int().min(1).max(99),
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
