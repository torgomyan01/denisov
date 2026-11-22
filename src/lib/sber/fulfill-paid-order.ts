import {
  createIikoDeliveryOrder,
  syncIikoPaidOnline,
  type IikoCreateModifier,
} from "@/lib/iiko/create-delivery";
import { loadIikoDefaultModifiersByProductId } from "@/lib/iiko/catalog-cache";
import { isIikoConfigured } from "@/lib/iiko/config";
import { prisma } from "@/lib/prisma";
import { notifyCustomerOrderStatus } from "@/lib/web-push";
import type { OrderStatus } from "@/lib/orders";

const orderInclude = {
  items: true,
  statusLogs: { orderBy: { createdAt: "asc" as const } },
} as const;

const scheduleNotify = async (input: {
  customerId: string | null | undefined;
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
  fulfillmentMode: "pickup" | "delivery";
}): Promise<void> => {
  try {
    const { after } = await import("next/server");
    after(() => {
      void notifyCustomerOrderStatus(input);
    });
  } catch {
    void notifyCustomerOrderStatus(input);
  }
};

/**
 * Mark order paid after Sber confirmation.
 * iiko is created at place-order time; here we only backfill if create was skipped/failed.
 * Idempotent: safe to call from callback + return page.
 */
export const fulfillSberPaidOrder = async (
  orderId: string,
): Promise<{ ok: true; alreadyPaid: boolean } | { ok: false; error: string }> => {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!existing) return { ok: false, error: "Заказ не найден" };

  if (existing.paymentStatus === "paid") {
    return { ok: true, alreadyPaid: true };
  }
  if (existing.paymentStatus === "refunded") {
    return { ok: false, error: "Оплата уже возвращена" };
  }

  const now = new Date();
  // Conditional claim — prevents late callback from overwriting refunded→paid
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: { in: ["pending", "failed"] },
    },
    data: {
      paymentStatus: "paid",
      paidAt: now,
    },
  });
  if (claimed.count === 0) {
    const again = await prisma.order.findUnique({
      where: { id: orderId },
      select: { paymentStatus: true },
    });
    if (again?.paymentStatus === "paid") {
      return { ok: true, alreadyPaid: true };
    }
    if (again?.paymentStatus === "refunded") {
      return { ok: false, error: "Оплата уже возвращена" };
    }
    return { ok: false, error: "Не удалось подтвердить оплату" };
  }

  await prisma.orderStatusLog.create({
    data: {
      orderId,
      status: existing.status,
      note: "Оплата подтверждена (Sber)",
    },
  });

  let order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });

  if (isIikoConfigured()) {
    if (order.iikoOrderId) {
      // Order already in iiko (created while Sber was pending) — attach paid payment
      const paidSync = await syncIikoPaidOnline({
        iikoOrderId: order.iikoOrderId,
        sumRub: order.totalRub,
        comment: order.comment,
        utensils: order.utensils,
        fulfillmentMode: order.fulfillmentMode,
        deliveryCourierComment: order.deliveryCourierComment,
      });
      order = await prisma.order.update({
        where: { id: order.id },
        data: paidSync.ok
          ? {
              iikoSyncError: "",
              statusLogs: {
                create: {
                  status: order.status,
                  note: "iiko: оплата онлайн отмечена после Sber",
                },
              },
            }
          : {
              iikoSyncError: paidSync.error.slice(0, 500),
              statusLogs: {
                create: {
                  status: order.status,
                  note: `iiko: не удалось отметить оплату — ${paidSync.error}`.slice(
                    0,
                    255,
                  ),
                },
              },
            },
        include: orderInclude,
      });
    } else if (order.iikoCreationStatus !== "Success") {
      const defaultModifiersByProduct =
        await loadIikoDefaultModifiersByProductId();
      const iikoResult = await createIikoDeliveryOrder({
        orderNumber: order.number,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        fulfillmentMode: order.fulfillmentMode,
        comment: order.comment,
        utensils: order.utensils,
        totalRub: order.totalRub,
        deliveryFeeRub: order.deliveryFeeRub,
        paymentStatus: "paid",
        paymentMethod: order.paymentMethod || "sber",
        timeMode: order.timeMode,
        scheduledAt: order.scheduledAt,
        deliveryAddress: order.deliveryAddress,
        deliveryApartment: order.deliveryApartment,
        deliveryEntrance: order.deliveryEntrance,
        deliveryFloor: order.deliveryFloor,
        deliveryIntercom: order.deliveryIntercom,
        deliveryCourierComment: order.deliveryCourierComment,
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        items: order.items.map((line) => {
          let modifiers: IikoCreateModifier[] = [];
          try {
            const parsed = JSON.parse(line.modifiersJson || "[]") as unknown;
            if (Array.isArray(parsed)) {
              const collected: IikoCreateModifier[] = [];
              for (const raw of parsed) {
                if (!raw || typeof raw !== "object") continue;
                const row = raw as Record<string, unknown>;
                const productId = String(row.productId || "");
                const productGroupId = String(
                  row.groupId || row.productGroupId || "",
                );
                if (!productId) continue;
                collected.push({
                  productId,
                  productGroupId,
                  amount: Math.max(1, Number(row.amount) || 1),
                  name: String(row.name || ""),
                });
              }
              modifiers = collected;
            }
          } catch {
            modifiers = [];
          }
          if (!modifiers.length) {
            const defaults = defaultModifiersByProduct.get(line.productId) || [];
            modifiers = defaults.map((mod) => ({
              productId: mod.productId,
              productGroupId: mod.productGroupId,
              amount: mod.amount,
              name: mod.name,
            }));
          }
          return {
            productId: line.productId,
            name: line.name,
            iikoProductId: line.productId,
            price: line.price,
            qty: line.qty,
            ...(modifiers.length ? { modifiers } : {}),
          };
        }),
      });

      order = await prisma.order.update({
        where: { id: order.id },
        data: iikoResult.ok
          ? {
              iikoOrderId: iikoResult.iikoOrderId,
              iikoCorrelationId: iikoResult.correlationId || null,
              iikoCreationStatus: iikoResult.creationStatus,
              iikoSyncError: "",
              statusLogs: {
                create: {
                  status: order.status,
                  note: `iiko (досылка после оплаты): ${iikoResult.creationStatus}`,
                },
              },
            }
          : {
              iikoOrderId: iikoResult.iikoOrderId || null,
              iikoCorrelationId: iikoResult.correlationId || null,
              iikoCreationStatus: iikoResult.creationStatus || "Error",
              iikoSyncError: iikoResult.error.slice(0, 500),
              statusLogs: {
                create: {
                  status: order.status,
                  note: `iiko (досылка после оплаты): ${iikoResult.error}`.slice(
                    0,
                    255,
                  ),
                },
              },
            },
        include: orderInclude,
      });
    }
  }

  await scheduleNotify({
    customerId: order.customerId,
    status: order.status as OrderStatus,
    orderId: order.id,
    orderNumber: order.number,
    fulfillmentMode: order.fulfillmentMode,
  });

  return { ok: true, alreadyPaid: false };
};

export const markSberOrderFailed = async (
  orderId: string,
  note: string,
): Promise<void> => {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true, status: true },
  });
  if (
    !existing ||
    existing.paymentStatus === "paid" ||
    existing.paymentStatus === "refunded"
  ) {
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "failed",
      statusLogs: {
        create: {
          status: existing.status,
          note: note.slice(0, 255),
        },
      },
    },
  });
};

/** Mark local payment as refunded after Sber reverse/refund (idempotent). */
export const markSberOrderRefunded = async (
  orderId: string,
  note: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> => {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true, status: true },
  });
  if (!existing) return { ok: false, error: "Заказ не найден" };
  if (existing.paymentStatus === "refunded") {
    return { ok: true, already: true };
  }

  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: { not: "refunded" },
    },
    data: { paymentStatus: "refunded" },
  });
  if (claimed.count === 0) {
    return { ok: true, already: true };
  }

  await prisma.orderStatusLog.create({
    data: {
      orderId,
      status: existing.status,
      note: note.slice(0, 255),
    },
  });
  return { ok: true, already: false };
};
