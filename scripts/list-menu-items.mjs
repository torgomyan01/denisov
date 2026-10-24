import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.menuItem.findMany({
  where: { isActive: true },
  orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  select: {
    id: true,
    name: true,
    description: true,
    image: true,
    category: { select: { name: true } },
  },
});

console.log(
  JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      desc: (r.description || "").slice(0, 140),
      cat: r.category.name,
      hasImage: Boolean(r.image),
      image: r.image || "",
    })),
    null,
    2,
  ),
);
console.log("COUNT", rows.length);
await prisma.$disconnect();
