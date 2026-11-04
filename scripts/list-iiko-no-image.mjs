import { readFileSync } from "fs";

const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  [...envText.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map((m) => {
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return [m[1], v];
  }),
);

const base = env.IIKO_API_BASE_URL || "https://api-ru.iiko.services";
const post = async (path, body, token) => {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
};

const auth = await post("/api/v2/access_token", {
  appId: env.IIKO_APP_ID,
  clientSecret: env.IIKO_CLIENT_SECRET,
  apiKey: env.IIKO_API_KEY,
});

const menus = await post("/api/2/menu", {}, auth.token);
const menuId = String(menus.externalMenus[0].id);
const detail = await post(
  "/api/menu/v3/by_id",
  { externalMenuId: menuId, organizationId: env.IIKO_ORGANIZATION_ID },
  auth.token,
);

const rows = [];
for (const g of detail.itemsGroups || []) {
  for (const it of g.items || []) {
    const size =
      (it.sizePrices || []).find((s) => s.isDefault) || it.sizePrices?.[0];
    const img = (size?.buttonImageUrl || it.buttonImageUrl || "").trim();
    rows.push({
      productId: it.productId,
      name: it.name,
      category: g.name,
      price: size?.price ?? null,
      hasImage: Boolean(img),
    });
  }
}

console.log(JSON.stringify({ total: rows.length, withoutImage: rows.filter((r) => !r.hasImage).length, items: rows.filter((r) => !r.hasImage) }, null, 2));
