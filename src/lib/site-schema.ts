import { z } from "zod";

const idSchema = z.string().min(1);

const menuItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  price: z.string(),
});

const menuCategorySchema = z.object({
  id: idSchema,
  name: z.string(),
  items: z.array(menuItemSchema),
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
  }),
  menu: z.object({
    title: z.string(),
    note: z.string(),
    categories: z.array(menuCategorySchema),
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
]);
