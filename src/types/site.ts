export interface SiteMeta {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  locale: string;
}

export interface SiteHero {
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
}

export interface SiteDish {
  id: string;
  image: string;
  caption: string;
}

export interface SiteAbout {
  eyebrow: string;
  title: string;
  text: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;
}

export interface SiteContacts {
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
}

export interface SiteFooter {
  brand: string;
  copyright: string;
}

export type HeaderLogoMode = "text" | "image" | "hidden";

export interface SiteBrand {
  logo: string;
  /** How the logo is shown in the site header. */
  headerLogoMode: HeaderLogoMode;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  /** Output / weight label, e.g. «250 г» */
  weight: string;
  /** Nutrition per 100 g — null when not set */
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  showInDelivery: boolean;
  inStock: boolean;
  showInUpsell: boolean;
  upsellSortOrder: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  /** HH:MM — empty = always available */
  availableFrom: string;
  availableTo: string;
  items: MenuItem[];
}

export interface SiteMenu {
  title: string;
  note: string;
  categories: MenuCategory[];
}

export type DeliveryZoneMode = "radius" | "polygon";

export interface DeliverySettings {
  bannerDesktop: string;
  bannerMobile: string;
  title: string;
  subtitle: string;
  ordersEnabled: boolean;
  /** Min cart ₽ for delivery; 0 = no minimum */
  minOrderAmount: number;
  deliveryFee: number;
  /** Free delivery from this cart ₽; 0 = disabled */
  freeDeliveryFrom: number;
  zoneMode: DeliveryZoneMode;
  zoneRadiusKm: number;
  zoneCenterLat: number | null;
  zoneCenterLng: number | null;
  zonePolygon: Array<[number, number]>;
}

export interface SiteData {
  meta: SiteMeta;
  hero: SiteHero;
  dishes: SiteDish[];
  about: SiteAbout;
  contacts: SiteContacts;
  footer: SiteFooter;
  brand: SiteBrand;
  menu: SiteMenu;
  delivery: DeliverySettings;
  menuPdf?: string;
}

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };
