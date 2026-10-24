import type {
  DeliverySettings,
  DeliveryZoneMode,
  MenuCategory,
  MenuItem,
} from "@/types/site";

export const DEFAULT_DELIVERY_TITLE = "Доставка из Денисова";
export const DEFAULT_DELIVERY_SUBTITLE =
  "Московский пр., 71/3 · ежедневно 8:00–22:00";

export const createDefaultDeliverySettings = (): DeliverySettings => ({
  bannerDesktop: "",
  bannerMobile: "",
  title: DEFAULT_DELIVERY_TITLE,
  subtitle: DEFAULT_DELIVERY_SUBTITLE,
  ordersEnabled: true,
  minOrderAmount: 0,
  deliveryFee: 0,
  freeDeliveryFrom: 0,
  zoneMode: "radius",
  zoneRadiusKm: 5,
  zoneCenterLat: null,
  zoneCenterLng: null,
  zonePolygon: [],
});

export const createDefaultMenuItem = (
  partial: Partial<MenuItem> & Pick<MenuItem, "id">,
): MenuItem => ({
  name: "",
  description: "",
  price: "",
  image: "",
  weight: "",
  kcal: null,
  protein: null,
  fat: null,
  carbs: null,
  showInDelivery: true,
  inStock: true,
  showInUpsell: false,
  upsellSortOrder: 0,
  ...partial,
});

export const createDefaultMenuCategory = (
  partial: Partial<MenuCategory> & Pick<MenuCategory, "id">,
): MenuCategory => ({
  name: "",
  availableFrom: "",
  availableTo: "",
  items: [],
  ...partial,
});

export const normalizeZoneMode = (value: unknown): DeliveryZoneMode =>
  value === "polygon" ? "polygon" : "radius";

export const parseZonePolygon = (raw: unknown): Array<[number, number]> => {
  if (!Array.isArray(raw)) return [];
  const points: Array<[number, number]> = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const lat = Number(entry[0]);
    const lng = Number(entry[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push([lat, lng]);
  }
  return points;
};

export const parseOptionalFloat = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const parseNonNegInt = (value: unknown, fallback = 0): number => {
  const n =
    typeof value === "number" ? value : Number(String(value ?? "").replace(/\s/g, ""));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
};
