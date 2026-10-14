import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeHeaderLogoMode } from "@/lib/format";
import { isTempId } from "@/lib/ids";
import { siteDataSchema } from "@/lib/site-schema";
import type { SiteData } from "@/types/site";

const createId = (): string => `c${randomBytes(12).toString("hex")}`;


export const normalizeSite = (raw: unknown): SiteData => {
  const parsed = siteDataSchema.parse(raw);
  if (!Array.isArray(parsed.dishes)) parsed.dishes = [];
  if (!parsed.menu || typeof parsed.menu !== "object") {
    parsed.menu = { title: "Меню", note: "", categories: [] };
  }
  if (!Array.isArray(parsed.menu.categories)) parsed.menu.categories = [];
  parsed.menu.categories = parsed.menu.categories.map((category) => ({
    id: category.id,
    name: category.name ?? "",
    items: Array.isArray(category.items)
      ? category.items.map((item) => ({
          id: item.id,
          name: item.name ?? "",
          description: item.description ?? "",
          price: item.price ?? "",
        }))
      : [],
  }));
  return parsed;
};

export const getSite = async (): Promise<SiteData> => {
  const [settings, meta, hero, about, contacts, footer, brand, dishes, categories] =
    await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: "main" } }),
      prisma.siteMeta.findUnique({ where: { id: "main" } }),
      prisma.siteHero.findUnique({ where: { id: "main" } }),
      prisma.siteAbout.findUnique({ where: { id: "main" } }),
      prisma.siteContacts.findUnique({ where: { id: "main" } }),
      prisma.siteFooter.findUnique({ where: { id: "main" } }),
      prisma.siteBrand.findUnique({ where: { id: "main" } }),
      prisma.dish.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.menuCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
    ]);

  if (!meta || !hero || !about || !contacts || !footer || !brand || !settings) {
    throw new Error("Site content is not seeded. Run: npm run db:seed");
  }

  const site: SiteData = {
    meta: {
      title: meta.title,
      description: meta.description,
      keywords: meta.keywords,
      ogImage: meta.ogImage,
      locale: meta.locale,
    },
    hero: {
      eyebrow: hero.eyebrow,
      title: hero.title,
      subtitle: hero.subtitle,
      metaLine: hero.metaLine,
      menuButtonLabel: hero.menuButtonLabel,
      telegramButtonLabel: hero.telegramButtonLabel,
      telegramUrl: hero.telegramUrl,
      featuredImage: hero.featuredImage,
      featuredCaption: hero.featuredCaption,
      featuredBadge: hero.featuredBadge,
    },
    about: {
      eyebrow: about.eyebrow,
      title: about.title,
      text: about.text,
      stat1Value: about.stat1Value,
      stat1Label: about.stat1Label,
      stat2Value: about.stat2Value,
      stat2Label: about.stat2Label,
      stat3Value: about.stat3Value,
      stat3Label: about.stat3Label,
    },
    contacts: {
      eyebrow: contacts.eyebrow,
      title: contacts.title,
      phone: contacts.phone,
      addressLabel: contacts.addressLabel,
      address: contacts.address,
      hoursLabel: contacts.hoursLabel,
      hours: contacts.hours,
      menuButtonLabel: contacts.menuButtonLabel,
      telegramButtonLabel: contacts.telegramButtonLabel,
      telegramUrl: contacts.telegramUrl,
      image: contacts.image,
    },
    footer: {
      brand: footer.brand,
      copyright: footer.copyright,
    },
    brand: {
      logo: brand.logo,
      headerLogoMode: normalizeHeaderLogoMode(brand.headerLogoMode),
    },
    dishes: dishes.map((dish) => ({
      id: dish.id,
      image: dish.image,
      caption: dish.caption,
    })),
    menu: {
      title: settings.menuTitle,
      note: settings.menuNote,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
        })),
      })),
    },
    menuPdf: settings.menuPdf ?? undefined,
  };

  return normalizeSite(site);
};

const resolveId = (id: string): string => (isTempId(id) ? createId() : id);

export const saveSite = async (content: SiteData): Promise<SiteData> => {
  const normalized = normalizeSite(content);

  // Keep brand title + CTA labels immutable from admin saves.
  const existingHero = await prisma.siteHero.findUnique({ where: { id: "main" } });
  if (existingHero) {
    normalized.hero.title = existingHero.title;
    normalized.hero.menuButtonLabel = existingHero.menuButtonLabel;
    normalized.hero.telegramButtonLabel = existingHero.telegramButtonLabel;
  }

  if (normalized.hero.telegramUrl) {
    normalized.contacts.telegramUrl = normalized.hero.telegramUrl;
  }

  const dishRows = normalized.dishes.map((dish, index) => ({
    id: resolveId(dish.id),
    sortOrder: index,
    image: dish.image,
    caption: dish.caption,
    isActive: true,
  }));

  const categoryRows = normalized.menu.categories.map((category, index) => {
    const categoryId = resolveId(category.id);
    return {
      id: categoryId,
      sortOrder: index,
      name: category.name,
      isActive: true,
      items: category.items.map((item, itemIndex) => ({
        id: resolveId(item.id),
        categoryId,
        sortOrder: itemIndex,
        name: item.name,
        description: item.description,
        price: item.price,
        isActive: true,
      })),
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.siteSettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        menuTitle: normalized.menu.title,
        menuNote: normalized.menu.note,
        menuPdf: normalized.menuPdf ?? null,
      },
      update: {
        menuTitle: normalized.menu.title,
        menuNote: normalized.menu.note,
        menuPdf: normalized.menuPdf ?? null,
      },
    });

    await tx.siteMeta.upsert({
      where: { id: "main" },
      create: { id: "main", ...normalized.meta },
      update: { ...normalized.meta },
    });

    await tx.siteHero.upsert({
      where: { id: "main" },
      create: { id: "main", ...normalized.hero },
      update: { ...normalized.hero },
    });

    await tx.siteAbout.upsert({
      where: { id: "main" },
      create: { id: "main", ...normalized.about },
      update: { ...normalized.about },
    });

    await tx.siteContacts.upsert({
      where: { id: "main" },
      create: { id: "main", ...normalized.contacts },
      update: { ...normalized.contacts },
    });

    await tx.siteFooter.upsert({
      where: { id: "main" },
      create: { id: "main", ...normalized.footer },
      update: { ...normalized.footer },
    });

    await tx.siteBrand.upsert({
      where: { id: "main" },
      create: { id: "main", ...normalized.brand },
      update: { ...normalized.brand },
    });

    // Replace dishes with current ordered set.
    await tx.dish.deleteMany({});
    if (dishRows.length) {
      await tx.dish.createMany({ data: dishRows });
    }

    // Replace menu tree.
    await tx.menuItem.deleteMany({});
    await tx.menuCategory.deleteMany({});
    if (categoryRows.length) {
      await tx.menuCategory.createMany({
        data: categoryRows.map(({ items: _items, ...category }) => category),
      });
      const itemRows = categoryRows.flatMap((category) => category.items);
      if (itemRows.length) {
        await tx.menuItem.createMany({ data: itemRows });
      }
    }
  });

  return getSite();
};

export {
  brandLabel,
  brandLabelOrDefault,
  brandLogoSrc,
  formatPrice,
  normalizeHeaderLogoMode,
  phoneToTel,
  resolveHeaderLogo,
} from "@/lib/format";
