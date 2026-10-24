import { z } from "zod";

const idSchema = z.string().min(1);

const optionalFloat = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

const menuItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  price: z.string(),
  image: z.string().default(""),
  weight: z.string().default(""),
  kcal: optionalFloat,
  protein: optionalFloat,
  fat: optionalFloat,
  carbs: optionalFloat,
  showInDelivery: z.boolean().default(true),
  inStock: z.boolean().default(true),
  showInUpsell: z.boolean().default(false),
  upsellSortOrder: z.number().int().default(0),
});

const menuCategorySchema = z.object({
  id: idSchema,
  name: z.string(),
  availableFrom: z.string().default(""),
  availableTo: z.string().default(""),
  items: z.array(menuItemSchema),
});

const deliverySettingsSchema = z.object({
  bannerDesktop: z.string().default(""),
  bannerMobile: z.string().default(""),
  title: z.string().default("Доставка из Денисова"),
  subtitle: z.string().default(""),
  ordersEnabled: z.boolean().default(true),
  minOrderAmount: z.number().int().min(0).default(0),
  deliveryFee: z.number().int().min(0).default(0),
  freeDeliveryFrom: z.number().int().min(0).default(0),
  zoneMode: z.enum(["radius", "polygon"]).default("radius"),
  zoneRadiusKm: z.number().min(0).default(5),
  zoneCenterLat: z.union([z.number(), z.null()]).default(null),
  zoneCenterLng: z.union([z.number(), z.null()]).default(null),
  zonePolygon: z
    .array(z.tuple([z.number(), z.number()]))
    .default([]),
});

export const siteDataSchema = z.object({
  meta: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.string(),
    ogImage: z.string(),
    locale: z.string(),
  }),
  hero: z.object({
    eyebrow: z.string(),
    title: z.string(),
    subtitle: z.string(),
    metaLine: z.string(),
    menuButtonLabel: z.string(),
    telegramButtonLabel: z.string(),
    telegramUrl: z.string(),
    featuredImage: z.string(),
    featuredCaption: z.string(),
    featuredBadge: z.string(),
  }),
  dishes: z.array(
    z.object({
      id: idSchema,
      image: z.string(),
      caption: z.string(),
    }),
  ),
  about: z.object({
    eyebrow: z.string(),
    title: z.string(),
    text: z.string(),
    stat1Value: z.string(),
    stat1Label: z.string(),
    stat2Value: z.string(),
    stat2Label: z.string(),
    stat3Value: z.string(),
    stat3Label: z.string(),
  }),
  contacts: z.object({
    eyebrow: z.string(),
    title: z.string(),
    phone: z.string(),
    addressLabel: z.string(),
    address: z.string(),
    hoursLabel: z.string(),
    hours: z.string(),
    menuButtonLabel: z.string(),
    telegramButtonLabel: z.string(),
    telegramUrl: z.string(),
    image: z.string(),
  }),
  footer: z.object({
    brand: z.string(),
    copyright: z.string(),
  }),
  brand: z.object({
    logo: z.string(),
    headerLogoMode: z.enum(["text", "image", "hidden"]).default("text"),
  }),
  menu: z.object({
    title: z.string(),
    note: z.string(),
    categories: z.array(menuCategorySchema),
  }),
  delivery: deliverySettingsSchema.default({
    bannerDesktop: "",
    bannerMobile: "",
    title: "Доставка из Денисова",
    subtitle: "",
    ordersEnabled: true,
    minOrderAmount: 0,
    deliveryFee: 0,
    freeDeliveryFrom: 0,
    zoneMode: "radius",
    zoneRadiusKm: 5,
    zoneCenterLat: null,
    zoneCenterLng: null,
    zonePolygon: [],
  }),
  menuPdf: z.string().optional(),
});

export const loginSchema = z.object({
  password: z.string().min(1, "Введите пароль"),
});

export const uploadFieldSchema = z.enum([
  "featured",
  "contacts",
  "logo",
  "menu",
  "deliveryBannerDesktop",
  "deliveryBannerMobile",
]);
