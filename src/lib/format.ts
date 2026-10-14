import type { HeaderLogoMode, SiteData } from "@/types/site";

export const phoneToTel = (phone: string): string =>
  `tel:${phone.replace(/[^\d+]/g, "")}`;

export const formatPrice = (price: string): string => {
  const raw = String(price ?? "").trim();
  if (!raw) return "";
  if (/₽|руб/i.test(raw)) return raw;
  return `${raw} ₽`;
};

/** Visible brand text from CMS (may be empty if client cleared the logo text). */
export const brandLabel = (site: SiteData): string =>
  site.footer.brand?.trim() || "";

/** Fallback for aria-labels / alt when brand text was cleared. */
export const brandLabelOrDefault = (site: SiteData): string =>
  brandLabel(site) || "ДЕНИСОВ";

export const brandLogoSrc = (site: SiteData): string =>
  site.brand.logo?.trim() || "";

export const normalizeHeaderLogoMode = (value: unknown): HeaderLogoMode => {
  if (value === "image" || value === "hidden" || value === "text") return value;
  return "text";
};

/**
 * Resolved header logo presentation.
 * - hidden → nothing branded in the header
 * - image → image if uploaded, otherwise text fallback
 * - text → text brand (or empty)
 */
export const resolveHeaderLogo = (
  site: SiteData,
): { mode: HeaderLogoMode; logo: string; text: string } => {
  const mode = normalizeHeaderLogoMode(site.brand.headerLogoMode);
  const logo = brandLogoSrc(site);
  const text = brandLabel(site);

  if (mode === "hidden") {
    return { mode, logo: "", text: "" };
  }
  if (mode === "image") {
    return { mode, logo, text: logo ? "" : text };
  }
  return { mode: "text", logo: "", text };
};
