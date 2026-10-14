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
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface SiteMenu {
  title: string;
  note: string;
  categories: MenuCategory[];
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
  menuPdf?: string;
}

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };
