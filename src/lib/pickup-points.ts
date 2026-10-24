import { prisma } from "@/lib/prisma";

export type PickupPointPublic = {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
};

export type PickupPointAdmin = PickupPointPublic & {
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const toPickupPointPublic = (row: {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}): PickupPointPublic => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  address: row.address,
  lat: row.lat,
  lng: row.lng,
});

export const toPickupPointAdmin = (row: {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PickupPointAdmin => ({
  ...toPickupPointPublic(row),
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Active pickup points for the public site / cart. */
export const listActivePickupPoints = async (): Promise<PickupPointPublic[]> => {
  const rows = await prisma.pickupPoint.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toPickupPointPublic);
};

/** All points for admin panel. */
export const listAllPickupPoints = async (): Promise<PickupPointAdmin[]> => {
  const rows = await prisma.pickupPoint.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toPickupPointAdmin);
};

/** Default map center — Denisov on Moskovsky pr. */
export const DEFAULT_MAP_CENTER = {
  lat: 59.89135,
  lng: 30.31985,
} as const;
