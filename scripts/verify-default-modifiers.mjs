import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  let val = m[2].trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const base = (
  process.env.IIKO_API_BASE_URL || "https://api-ru.iiko.services"
).replace(/\/$/, "");
const token = (
  await (
    await fetch(`${base}/api/v2/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: process.env.IIKO_APP_ID,
        clientSecret: process.env.IIKO_CLIENT_SECRET,
        apiKey: process.env.IIKO_API_KEY,
      }),
    })
  ).json()
).token;
const auth = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
const menus = await (
  await fetch(`${base}/api/2/menu`, {
    method: "POST",
    headers: auth,
    body: "{}",
  })
).json();
const menu = await (
  await fetch(`${base}/api/menu/v3/by_id`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      externalMenuId: String(menus.externalMenus[0].id),
      organizationId: process.env.IIKO_ORGANIZATION_ID,
    }),
  })
).json();

const modNames = new Map(
  (menu.modifiers || []).map((m) => [m.id, m.name]),
);
const target = "3b78a6df-f2cb-4d1d-b9de-99e5563b345e";
let egg = null;
for (const g of menu.itemsGroups || []) {
  for (const item of g.items || []) {
    if (item.productId === target) egg = item;
  }
}
const group = egg.modifierGroups[0];
const defaults = [];
const min = group.restrictions.minQuantity;
for (let i = 0; i < min; i++) {
  const opt = group.items[i] || group.items[0];
  defaults.push({
    productId: opt.id,
    productGroupId: group.id,
    amount: 1,
    name: modNames.get(opt.id),
  });
}
console.log(
  JSON.stringify(
    {
      product: egg.name,
      group: group.name,
      defaults,
      payloadModifiers: defaults.map((d) => ({
        productId: d.productId,
        productGroupId: d.productGroupId,
        amount: d.amount,
      })),
    },
    null,
    2,
  ),
);
