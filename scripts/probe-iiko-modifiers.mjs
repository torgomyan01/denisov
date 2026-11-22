/**
 * Dump modifier structure from external menu v3.
 * Usage: node scripts/probe-iiko-modifiers.mjs [productId]
 */
import { readFileSync, writeFileSync } from "fs";
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

const targetId =
  process.argv[2]?.trim() || "3b78a6df-f2cb-4d1d-b9de-99e5563b345e";
const groupNeedle = "86652e95-ad68-4e7d-9a1f-ef8af6fb35db";
const base = (
  process.env.IIKO_API_BASE_URL || "https://api-ru.iiko.services"
).replace(/\/$/, "");

const tokenRes = await fetch(`${base}/api/v2/access_token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    appId: process.env.IIKO_APP_ID,
    clientSecret: process.env.IIKO_CLIENT_SECRET,
    apiKey: process.env.IIKO_API_KEY,
  }),
});
const { token } = await tokenRes.json();
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
const externalMenuId = String(menus.externalMenus?.[0]?.id);

const menu = await (
  await fetch(`${base}/api/menu/v3/by_id`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      externalMenuId,
      organizationId: process.env.IIKO_ORGANIZATION_ID,
    }),
  })
).json();

console.log("top keys", Object.keys(menu));
console.log("modifiers count", (menu.modifiers || []).length);
console.log("products count", (menu.products || []).length);
if (menu.modifiers?.[0]) {
  console.log("modifier[0] keys", Object.keys(menu.modifiers[0]));
  console.log("modifier[0]", JSON.stringify(menu.modifiers[0], null, 2).slice(0, 2000));
}
if (menu.products?.[0]) {
  console.log("product[0] keys", Object.keys(menu.products[0]));
}

// Find egg in itemsGroups
let eggItem = null;
for (const g of menu.itemsGroups || []) {
  for (const item of g.items || []) {
    if (item.productId === targetId || String(item.name || "").includes("Яйцо куриное")) {
      eggItem = { category: g.name, item };
      break;
    }
  }
  if (eggItem) break;
}
console.log("egg in itemsGroups?", Boolean(eggItem));
if (eggItem) {
  writeFileSync("scripts/egg-item-dump.json", JSON.stringify(eggItem, null, 2));
  console.log("egg item keys", Object.keys(eggItem.item));
  console.log(JSON.stringify(eggItem.item, null, 2).slice(0, 4000));
}

// Find in products array
const eggProd = (menu.products || []).find(
  (p) => p.id === targetId || p.productId === targetId || String(p.name || "").includes("Яйцо куриное"),
);
console.log("egg in products?", Boolean(eggProd));
if (eggProd) {
  writeFileSync("scripts/egg-product-dump.json", JSON.stringify(eggProd, null, 2));
  console.log("egg product keys", Object.keys(eggProd));
  console.log(JSON.stringify(eggProd, null, 2).slice(0, 4000));
}

// Find modifier group
const modGroup = (menu.modifiers || []).find(
  (m) =>
    m.id === groupNeedle ||
    m.productId === groupNeedle ||
    m.itemGroupId === groupNeedle ||
    String(m.name || "").includes("завтрак"),
);
console.log("mod group?", Boolean(modGroup));
if (modGroup) {
  writeFileSync("scripts/mod-group-dump.json", JSON.stringify(modGroup, null, 2));
  console.log(JSON.stringify(modGroup, null, 2).slice(0, 4000));
}

// Search any node containing groupNeedle
const hits = [];
const walk = (node, path) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((x, i) => walk(x, `${path}[${i}]`));
    return;
  }
  const idish = [node.id, node.productId, itemGroupId(node), node.itemGroupId]
    .filter(Boolean)
    .map(String);
  if (idish.some((x) => x === groupNeedle || x === targetId)) {
    hits.push({ path, keys: Object.keys(node), name: node.name, idish });
  }
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === "object") walk(v, `${path}.${k}`);
  }
};
const itemGroupId = (n) => n.itemGroupId;
walk(menu, "menu");
console.log("id hits", hits.length);
console.log(JSON.stringify(hits.slice(0, 20), null, 2));

// Dump all unique keys under items that mention Modifier
const itemKeyFreq = new Map();
for (const g of menu.itemsGroups || []) {
  for (const item of g.items || []) {
    for (const k of Object.keys(item)) {
      itemKeyFreq.set(k, (itemKeyFreq.get(k) || 0) + 1);
    }
  }
}
console.log(
  "item key frequencies",
  [...itemKeyFreq.entries()].sort((a, b) => b[1] - a[1]),
);

writeFileSync(
  "scripts/menu-modifiers-array.json",
  JSON.stringify(menu.modifiers || [], null, 2),
);
console.log("wrote scripts/menu-modifiers-array.json");
