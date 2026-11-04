import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();
const q = JSON.parse(readFileSync("scripts/iiko-gen-queue.json", "utf8"));
const ids = q.map((x) => x.productId);
const overrides = await prisma.iikoMenuOverride.findMany({
  where: { iikoProductId: { in: ids } },
});
const withImg = overrides.filter((o) => o.image);
const missing = ids.filter(
  (id) => !withImg.some((o) => o.iikoProductId === id),
);
console.log(
  "queue",
  q.length,
  "with image",
  withImg.length,
  "missing",
  missing.length,
);
if (missing.length) {
  console.log(missing.map((id) => q.find((x) => x.productId === id)?.name));
}
await prisma.$disconnect();
