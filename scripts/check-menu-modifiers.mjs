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

const { loadMergedIikoMenu } = await import("../src/lib/iiko/site-menu.ts").catch(
  async () => {
    // fallback via compiled path isn't available; use fetch like probe
    return { loadMergedIikoMenu: null };
  },
);

if (!loadMergedIikoMenu) {
  console.log("direct import failed, using raw fetch");
  process.exit(0);
}

const result = await loadMergedIikoMenu();
const withMods = result.categories.flatMap((c) =>
  c.items
    .filter((i) => (i.modifierGroups || []).some((g) => g.minQuantity >= 1))
    .map((i) => ({
      name: i.name,
      groups: i.modifierGroups.map((g) => ({
        name: g.name,
        min: g.minQuantity,
        opts: g.options.length,
      })),
    })),
);
console.log("required modifier items", withMods.length);
console.log(JSON.stringify(withMods.slice(0, 8), null, 2));
