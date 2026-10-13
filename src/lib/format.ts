import type { SiteData } from "@/types/site";

export const phoneToTel = (phone: string): string =>
  `tel:${phone.replace(/[^\d+]/g, "")}`;

export const formatPrice = (price: string): string => {
  const raw = String(price ?? "").trim();
  if (!raw) return "";
  if (/₽|руб/i.test(raw)) return raw;
  return `${raw} ₽`;
};

export const brandLabel = (site: SiteData): string =>
  site.footer.brand?.trim() || "ДЕНИСОВ";
