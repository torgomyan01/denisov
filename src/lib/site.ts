import { randomBytes } from "crypto";
import {
  createDefaultDeliverySettings,
  createDefaultMenuCategory,
  createDefaultMenuItem,
  normalizeZoneMode,
  parseNonNegInt,
  parseOptionalFloat,
  parseZonePolygon,
} from "@/lib/delivery-defaults";
import {
  listActiveDeliveryZones,
  migrateLegacyDeliveryPolygonIfNeeded,
} from "@/lib/delivery-zones";
import { loadMergedIikoMenu } from "@/lib/iiko/site-menu";
import { prisma } from "@/lib/prisma";
import { normalizeHeaderLogoMode } from "@/lib/format";
import { isTempId } from "@/lib/ids";
import { siteDataSchema } from "@/lib/site-schema";
import type { DeliverySettings, DeliveryZone, MenuItem, SiteData } from "@/types/site";

const createId = (): string => `c${randomBytes(12).toString("hex")}`;

const mapMenuItem = (item: {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: string | null;
  image?: string | null;
  weight?: string | null;
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  showInDelivery?: boolean | null;
  inStock?: boolean | null;
  showInUpsell?: boolean | null;
  upsellSortOrder?: number | null;
  iikoProductId?: string | null;
  modifierGroups?: MenuItem["modifierGroups"] | null;
}): MenuItem =>
  createDefaultMenuItem({
    id: item.id,
    name: item.name ?? "",
    description: item.description ?? "",
    price: item.price ?? "",
    image: item.image ?? "",
    weight: item.weight ?? "",
    kcal: parseOptionalFloat(item.kcal),
    protein: parseOptionalFloat(item.protein),
    fat: parseOptionalFloat(item.fat),
    carbs: parseOptionalFloat(item.carbs),
    showInDelivery: item.showInDelivery !== false,
    inStock: item.inStock !== false,
    showInUpsell: Boolean(item.showInUpsell),
    upsellSortOrder: parseNonNegInt(item.upsellSortOrder, 0),
    iikoProductId: (item.iikoProductId ?? "").trim(),
    modifierGroups: Array.isArray(item.modifierGroups)
      ? item.modifierGroups.map((group) => ({
          id: group.id,
          name: group.name ?? "",
          minQuantity: Math.max(0, Number(group.minQuantity) || 0),
          maxQuantity: Math.max(0, Number(group.maxQuantity) || 0),
          options: Array.isArray(group.options)
            ? group.options.map((opt) => ({
                productId: opt.productId,
                name: opt.name ?? "",
                price:
                  typeof opt.price === "number" && Number.isFinite(opt.price)
                    ? opt.price
                    : 0,
              }))
            : [],
        }))
      : [],
  });

const mapDeliveryRow = (
  row: {
    bannerDesktop: string;
    bannerMobile: string;
    title: string;
    subtitle: string;
    ordersEnabled: boolean;
    minOrderAmount: number;
    deliveryFee: number;
    freeDeliveryFrom: number;
    zoneMode: string;
    zoneRadiusKm: number;
    zoneCenterLat: number | null;
    zoneCenterLng: number | null;
    zonePolygonJson: string;
  } | null,
  zones: DeliveryZone[] = [],
): DeliverySettings => {
  if (!row) {
    return { ...createDefaultDeliverySettings(), zones };
  }
  let polygon: Array<[number, number]> = [];
  try {
    polygon = parseZonePolygon(JSON.parse(row.zonePolygonJson || "[]"));
  } catch {
    polygon = [];
  }
  return {
    bannerDesktop: row.bannerDesktop ?? "",
    bannerMobile: row.bannerMobile ?? "",
    title: row.title || createDefaultDeliverySettings().title,
    subtitle: row.subtitle ?? "",
    ordersEnabled: row.ordersEnabled !== false,
    minOrderAmount: parseNonNegInt(row.minOrderAmount, 0),
    deliveryFee: parseNonNegInt(row.deliveryFee, 0),
    freeDeliveryFrom: parseNonNegInt(row.freeDeliveryFrom, 0),
    zones,
    zoneMode: normalizeZoneMode(row.zoneMode),
    zoneRadiusKm:
      Number.isFinite(row.zoneRadiusKm) && row.zoneRadiusKm >= 0
        ? row.zoneRadiusKm
        : 5,
    zoneCenterLat: parseOptionalFloat(row.zoneCenterLat),
    zoneCenterLng: parseOptionalFloat(row.zoneCenterLng),
    zonePolygon: polygon,
  };
};

