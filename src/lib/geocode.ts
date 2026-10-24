export type GeocodedPlace = {
  /** Short pretty label for UI: «Московский проспект, 71» */
  label: string;
  /** Fuller address line for logistics / DB */
  fullAddress: string;
};

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  residential?: string;
  house_number?: string;
  building?: string;
  amenity?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
};

type NominatimReverseResponse = {
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
};

const looksLikeCoords = (value: string): boolean =>
  /^-?\d+[.,]\d+\s*,\s*-?\d+[.,]\d+$/.test(value.trim());

/** Build a short street/building label from Nominatim address parts. */
export const formatNominatimLabel = (
  address: NominatimAddress | undefined,
  displayName: string,
): string | null => {
  if (!address) {
    const cleaned = cleanDisplayName(displayName);
    return cleaned && !looksLikeCoords(cleaned) ? cleaned : null;
  }

  const street =
    address.road ||
    address.pedestrian ||
    address.residential ||
    address.footway ||
    address.path ||
    "";
  const house = address.house_number || "";
  const building = address.building || address.amenity || "";

  if (street && house) return `${street}, ${house}`;
  if (street && building) return `${street}, ${building}`;
  if (street) return street;
  if (building) return building;

  const cleaned = cleanDisplayName(displayName);
  return cleaned && !looksLikeCoords(cleaned) ? cleaned : null;
};

const cleanDisplayName = (line: string): string =>
  line
    .replace(/^Россия,?\s*/i, "")
    .replace(/^г\.?\s*Санкт-Петербург,?\s*/i, "")
    .replace(/^Санкт-Петербург,?\s*/i, "")
    .replace(/^СПб,?\s*/i, "")
    .trim();

/**
 * Reverse-geocode via OpenStreetMap Nominatim (no Yandex Geocoder key needed).
 * Call from the server (User-Agent required by Nominatim policy).
 */
export const reverseGeocodeWithNominatim = async (
  lat: number,
  lng: number,
): Promise<GeocodedPlace | null> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("zoom", "18");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "DenisovCafe/1.0 (https://cafedenisov.ru; pickup-delivery)",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as NominatimReverseResponse;
  if (data.error || !data.display_name) return null;

  const fullAddress = cleanDisplayName(data.display_name) || data.display_name;
  const label = formatNominatimLabel(data.address, data.display_name);
  if (!label) return null;

  return { label, fullAddress: fullAddress || label };
};
