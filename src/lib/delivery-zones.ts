import { prisma } from "@/lib/prisma";
import { parseNonNegInt, parseZonePolygon } from "@/lib/delivery-defaults";

export type DeliveryZonePublic = {
  id: string;
  name: string;
  color: string;
  polygon: Array<[number, number]>;
  deliveryFee: number;
  freeDeliveryFrom: number;
  minOrderAmount: number;
  sortOrder: number;
};

export type DeliveryZoneAdmin = DeliveryZonePublic & {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const ZONE_COLOR_PALETTE = [
  "#9C6B4A",
  "#6B8F71",
  "#5B7C99",
  "#B07D58",
  "#8B6B8B",
  "#7A8B5B",
  "#C45C4A",
  "#4A7B8C",
] as const;

export const normalizeZoneColor = (raw: unknown): string => {
  const value = String(raw ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase();
  return ZONE_COLOR_PALETTE[0];
};

export const nextZoneColor = (used: string[]): string => {
  const usedSet = new Set(used.map((c) => c.toUpperCase()));
  for (const color of ZONE_COLOR_PALETTE) {
    if (!usedSet.has(color)) return color;
  }
  return ZONE_COLOR_PALETTE[used.length % ZONE_COLOR_PALETTE.length]!;
};

const rowToPublic = (row: {
  id: string;
  name: string;
  color: string;
  polygonJson: string;
  deliveryFee: number;
  freeDeliveryFrom: number;
  minOrderAmount: number;
  sortOrder: number;
}): DeliveryZonePublic => {
  let polygon: Array<[number, number]> = [];
  try {
    polygon = parseZonePolygon(JSON.parse(row.polygonJson || "[]"));
  } catch {
    polygon = [];
  }
  return {
    id: row.id,
    name: row.name,
    color: normalizeZoneColor(row.color),
    polygon,
    deliveryFee: parseNonNegInt(row.deliveryFee, 0),
    freeDeliveryFrom: parseNonNegInt(row.freeDeliveryFrom, 0),
    minOrderAmount: parseNonNegInt(row.minOrderAmount, 0),
    sortOrder: row.sortOrder,
  };
};

export const toDeliveryZoneAdmin = (row: {
  id: string;
  name: string;
  color: string;
  polygonJson: string;
  deliveryFee: number;
  freeDeliveryFrom: number;
  minOrderAmount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DeliveryZoneAdmin => ({
  ...rowToPublic(row),
  isActive: row.isActive,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listActiveDeliveryZones = async (): Promise<DeliveryZonePublic[]> => {
  const rows = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(rowToPublic).filter((z) => z.polygon.length >= 3);
};

export const listAllDeliveryZones = async (): Promise<DeliveryZoneAdmin[]> => {
  const rows = await prisma.deliveryZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDeliveryZoneAdmin);
};

/** One-time: legacy single polygon → first DeliveryZone row. Never throws. */
export const migrateLegacyDeliveryPolygonIfNeeded = async (): Promise<void> => {
  try {
    const existing = await prisma.deliveryZone.count();
    if (existing > 0) return;

    const settings = await prisma.deliverySettings.findUnique({
      where: { id: "main" },
    });
    if (!settings || settings.zoneMode !== "polygon") return;

    let polygon: Array<[number, number]> = [];
    try {
      polygon = parseZonePolygon(JSON.parse(settings.zonePolygonJson || "[]"));
    } catch {
      return;
    }
    if (polygon.length < 3) return;

    await prisma.deliveryZone.create({
      data: {
        name: "Основная зона",
        color: ZONE_COLOR_PALETTE[0],
        polygonJson: JSON.stringify(polygon),
        deliveryFee: settings.deliveryFee,
        freeDeliveryFrom: settings.freeDeliveryFrom,
        minOrderAmount: settings.minOrderAmount,
        sortOrder: 0,
        isActive: true,
      },
    });
  } catch {
    // DB down / table not migrated yet — skip quietly; getSite still loads.
  }
};
