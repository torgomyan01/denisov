import type { DeliverySettings } from "@/types/site";

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Haversine distance in km. */
export const distanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Ray-casting point-in-polygon. */
export const pointInPolygon = (
  lat: number,
  lng: number,
  polygon: Array<[number, number]>,
): boolean => {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    const [yi, xi] = pi;
    const [yj, xj] = pj;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const isPointInDeliveryZone = (
  settings: DeliverySettings,
  lat: number,
  lng: number,
): boolean => {
  if (settings.zoneMode === "polygon") {
    const poly = settings.zonePolygon ?? [];
    if (poly.length < 3) return true; // not configured → allow
    return pointInPolygon(lat, lng, poly);
  }

  const centerLat = settings.zoneCenterLat;
  const centerLng = settings.zoneCenterLng;
  if (centerLat == null || centerLng == null) return true;
  const radius = settings.zoneRadiusKm > 0 ? settings.zoneRadiusKm : 5;
  return distanceKm(centerLat, centerLng, lat, lng) <= radius + 1e-6;
};

export const calcDeliveryFeeRub = (
  settings: DeliverySettings,
  subtotalRub: number,
): number => {
  const fee = Math.max(0, Math.round(settings.deliveryFee || 0));
  const freeFrom = Math.max(0, Math.round(settings.freeDeliveryFrom || 0));
  if (freeFrom > 0 && subtotalRub >= freeFrom) return 0;
  return fee;
};

export const deliveryMinRemainingRub = (
  settings: DeliverySettings,
  subtotalRub: number,
): number => {
  const min = Math.max(0, Math.round(settings.minOrderAmount || 0));
  if (min <= 0) return 0;
  return Math.max(0, min - subtotalRub);
};

export type DeliveryTotals = {
  subtotalRub: number;
  deliveryFeeRub: number;
  totalRub: number;
  minRemainingRub: number;
  meetsMinimum: boolean;
};

export const calcDeliveryTotals = (
  settings: DeliverySettings,
  subtotalRub: number,
  fulfillmentMode: "pickup" | "delivery",
): DeliveryTotals => {
  const sub = Math.max(0, Math.round(subtotalRub));
  if (fulfillmentMode !== "delivery") {
    return {
      subtotalRub: sub,
      deliveryFeeRub: 0,
      totalRub: sub,
      minRemainingRub: 0,
      meetsMinimum: true,
    };
  }
  const deliveryFeeRub = calcDeliveryFeeRub(settings, sub);
  const minRemainingRub = deliveryMinRemainingRub(settings, sub);
  return {
    subtotalRub: sub,
    deliveryFeeRub,
    totalRub: sub + deliveryFeeRub,
    minRemainingRub,
    meetsMinimum: minRemainingRub <= 0,
  };
};
