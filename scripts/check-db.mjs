import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRaw`
    SELECT USER() AS u, CURRENT_USER() AS cu, @@hostname AS h, DATABASE() AS db
  `;
  console.log("OK", rows);
} catch (error) {
  console.error("ERR:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
