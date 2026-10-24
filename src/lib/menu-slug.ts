/** Russian / Latin → ASCII slug segment. */
const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** URL-safe ASCII slug from a dish name. */
export const slugifyName = (name: string): string => {
  const lower = String(name || "").toLowerCase().replace(/ё/g, "е");
  let out = "";
  for (const ch of lower) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
};

/** Last 8 alnum chars of id — stable product key in the URL. */
export const menuItemIdTail = (id: string): string => {
  const alnum = id.replace(/[^a-zA-Z0-9]/g, "");
  return (alnum.slice(-8) || id.slice(-8)).toLowerCase();
};

/** Stable public slug for /menu/[slug] (transliterated name + id tail). */
export const menuItemSlug = (item: { id: string; name: string }): string => {
  const base = slugifyName(item.name) || "item";
  return `${base}-${menuItemIdTail(item.id)}`;
};

export const matchesMenuItemSlug = (
  item: { id: string; name: string },
  slug: string,
): boolean => {
  if (!slug) return false;
  const raw = safeDecode(slug).trim();
  const normalized = raw.toLowerCase();
  if (!normalized) return false;

  if (item.id === raw || item.id.toLowerCase() === normalized) return true;
  if (menuItemSlug(item) === normalized) return true;

  // Legacy Cyrillic slug (older links) — compare by id tail.
  const tail = menuItemIdTail(item.id);
  if (tail && (normalized.endsWith(`-${tail}`) || normalized.endsWith(tail))) {
    return true;
  }

  return false;
};
