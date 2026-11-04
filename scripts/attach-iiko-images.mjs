/**
 * Copy generated images into storage/uploads and upsert IikoMenuOverride.image
 * Usage: node scripts/attach-iiko-images.mjs mappings.json
 * mappings.json: [{ "productId": "uuid", "source": "C:/path/to.jpg" }, ...]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { basename, extname, join } from "path";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

const mappingsPath = process.argv[2];
if (!mappingsPath || !existsSync(mappingsPath)) {
  console.error("Usage: node scripts/attach-iiko-images.mjs mappings.json");
  process.exit(1);
}

const mappings = JSON.parse(readFileSync(mappingsPath, "utf8"));
const uploadsDir = join(process.cwd(), "storage", "uploads");
mkdirSync(uploadsDir, { recursive: true });

const prisma = new PrismaClient();

let ok = 0;
for (const row of mappings) {
  const { productId, source } = row;
  if (!productId || !source || !existsSync(source)) {
    console.error("SKIP missing", row);
    continue;
  }
  const ext = extname(source).toLowerCase() || ".jpg";
  const filename = `upload-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  const dest = join(uploadsDir, filename);
  copyFileSync(source, dest);
  const publicPath = `/uploads/${filename}`;

  await prisma.iikoMenuOverride.upsert({
    where: { iikoProductId: productId },
    create: { iikoProductId: productId, image: publicPath },
    update: { image: publicPath },
  });
  console.log("OK", productId.slice(0, 8), basename(source), "->", publicPath);
  ok += 1;
}

await prisma.$disconnect();
console.log("attached", ok);
