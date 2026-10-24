import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const assetsDir = join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-User-Desktop-denisov",
  "assets",
);
const uploadsDir = join(process.cwd(), "public", "uploads");
mkdirSync(uploadsDir, { recursive: true });

const assetFiles = readdirSync(assetsDir).filter((f) =>
  /^dish-.*\.(jpg|jpeg|png|webp)$/i.test(f),
);

const items = await prisma.menuItem.findMany({
  where: { isActive: true },
  select: { id: true, name: true },
});

let updated = 0;
const missing = [];

for (const item of items) {
  const prefix = `dish-${item.id.slice(0, 8)}`;
  const match = assetFiles.find((f) => f.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!match) {
    missing.push({ id: item.id, name: item.name, prefix });
    continue;
  }
  const src = join(assetsDir, match);
  if (!existsSync(src)) {
    missing.push({ id: item.id, name: item.name, prefix });
    continue;
  }
  const ext = match.includes(".") ? match.slice(match.lastIndexOf(".")) : ".jpg";
  const destName = `menu-${item.id}-${Date.now()}${ext}`;
  const dest = join(uploadsDir, destName);
  copyFileSync(src, dest);
  const publicPath = `/uploads/${destName}`;
  await prisma.menuItem.update({
    where: { id: item.id },
    data: { image: publicPath },
  });
  updated += 1;
  console.log("OK", item.name, "→", publicPath);
}

console.log(JSON.stringify({ updated, missing, total: items.length }, null, 2));
await prisma.$disconnect();
