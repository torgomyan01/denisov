import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const phoneField = z
  .string()
  .trim()
  .min(10, "Введите телефон")
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        message: "Телефон в формате +7 XXX XXX-XX-XX",
      });
      return z.NEVER;
    }
    return phone;
  });

const passwordField = z
  .string()
  .min(6, "Пароль не короче 6 символов")
  .max(72, "Слишком длинный пароль");

export const registerCustomerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Введите имя")
      .max(80, "Слишком длинное имя"),
    phone: phoneField,
    password: passwordField,
    passwordConfirm: z.string().min(1, "Повторите пароль"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Пароли не совпадают",
    path: ["passwordConfirm"],
  });

export const loginCustomerSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, "Введите пароль"),
});

/** Profile update — personal details + delivery preferences. */
export const updateCustomerProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Введите имя")
      .max(80, "Слишком длинное имя"),
    surname: z
      .string()
      .trim()
      .min(1, "Введите фамилию")
      .max(80, "Слишком длинная фамилия"),
    phone: z.string().trim().min(10, "Введите телефон"),
    deliveryAddress: z.string().trim().max(500).optional(),
    deliveryLat: z.number().finite().nullable().optional(),
    deliveryLng: z.number().finite().nullable().optional(),
    pickupPointId: z.string().trim().max(64).nullable().optional(),
    fulfillmentMode: z.enum(["pickup", "delivery"]),
  })
  .superRefine((data, ctx) => {
    const phone = normalizePhone(data.phone);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        message: "Телефон в формате +7 XXX XXX-XX-XX",
        path: ["phone"],
      });
    }
    if (data.fulfillmentMode === "delivery") {
      const hasPoint =
        data.deliveryLat != null &&
        data.deliveryLng != null &&
        Number.isFinite(data.deliveryLat) &&
        Number.isFinite(data.deliveryLng);
      if (!hasPoint) {
        ctx.addIssue({
          code: "custom",
          message: "Отметьте точку доставки на карте",
          path: ["deliveryLat"],
        });
      }
    }
    if (data.fulfillmentMode === "pickup" && !data.pickupPointId?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Выберите точку самовывоза",
        path: ["pickupPointId"],
      });
    }
  });
