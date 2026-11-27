/**
 * Checks whether a delivery address string includes a concrete house number
 * (so orders are never placed with only a street name or generic map label).
 */
export const hasHouseNumber = (raw: string | null | undefined): boolean => {
  const value = (raw ?? "").trim();
  if (!value) return false;
  if (/^(точка на карте|адрес на карте)/i.test(value)) return false;

  // Strip leading country/city/postal prefixes so postal codes (e.g. 196084) don't count as house numbers.
  const withoutPrefix = value
    .replace(/^\d{6}\s*,\s*/, "")
    .replace(/^(?:россия\s*,\s*)?/i, "")
    .replace(/^(?:г\.?\s*)?санкт-петербург\s*,\s*/i, "")
    .trim();

  if (!withoutPrefix) return false;

  // Explicit house marker: "д 46", "д. 46", "дом 46"
  if (/(?:^|[\s,])д(?:ом)?\.?\s*\d+/i.test(withoutPrefix)) {
    return true;
  }

  // Trailing comma + house number: "Московский пр., 71" or "ул. Заставская, 46/1"
  const parts = withoutPrefix
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (/^\d+[а-яa-z0-9/\\-]*$/i.test(last) || /^\d+\s*(?:к|корп|стр|лит)/i.test(last)) {
      return true;
    }
  }

  return false;
};
