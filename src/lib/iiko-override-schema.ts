import { z } from "zod";

const optionalFloat = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

export const iikoMenuOverrideSchema = z.object({
  iikoProductId: z.string().uuid("Некорректный productId"),
  name: z.string().max(255).default(""),
  description: z.string().max(5000).default(""),
  price: z.string().max(64).default(""),
  weight: z.string().max(64).default(""),
  image: z.string().max(500).optional(),
  kcal: optionalFloat,
  protein: optionalFloat,
  fat: optionalFloat,
  carbs: optionalFloat,
  showInDelivery: z.boolean().default(true),
  inStock: z.boolean().default(true),
  showInUpsell: z.boolean().default(false),
  upsellSortOrder: z.number().int().min(0).max(9999).default(0),
  clearImage: z.boolean().optional(),
});

export type IikoMenuOverrideInput = z.infer<typeof iikoMenuOverrideSchema>;
