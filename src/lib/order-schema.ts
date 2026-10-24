import { z } from "zod";
import { persistedCartSchema } from "@/lib/customer-cart-schema";

/** Test-card form — no real charge; format checks only. */
export const testPaymentSchema = z.object({
  cardNumber: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => /^\d{16}$/.test(v), "Введите 16 цифр номера карты"),
  expiry: z
    .string()
    .trim()
    .refine(
      (v) => /^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(v),
      "Срок: ММ/ГГ",
    ),
  cvc: z
    .string()
    .trim()
    .refine((v) => /^\d{3,4}$/.test(v), "CVC: 3 или 4 цифры"),
  cardHolder: z.string().trim().min(2, "Укажите имя на карте").max(80),
});

const optionalDoorField = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v ?? "");

/** Door / courier details — filled at checkout for delivery. */
export const deliveryDetailsSchema = z.object({
  apartment: z
    .string()
    .trim()
    .min(1, "Укажите квартиру или офис")
    .max(64),
  entrance: optionalDoorField(64),
  floor: optionalDoorField(32),
  intercom: optionalDoorField(64),
  courierComment: optionalDoorField(500),
});

export const placeOrderSchema = z
  .object({
    cart: persistedCartSchema,
    customerName: z.string().trim().min(1, "Укажите имя").max(255),
    customerPhone: z.string().trim().min(5).max(32),
    payment: testPaymentSchema,
    deliveryDetails: deliveryDetailsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cart.fulfillmentMode !== "delivery") return;
    if (!data.deliveryDetails) {
      ctx.addIssue({
        code: "custom",
        message: "Укажите детали адреса доставки",
        path: ["deliveryDetails"],
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum([
    "new",
    "confirmed",
    "preparing",
    "ready",
    "delivering",
    "completed",
    "cancelled",
  ]),
  note: z.string().trim().max(255).optional(),
});

export const verifyOrderFulfillmentSchema = z.object({
  token: z.string().trim().min(8).max(64),
});
