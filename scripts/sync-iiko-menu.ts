/**
 * Standalone cron script: pulls external menu from iiko Cloud and updates
 * MySQL `IikoMenuCache`. Next.js reads the updated cache automatically (within 60s).
 *
 * Usage:
 *   npm run iiko:sync-menu
 *
 * Linux crontab (every 10 min):
 *   *\/10 * * * * cd /path/to/denisov && npm run iiko:sync-menu >> /var/log/denisov-iiko-menu.log 2>&1
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getIikoCatalog } from "@/lib/iiko/catalog-cache";
import { prisma } from "@/lib/prisma";

const loadDotEnv = () => {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
};

const main = async () => {
  loadDotEnv();
  const started = new Date().toISOString();
  const result = await getIikoCatalog({ force: true });
  if (!result.ok) {
    console.error(`[${started}] iiko menu sync failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }
  const cats = result.catalog.stats?.categories ?? result.catalog.categories.length;
  const items =
    result.catalog.stats?.items ??
    result.catalog.categories.reduce((n, c) => n + c.items.length, 0);
  const inStopList = result.catalog.stats?.inStopList ?? 0;
  console.log(
    `[${started}] iiko menu synced: ${cats} categories, ${items} items, ${inStopList} in stop-list (menuId=${result.catalog.menuId})`,
  );
};

main()
  .catch((error) => {
    console.error("[iiko-menu-sync] fatal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
