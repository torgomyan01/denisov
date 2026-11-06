import type { DeliveryZonePublic } from "@/lib/delivery-zones";
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

/** Active zones that have a drawable polygon. */
export const configuredDeliveryZones = (
  zones: DeliveryZonePublic[] | undefined | null,
): DeliveryZonePublic[] =>
  (zones ?? []).filter((z) => z.polygon.length >= 3);

/**
 * First matching zone by sortOrder. Overlaps → earlier zone wins.
 */
export const findDeliveryZoneForPoint = (
  zones: DeliveryZonePublic[] | undefined | null,
  lat: number,
  lng: number,
): DeliveryZonePublic | null => {
  for (const zone of configuredDeliveryZones(zones)) {
    if (pointInPolygon(lat, lng, zone.polygon)) return zone;
  }
  return null;
};

const hasMultiZones = (settings: DeliverySettings): boolean =>
  configuredDeliveryZones(settings.zones).length > 0;

/** Legacy radius / single-polygon when multi-zones are empty. */
const isPointInLegacyZone = (
  settings: DeliverySettings,
  lat: number,
  lng: number,
): boolean => {
  if (settings.zoneMode === "polygon") {
    const poly = settings.zonePolygon ?? [];
    if (poly.length < 3) return true;
    return pointInPolygon(lat, lng, poly);
  }

  const centerLat = settings.zoneCenterLat;
  const centerLng = settings.zoneCenterLng;
  if (centerLat == null || centerLng == null) return true;
  const radius = settings.zoneRadiusKm > 0 ? settings.zoneRadiusKm : 5;
  return distanceKm(centerLat, centerLng, lat, lng) <= radius + 1e-6;
};

export const isPointInDeliveryZone = (
  settings: DeliverySettings,
  lat: number,
  lng: number,
): boolean => {
  if (hasMultiZones(settings)) {
    return findDeliveryZoneForPoint(settings.zones, lat, lng) != null;
  }
  return isPointInLegacyZone(settings, lat, lng);
};

export const resolveDeliveryFeeRub = (
  settings: DeliverySettings,
  subtotalRub: number,
  point?: { lat: number; lng: number } | null,
): { feeRub: number; zone: DeliveryZonePublic | null; minOrderAmount: number } => {
  const sub = Math.max(0, Math.round(subtotalRub));
  const zone =
    point && hasMultiZones(settings)
      ? findDeliveryZoneForPoint(settings.zones, point.lat, point.lng)
      : null;

  if (zone) {
    const freeFrom = Math.max(0, Math.round(zone.freeDeliveryFrom || 0));
    const fee = Math.max(0, Math.round(zone.deliveryFee || 0));
    const minOrder =
      zone.minOrderAmount > 0
        ? zone.minOrderAmount
        : Math.max(0, Math.round(settings.minOrderAmount || 0));
    return {
      feeRub: freeFrom > 0 && sub >= freeFrom ? 0 : fee,
      zone,
      minOrderAmount: minOrder,
    };
  }

  if (hasMultiZones(settings)) {
    return {
      feeRub: 0,
      zone: null,
      minOrderAmount: Math.max(0, Math.round(settings.minOrderAmount || 0)),
    };
  }

  const fee = Math.max(0, Math.round(settings.deliveryFee || 0));
  const freeFrom = Math.max(0, Math.round(settings.freeDeliveryFrom || 0));
  return {
    feeRub: freeFrom > 0 && sub >= freeFrom ? 0 : fee,
    zone: null,
    minOrderAmount: Math.max(0, Math.round(settings.minOrderAmount || 0)),
  };
};

/** @deprecated prefer resolveDeliveryFeeRub with point */
export const calcDeliveryFeeRub = (
  settings: DeliverySettings,
  subtotalRub: number,
): number => resolveDeliveryFeeRub(settings, subtotalRub, null).feeRub;

export const deliveryMinRemainingRub = (
  minOrderAmount: number,
  subtotalRub: number,
): number => {
  const min = Math.max(0, Math.round(minOrderAmount || 0));
  if (min <= 0) return 0;
  return Math.max(0, min - Math.max(0, Math.round(subtotalRub)));
};

export type DeliveryTotals = {
  subtotalRub: number;
  deliveryFeeRub: number;
  totalRub: number;
  minRemainingRub: number;
  meetsMinimum: boolean;
  minOrderAmount: number;
  matchedZone: DeliveryZonePublic | null;
};

export const calcDeliveryTotals = (
  settings: DeliverySettings,
  subtotalRub: number,
  fulfillmentMode: "pickup" | "delivery",
  point?: { lat: number; lng: number } | null,
): DeliveryTotals => {
  const sub = Math.max(0, Math.round(subtotalRub));
  if (fulfillmentMode !== "delivery") {
    return {
      subtotalRub: sub,
      deliveryFeeRub: 0,
      totalRub: sub,
      minRemainingRub: 0,
      meetsMinimum: true,
      minOrderAmount: 0,
      matchedZone: null,
    };
  }

  const resolved = resolveDeliveryFeeRub(settings, sub, point ?? null);
  const minRemainingRub = deliveryMinRemainingRub(
    resolved.minOrderAmount,
    sub,
  );
  return {
    subtotalRub: sub,
    deliveryFeeRub: resolved.feeRub,
    totalRub: sub + resolved.feeRub,
    minRemainingRub,
    meetsMinimum: minRemainingRub <= 0,
    minOrderAmount: resolved.minOrderAmount,
    matchedZone: resolved.zone,
  };
};
