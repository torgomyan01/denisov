import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

type SeedDish = { image?: string; caption?: string };
type SeedItem = { name?: string; description?: string; price?: string };
type SeedCategory = { name?: string; items?: SeedItem[] };

type SeedSite = {
  meta: {
    title: string;
    description: string;
    keywords: string;
    ogImage: string;
    locale: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    metaLine: string;
    menuButtonLabel: string;
    telegramButtonLabel: string;
    telegramUrl: string;
    featuredImage: string;
    featuredCaption: string;
    featuredBadge: string;
  };
  about: {
    eyebrow: string;
    title: string;
    text: string;
    stat1Value: string;
    stat1Label: string;
    stat2Value: string;
    stat2Label: string;
    stat3Value: string;
    stat3Label: string;
  };
  contacts: {
    eyebrow: string;
    title: string;
    phone: string;
    addressLabel: string;
    address: string;
    hoursLabel: string;
    hours: string;
    menuButtonLabel: string;
    telegramButtonLabel: string;
    telegramUrl: string;
    image: string;
  };
  footer: { brand: string; copyright: string };
  brand: { logo: string; headerLogoMode?: string };
  dishes?: SeedDish[];
  menu?: {
    title?: string;
    note?: string;
    categories?: SeedCategory[];
  };
  menuPdf?: string;
};

const createId = (): string => `c${randomBytes(12).toString("hex")}`;

async function main() {
  const raw = readFileSync(
    join(__dirname, "seed-data", "site.json"),
    "utf-8",
  );
  const site = JSON.parse(raw) as SeedSite;

  await prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({});
    await tx.menuCategory.deleteMany({});
    await tx.dish.deleteMany({});

    await tx.siteSettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        menuTitle: site.menu?.title ?? "Меню",
        menuNote: site.menu?.note ?? "",
        menuPdf: site.menuPdf ?? null,
      },
      update: {
        menuTitle: site.menu?.title ?? "Меню",
        menuNote: site.menu?.note ?? "",
        menuPdf: site.menuPdf ?? null,
      },
    });

    await tx.siteMeta.upsert({
      where: { id: "main" },
      create: { id: "main", ...site.meta },
      update: { ...site.meta },
    });

    await tx.siteHero.upsert({
      where: { id: "main" },
      create: { id: "main", ...site.hero },
      update: { ...site.hero },
    });

    await tx.siteAbout.upsert({
      where: { id: "main" },
      create: { id: "main", ...site.about },
      update: { ...site.about },
    });

    await tx.siteContacts.upsert({
      where: { id: "main" },
      create: { id: "main", ...site.contacts },
      update: { ...site.contacts },
    });

    await tx.siteFooter.upsert({
      where: { id: "main" },
      create: { id: "main", ...site.footer },
      update: { ...site.footer },
    });

    await tx.siteBrand.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        logo: site.brand?.logo ?? "",
        headerLogoMode: site.brand?.headerLogoMode === "image" ||
          site.brand?.headerLogoMode === "hidden"
          ? site.brand.headerLogoMode
          : "text",
      },
      update: {
        logo: site.brand?.logo ?? "",
        headerLogoMode: site.brand?.headerLogoMode === "image" ||
          site.brand?.headerLogoMode === "hidden"
          ? site.brand.headerLogoMode
          : "text",
      },
    });

    const dishes = Array.isArray(site.dishes) ? site.dishes : [];
    if (dishes.length) {
      await tx.dish.createMany({
        data: dishes.map((dish, index) => ({
          id: createId(),
          sortOrder: index,
          image: dish.image ?? "",
          caption: dish.caption ?? "",
          isActive: true,
        })),
      });
    }

    const categories = Array.isArray(site.menu?.categories)
      ? site.menu.categories
      : [];

    for (const [index, category] of categories.entries()) {
      const categoryId = createId();
      await tx.menuCategory.create({
        data: {
          id: categoryId,
          sortOrder: index,
          name: category.name ?? "",
          isActive: true,
          items: {
            create: (category.items ?? []).map((item, itemIndex) => ({
              id: createId(),
              sortOrder: itemIndex,
              name: item.name ?? "",
              description: item.description ?? "",
              price: item.price ?? "",
              isActive: true,
            })),
          },
        },
      });
    }

    const pickupCount = await tx.pickupPoint.count();
    if (pickupCount === 0) {
      await tx.pickupPoint.create({
        data: {
          id: createId(),
          name: "Денисов на Московском",
          phone: site.contacts.phone || "+79819439888",
          address:
            site.contacts.address ||
            "Санкт-Петербург, Московский пр., 71/3",
          lat: 59.89135,
          lng: 30.31985,
          sortOrder: 0,
          isActive: true,
        },
      });
    }

    await tx.deliverySettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        title: "Доставка из Денисова",
        subtitle:
          site.contacts.address
            ? `${site.contacts.address} · ${site.contacts.hours || "ежедневно 8:00–22:00"}`
            : "Московский пр., 71/3 · ежедневно 8:00–22:00",
        ordersEnabled: true,
        minOrderAmount: 0,
        deliveryFee: 0,
        freeDeliveryFrom: 0,
        zoneMode: "radius",
        zoneRadiusKm: 5,
        zoneCenterLat: 59.89135,
        zoneCenterLng: 30.31985,
        zonePolygonJson: "[]",
      },
      update: {},
    });
  });

  console.log("Seeded relational CMS tables from site.json");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
