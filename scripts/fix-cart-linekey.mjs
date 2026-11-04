import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.$executeRawUnsafe(`
  UPDATE CustomerCartItem
  SET lineKey = productId
  WHERE lineKey IS NULL OR lineKey = ''
`);

// Collapse duplicate (cartId, lineKey) by keeping highest qty row
const dups = await prisma.$queryRawUnsafe(`
  SELECT cartId, lineKey, COUNT(*) AS c
  FROM CustomerCartItem
  GROUP BY cartId, lineKey
  HAVING c > 1
`);

for (const row of dups) {
  const items = await prisma.customerCartItem.findMany({
    where: { cartId: row.cartId, lineKey: row.lineKey },
    orderBy: { qty: "desc" },
  });
  const [keep, ...rest] = items;
  if (!keep) continue;
  const qty = Math.min(
    99,
    items.reduce((sum, item) => sum + item.qty, 0),
  );
  await prisma.customerCartItem.update({
    where: { id: keep.id },
    data: { qty },
  });
  if (rest.length) {
    await prisma.customerCartItem.deleteMany({
      where: { id: { in: rest.map((item) => item.id) } },
    });
  }
}

console.log("fixed cart lineKeys, dups processed:", dups.length);
await prisma.$disconnect();
