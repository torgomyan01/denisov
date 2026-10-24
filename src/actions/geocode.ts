"use server";

import {
  reverseGeocodeWithNominatim,
  type GeocodedPlace,
} from "@/lib/geocode";
import type { ActionResult } from "@/types/site";

export type { GeocodedPlace };

/** Public reverse-geocode for cart map picker (Nominatim — works without Yandex Geocoder). */
export const reverseGeocodePlaceAction = async (
  lat: number,
  lng: number,
): Promise<ActionResult<GeocodedPlace>> => {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { success: false, error: "Некорректные координаты" };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { success: false, error: "Координаты вне диапазона" };
    }

    const place = await reverseGeocodeWithNominatim(lat, lng);
    if (!place) {
      return { success: false, error: "Адрес не найден" };
    }
    return { success: true, data: place };
  } catch {
    return { success: false, error: "Не удалось определить адрес" };
  }
};
