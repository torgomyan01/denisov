import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
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

// Use tsx-less approach: duplicate fetch like menu.ts
const base = (process.env.IIKO_API_BASE_URL || "https://api-ru.iiko.services").replace(
  /\/$/,
  "",
);
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
  await fetch(`${base}/api/2/menu`, { method: "POST", headers: auth, body: "{}" })
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

let required = 0;
let withAny = 0;
for (const g of menu.itemsGroups || []) {
  for (const item of g.items || []) {
    const groups = item.modifierGroups || [];
    if (!groups.length) continue;
    withAny += 1;
    if (groups.some((x) => (x.restrictions?.minQuantity ?? 0) >= 1)) {
      required += 1;
      if (required <= 5) {
        console.log(
          item.name,
          groups.map((x) => `${x.name} min=${x.restrictions?.minQuantity} opts=${(x.items||[]).length}`),
        );
      }
    }
  }
}
console.log({ withAny, required });
