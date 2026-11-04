import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(".env"), "utf8").split(/\r?\n/)) {
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

const modName = new Map((menu.modifiers || []).map((m) => [m.id, m.name]));
const rows = [];

for (const cat of menu.itemsGroups || []) {
  for (const item of cat.items || []) {
    const groups = (item.modifierGroups || []).filter(
      (g) => Number(g.restrictions?.minQuantity ?? 0) >= 1,
    );
    if (!groups.length) continue;
    rows.push({
      category: cat.name,
      product: item.name,
      choices: groups.map((g) => {
        const opts = (g.items || [])
          .map((c) => {
            const raw = modName.get(c.id) || c.id;
            return String(raw).replace(/^[-–—\s]+/, "").trim() || raw;
          })
          .join(" / ");
        return `${g.name.replace(/:\s*$/, "")}: ${opts}`;
      }),
    });
  }
}

console.log(`Обязательный выбор: ${rows.length} позиций\n`);
for (const row of rows) {
  console.log(`• [${row.category}] ${row.product}`);
  for (const line of row.choices) console.log(`    — ${line}`);
}