export const normalizeSite = (raw: unknown): SiteData => {
  const parsed = siteDataSchema.parse(raw);
  if (!Array.isArray(parsed.dishes)) parsed.dishes = [];
  if (!parsed.menu || typeof parsed.menu !== "object") {
    parsed.menu = { title: "Меню", note: "", categories: [] };
  }
  if (!Array.isArray(parsed.menu.categories)) parsed.menu.categories = [];
  parsed.menu.categories = parsed.menu.categories.map((category) =>
    createDefaultMenuCategory({
      id: category.id,
      name: category.name ?? "",
      availableFrom: category.availableFrom ?? "",
      availableTo: category.availableTo ?? "",
      showOnSite: category.showOnSite !== false,
      items: Array.isArray(category.items)
        ? category.items.map((item) => mapMenuItem(item))
        : [],
    }),
  );
  parsed.delivery = {
    ...createDefaultDeliverySettings(),
    ...parsed.delivery,
    zones: Array.isArray(parsed.delivery?.zones) ? parsed.delivery.zones : [],
    zoneMode: normalizeZoneMode(parsed.delivery?.zoneMode),
    zonePolygon: parseZonePolygon(parsed.delivery?.zonePolygon ?? []),
    zoneCenterLat: parseOptionalFloat(parsed.delivery?.zoneCenterLat),
    zoneCenterLng: parseOptionalFloat(parsed.delivery?.zoneCenterLng),
    minOrderAmount: parseNonNegInt(parsed.delivery?.minOrderAmount, 0),
    deliveryFee: parseNonNegInt(parsed.delivery?.deliveryFee, 0),
    freeDeliveryFrom: parseNonNegInt(parsed.delivery?.freeDeliveryFrom, 0),
  };
  return parsed;
};

export const getSite = async (): Promise<SiteData> => {
  await migrateLegacyDeliveryPolygonIfNeeded();

  const [
    settings,
    meta,
    hero,
    about,
    contacts,
    footer,
    brand,
    dishes,
    deliveryRow,
    iikoMenu,
  ] = await Promise.all([
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
    prisma.deliverySettings.findUnique({ where: { id: "main" } }),
    loadMergedIikoMenu(),
  ]);

  // Zones table may be missing until `prisma db push`; don't break the whole site.
  let deliveryZones: Awaited<ReturnType<typeof listActiveDeliveryZones>> = [];
  try {
    deliveryZones = await listActiveDeliveryZones();
  } catch {
    deliveryZones = [];
  }

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
      categories: iikoMenu.categories,
    },
    delivery: mapDeliveryRow(deliveryRow, deliveryZones),
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

  // Menu tree is owned by iiko + IikoMenuOverride — not rewritten here.
  const delivery = normalized.delivery;

  await prisma.$transaction(
    async (tx) => {
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

    await tx.deliverySettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        bannerDesktop: delivery.bannerDesktop,
        bannerMobile: delivery.bannerMobile,
        title: delivery.title,
        subtitle: delivery.subtitle,
        ordersEnabled: delivery.ordersEnabled,
        minOrderAmount: delivery.minOrderAmount,
        deliveryFee: delivery.deliveryFee,
        freeDeliveryFrom: delivery.freeDeliveryFrom,
        zoneMode: delivery.zoneMode,
        zoneRadiusKm: delivery.zoneRadiusKm,
        zoneCenterLat: delivery.zoneCenterLat,
        zoneCenterLng: delivery.zoneCenterLng,
        zonePolygonJson: JSON.stringify(delivery.zonePolygon ?? []),
      },
      update: {
        bannerDesktop: delivery.bannerDesktop,
        bannerMobile: delivery.bannerMobile,
        title: delivery.title,
        subtitle: delivery.subtitle,
        ordersEnabled: delivery.ordersEnabled,
        minOrderAmount: delivery.minOrderAmount,
        deliveryFee: delivery.deliveryFee,
        freeDeliveryFrom: delivery.freeDeliveryFrom,
        zoneMode: delivery.zoneMode,
        zoneRadiusKm: delivery.zoneRadiusKm,
        zoneCenterLat: delivery.zoneCenterLat,
        zoneCenterLng: delivery.zoneCenterLng,
        zonePolygonJson: JSON.stringify(delivery.zonePolygon ?? []),
      },
    });

    // Replace dishes with current ordered set.
    await tx.dish.deleteMany({});
    if (dishRows.length) {
      await tx.dish.createMany({ data: dishRows });
    }
  },
    { timeout: 30_000 },
  );

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
