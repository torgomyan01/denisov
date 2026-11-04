/**
 * Migrate OrderStatus enum values to iiko DeliveryStatus names.
 * Run before/with `npx prisma db push`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const map = {
  new: "Unconfirmed",
  confirmed: "WaitCooking",
  preparing: "CookingStarted",
  ready: "CookingCompleted",
  delivering: "OnWay",
  completed: "Closed",
  cancelled: "Cancelled",
};

const run = async () => {
  // Loosen columns so we can rewrite values under MySQL ENUM constraints.
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `Order` MODIFY COLUMN `status` VARCHAR(32) NOT NULL",
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `OrderStatusLog` MODIFY COLUMN `status` VARCHAR(32) NOT NULL",
  );

  for (const [from, to] of Object.entries(map)) {
    const orders = await prisma.$executeRawUnsafe(
      "UPDATE `Order` SET `status` = ? WHERE `status` = ?",
      to,
      from,
    );
    const logs = await prisma.$executeRawUnsafe(
      "UPDATE `OrderStatusLog` SET `status` = ? WHERE `status` = ?",
      to,
      from,
    );
    console.log(`${from} → ${to}`, { orders, logs });
  }

  console.log("Values migrated. Next: npx prisma db push && npx prisma generate");
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
