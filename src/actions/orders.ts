"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCustomer, requireCustomer } from "@/lib/customer-auth";
import {
  clearCartItemsKeepingFulfillment,
  saveCustomerCart,
} from "@/lib/customer-cart";
import {
  deleteOrderSchema,
  placeOrderSchema,
  refundSberOrderSchema,
  retrySberPaymentSchema,
} from "@/lib/order-schema";
import {
  canRetryOnlinePayment,
  generateOrderNumber,
  rubFromPriceString,
  toOrderPublic,
  type OrderPublic,
  type OrderStatus,
} from "@/lib/orders";
import {
  calcDeliveryTotals,
  isPointInDeliveryZone,
} from "@/lib/delivery-pricing";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import { isIikoConfigured } from "@/lib/iiko/config";
import { autoRetryFailedIikoCreations } from "@/lib/iiko/auto-retry-create";
import {
  createIikoDeliveryOrderReliable,
  isIikoProductId,
  syncIikoOnlinePaymentComment,
  syncIikoPaidOnline,
  type IikoCreateModifier,
} from "@/lib/iiko/create-delivery";
import { loadIikoDefaultModifiersByProductId } from "@/lib/iiko/catalog-cache";
import { syncOpenOrdersFromIiko } from "@/lib/iiko/sync-status";
import { prisma } from "@/lib/prisma";
import { sberRefundOrReverseOrder, sberRegisterOrder } from "@/lib/sber/client";
import { isSberConfigured } from "@/lib/sber/config";
import { markSberOrderRefunded } from "@/lib/sber/fulfill-paid-order";
import { getSite } from "@/lib/site";
import { notifyCustomerOrderStatus } from "@/lib/web-push";
import type { ActionResult } from "@/types/site";

const orderInclude = {
  items: true,
  statusLogs: { orderBy: { createdAt: "asc" as const } },
} as const;

/** Keep Web Push alive after the Server Action response (prod). */
const scheduleCustomerOrderStatusNotify = async (input: {
  customerId: string | null | undefined;
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
  fulfillmentMode: OrderPublic["fulfillmentMode"];
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

export const placeOrderAction = async (
  input: unknown,
): Promise<ActionResult<{ order: OrderPublic; paymentUrl?: string }>> => {
  try {
    const customer = await requireCustomer();
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Проверьте данные заказа",
      };
    }

    const { cart, customerName, customerPhone, payment, deliveryDetails } =
      parsed.data;

    if (!cart.items.length) {
      return { success: false, error: "Корзина пуста" };
    }

    if (cart.fulfillmentMode === "pickup" && !cart.pickupPointId) {
      return { success: false, error: "Выберите точку самовывоза" };
    }

    if (
      cart.fulfillmentMode === "delivery" &&
      (cart.deliveryLat == null || cart.deliveryLng == null)
    ) {
      return { success: false, error: "Укажите адрес доставки на карте" };
    }

    if (cart.fulfillmentMode === "delivery" && !deliveryDetails?.apartment) {
      return { success: false, error: "Укажите квартиру или офис" };
    }

    const door = {
      apartment: (deliveryDetails?.apartment ?? "").slice(0, 64),
      entrance: (deliveryDetails?.entrance ?? "").slice(0, 64),
      floor: (deliveryDetails?.floor ?? "").slice(0, 32),
      intercom: (deliveryDetails?.intercom ?? "").slice(0, 64),
      courierComment: (deliveryDetails?.courierComment ?? "").slice(0, 500),
    };

    if (cart.timeMode === "scheduled" && !cart.scheduledAt) {
      return { success: false, error: "Выберите время получения" };
    }

    const isPrepaid = payment.method === "card";

    const site = await getSite();
    const deliverySettings =
      site.delivery ?? createDefaultDeliverySettings();

    if (!deliverySettings.ordersEnabled) {
      return {
        success: false,
        error: "Приём заказов временно приостановлен",
      };
    }

    const deliveryOnlyOnline =
      cart.fulfillmentMode === "delivery" &&
      deliverySettings.deliveryPayOnReceiptEnabled !== true;

    // External courier by default — on_receipt for delivery only if admin enables it.
    if (deliveryOnlyOnline && !isPrepaid) {
      return {
        success: false,
        error: "Доставка только с онлайн-оплатой",
      };
    }

    if (isPrepaid && !isSberConfigured()) {
      return {
        success: false,
        error: deliveryOnlyOnline
          ? "Онлайн-оплата временно недоступна. Доставка без предоплаты невозможна — попробуйте позже или выберите самовывоз."
          : "Онлайн-оплата временно недоступна. Выберите оплату при получении или попробуйте позже.",
      };
    }

    const menuById = new Map(
      (site.menu.categories || []).flatMap((category) =>
        (category.items || [])
          .filter((item) => item?.id)
          .map((item) => [item.id, item] as const),
      ),
    );
    for (const line of cart.items) {
      const menuItem = menuById.get(line.id);
      if (!menuItem) {
        return {
          success: false,
          error: `Блюдо «${line.name}» больше недоступно. Обновите корзину.`,
        };
      }
      if (menuItem.inStock === false) {
        return {
          success: false,
          error: `«${menuItem.name}» закончилось. Уберите из корзины.`,
        };
      }
      if (menuItem.showInDelivery === false) {
        return {
          success: false,
          error: `«${menuItem.name}» только в кафе и не оформляется в заказ.`,
        };
      }
    }

    let pickupPointName = "";
    let pickupPointAddress = "";
    if (cart.fulfillmentMode === "pickup" && cart.pickupPointId) {
      const point = await prisma.pickupPoint.findUnique({
        where: { id: cart.pickupPointId },
      });
      if (!point || !point.isActive) {
        return { success: false, error: "Точка самовывоза недоступна" };
      }
      pickupPointName = point.name;
      pickupPointAddress = point.address;
    }

    if (
      cart.fulfillmentMode === "delivery" &&
      cart.deliveryLat != null &&
      cart.deliveryLng != null &&
      !isPointInDeliveryZone(
        deliverySettings,
        cart.deliveryLat,
        cart.deliveryLng,
      )
    ) {
      return {
        success: false,
        error:
          "В эту зону доставки нет — выберите адрес внутри зоны или самовывоз",
      };
    }

    const itemsData = cart.items.map((line) => {
      const modifiers = (line.modifiers || []).map((mod) => ({
        groupId: mod.groupId,
        groupName: mod.groupName || "",
        productId: mod.productId,
        name: mod.name || "",
        amount: Math.max(1, Math.min(99, mod.amount || 1)),
      }));
      return {
        productId: line.id,
        name: line.name.slice(0, 255),
        price: String(line.price ?? "").slice(0, 64),
        image: String(line.image ?? "").slice(0, 500),
        categoryId: String(line.categoryId ?? "").slice(0, 64),
        categoryName: String(line.categoryName ?? "").slice(0, 255),
        qty: Math.max(1, Math.min(99, line.qty)),
        lineTotalRub: rubFromPriceString(line.price, line.qty),
        modifiersJson: JSON.stringify(modifiers).slice(0, 2000),
        modifiers,
      };
    });

    const iikoEnabled = isIikoConfigured();
    if (iikoEnabled) {
      for (const line of itemsData) {
        if (!isIikoProductId(line.productId)) {
          return {
            success: false,
            error: `«${line.name}» без корректного iiko productId`,
          };
        }
      }
    }

    const itemsSubtotal = itemsData.reduce(
      (sum, row) => sum + row.lineTotalRub,
      0,
    );
    const totals = calcDeliveryTotals(
      deliverySettings,
      itemsSubtotal,
      cart.fulfillmentMode,
      cart.deliveryLat != null && cart.deliveryLng != null
        ? { lat: cart.deliveryLat, lng: cart.deliveryLng }
        : null,
    );
    if (cart.fulfillmentMode === "delivery" && !totals.meetsMinimum) {
      return {
        success: false,
        error: `Минимальная сумма доставки — ${totals.minOrderAmount} ₽ (ещё ${totals.minRemainingRub} ₽)`,
      };
    }
    const totalRub = totals.totalRub;
    const deliveryFeeRub = totals.deliveryFeeRub;
    const scheduledAt =
      cart.timeMode === "scheduled" && cart.scheduledAt
        ? new Date(cart.scheduledAt)
        : null;
    const now = new Date();

    let order = await prisma.$transaction(async (tx) => {
      let number = generateOrderNumber();
      for (let i = 0; i < 5; i += 1) {
        const clash = await tx.order.findUnique({
          where: { number },
          select: { id: true },
        });
        if (!clash) break;
        number = generateOrderNumber();
      }

      const created = await tx.order.create({
        data: {
          number,
          customerId: customer.id,
          customerName: customerName.slice(0, 255),
          customerPhone: customerPhone.slice(0, 32),
          customerEmail: (customer.email ?? "").slice(0, 255),
          fulfillmentMode: cart.fulfillmentMode,
          status: "Unconfirmed",
          paymentStatus: "pending",
          paymentMethod: isPrepaid ? "sber" : "on_receipt",
          totalRub,
          deliveryFeeRub,
          utensils: cart.utensils,
          comment: cart.comment.slice(0, 500),
          pickupPointId: cart.pickupPointId,
          pickupPointName,
          pickupPointAddress,
          deliveryAddress: cart.deliveryAddress.slice(0, 500),
          deliveryApartment: door.apartment,
          deliveryEntrance: door.entrance,
          deliveryFloor: door.floor,
          deliveryIntercom: door.intercom,
          deliveryCourierComment: door.courierComment,
          deliveryLat: cart.deliveryLat,
          deliveryLng: cart.deliveryLng,
          timeMode: cart.timeMode,
          scheduledAt:
            scheduledAt && !Number.isNaN(scheduledAt.getTime())
              ? scheduledAt
              : null,
          paidAt: null,
          statusUpdatedAt: now,
          items: {
            create: itemsData.map(({ modifiers, ...row }) => {
              void modifiers;
              return row;
            }),
          },
          statusLogs: {
            create: {
              status: "Unconfirmed",
              note: isPrepaid
                ? "Заказ создан, ожидает оплаты Sber"
                : "Заказ оформлен (оплата при получении)",
            },
          },
        },
        include: orderInclude,
      });

      return created;
    });

    let paymentUrl: string | undefined;

    if (isPrepaid) {
      const registered = await sberRegisterOrder({
        orderNumber: order.number,
        amountRub: order.totalRub,
        description: `Заказ ${order.number} - ДЕНИСОВ`,
        customerEmail: order.customerEmail || undefined,
        customerPhone: order.customerPhone,
      });

      if (!registered.ok) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "failed",
            status: "Cancelled",
            statusLogs: {
              create: {
                status: "Cancelled",
                note: `Оплата не создана: ${registered.error}`.slice(0, 255),
              },
            },
          },
        });
        return {
          success: false,
          error: `Не удалось начать оплату: ${registered.error}`,
        };
      }

      order = await prisma.order.update({
        where: { id: order.id },
        data: {
          sberOrderId: registered.orderId,
          sberFormUrl: registered.formUrl.slice(0, 1000),
          statusLogs: {
            create: {
              status: "Unconfirmed",
              note: "Ссылка на оплату Sber создана",
            },
          },
        },
        include: orderInclude,
      });
      paymentUrl = registered.formUrl;
    }

    // Все заказы (в т.ч. Sber pending) сразу уходят в iiko — кухня видит их до оплаты.
    let orderWithIiko = order;

    if (iikoEnabled) {
      const defaultModifiersByProduct =
        await loadIikoDefaultModifiersByProductId();
      const iikoResult = await createIikoDeliveryOrderReliable({
        orderNumber: order.number,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        fulfillmentMode: order.fulfillmentMode,
        comment: order.comment,
        utensils: order.utensils,
        totalRub: order.totalRub,
        deliveryFeeRub: order.deliveryFeeRub,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
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
        items: itemsData.map((line) => {
          const fromCart: IikoCreateModifier[] = (line.modifiers || []).map(
            (mod) => ({
              productId: mod.productId,
              productGroupId: mod.groupId,
              amount: mod.amount,
              name: mod.name,
            }),
          );
          const defaults = defaultModifiersByProduct.get(line.productId) || [];
          const fallback: IikoCreateModifier[] = defaults.map((mod) => ({
            productId: mod.productId,
            productGroupId: mod.productGroupId,
            amount: mod.amount,
            name: mod.name,
          }));
          const modifiers = fromCart.length ? fromCart : fallback;
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

      orderWithIiko = await prisma.order.update({
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
                  note: `Отправлено в iiko (${iikoResult.creationStatus}, попыток: ${iikoResult.attempts})`,
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
                  note: `iiko: ${iikoResult.error} (попыток: ${iikoResult.attempts})`.slice(
                    0,
                    255,
                  ),
                },
              },
            },
        include: orderInclude,
      });
    }

    if (cart.fulfillmentMode === "delivery") {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          deliveryApartment: door.apartment || null,
          deliveryEntrance: door.entrance || null,
          deliveryFloor: door.floor || null,
          deliveryIntercom: door.intercom || null,
          deliveryCourierComment: door.courierComment || null,
        },
      });
    }

    await saveCustomerCart(
      customer.id,
      clearCartItemsKeepingFulfillment(cart),
    );

    const orderPublic = toOrderPublic(orderWithIiko);

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/profile");
    revalidatePath("/profile/orders");

    return {
      success: true,
      data: {
        order: orderPublic,
        ...(paymentUrl ? { paymentUrl } : {}),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthorized") {
      return {
        success: false,
        error: "Не удалось оформить заказ. Войдите в аккаунт и попробуйте снова.",
      };
    }
    console.error("placeOrderAction failed:", error);
    return {
      success: false,
      error:
        message && !message.includes("Invalid `")
          ? message
          : "Не удалось оформить заказ. Попробуйте ещё раз.",
    };
  }
};

const notifySyncedStatusChanges = async (
  syncResults: Awaited<ReturnType<typeof syncOpenOrdersFromIiko>>,
): Promise<void> => {
  for (const row of syncResults) {
    if (!row.statusChanged) continue;
    await scheduleCustomerOrderStatusNotify({
      customerId: row.customerId,
      status: row.status,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      fulfillmentMode: row.fulfillmentMode,
    });
  }
};

/** Pull open-order statuses from iiko into the local DB (admin / customer views). */
export const syncOrdersFromIikoAction = async (input?: {
  orderId?: string;
}): Promise<ActionResult<{ updated: number }>> => {
  try {
    await requireAuth();
    if (!isIikoConfigured()) {
      return { success: true, data: { updated: 0 } };
    }
    const syncResults = await syncOpenOrdersFromIiko(
      input?.orderId ? { localOrderIds: [input.orderId] } : undefined,
    );
    await notifySyncedStatusChanges(syncResults);
    const autoRetries = await autoRetryFailedIikoCreations();
    const updated =
      syncResults.filter((row) => row.changed).length +
      autoRetries.filter((row) => row.retried).length;
    if (updated > 0) {
      revalidatePath("/admin");
      revalidatePath("/profile/orders");
    }
    return { success: true, data: { updated } };
  } catch {
    return { success: false, error: "Не удалось синхронизировать статусы iiko" };
  }
};

/** Shared throttle so many open tabs don't hammer iiko. */
let lastPublicIikoSyncAtMs = 0;
const PUBLIC_IIKO_SYNC_MIN_GAP_MS = 25_000;

/**
 * Public site-wide sync of open delivery statuses from iiko.
 * Works for guests and logged-in customers (no order data returned).
 * Throttled ~25s across all callers in this process.
 */
export const syncOpenSiteOrdersFromIikoAction = async (): Promise<
  ActionResult<{ updated: number; throttled: boolean }>
> => {
  try {
    if (!isIikoConfigured()) {
      return { success: true, data: { updated: 0, throttled: false } };
    }

    const now = Date.now();
    if (now - lastPublicIikoSyncAtMs < PUBLIC_IIKO_SYNC_MIN_GAP_MS) {
      return { success: true, data: { updated: 0, throttled: true } };
    }
    lastPublicIikoSyncAtMs = now;

    const syncResults = await syncOpenOrdersFromIiko({ take: 80 });
    await notifySyncedStatusChanges(syncResults);
    const autoRetries = await autoRetryFailedIikoCreations();
    const updated =
      syncResults.filter((row) => row.changed).length +
      autoRetries.filter((row) => row.retried).length;
    if (updated > 0) {
      revalidatePath("/profile");
      revalidatePath("/profile/orders");
      revalidatePath("/admin");
    }
    return { success: true, data: { updated, throttled: false } };
  } catch {
    return { success: false, error: "Не удалось синхронизировать статусы" };
  }
};

/** Resend a local order to iiko if create previously failed. */
export const retryIikoOrderSyncAction = async (
  orderId: string,
): Promise<ActionResult<OrderPublic>> => {
  try {
    await requireAuth();
    if (!isIikoConfigured()) {
      return { success: false, error: "iiko не настроен" };
    }
    if (!orderId?.trim()) {
      return { success: false, error: "Заказ не найден" };
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!existing) {
      return { success: false, error: "Заказ не найден" };
    }
    // Already in iiko: if Sber paid but payment block missing — push payments now
    if (existing.iikoOrderId && existing.iikoCreationStatus === "Success") {
      if (
        existing.paymentMethod === "sber" &&
        existing.paymentStatus === "paid"
      ) {
        const paidSync = await syncIikoPaidOnline({
          iikoOrderId: existing.iikoOrderId,
          sumRub: existing.totalRub,
          comment: existing.comment,
          utensils: existing.utensils,
          fulfillmentMode: existing.fulfillmentMode,
          deliveryCourierComment: existing.deliveryCourierComment,
        });
        const updated = await prisma.order.update({
          where: { id: existing.id },
          data: paidSync.ok
            ? {
                iikoSyncError: "",
                statusLogs: {
                  create: {
                    status: existing.status,
                    note: "iiko: оплата онлайн дослана вручную",
                  },
                },
              }
            : {
                iikoSyncError: paidSync.error.slice(0, 500),
                statusLogs: {
                  create: {
                    status: existing.status,
                    note: `iiko: досылка оплаты — ${paidSync.error}`.slice(
                      0,
                      255,
                    ),
                  },
                },
              },
          include: orderInclude,
        });
        revalidatePath("/admin");
        if (!paidSync.ok) {
          return { success: false, error: paidSync.error };
        }
        return { success: true, data: toOrderPublic(updated) };
      }
      return { success: true, data: toOrderPublic(existing) };
    }

    for (const line of existing.items) {
      if (!isIikoProductId(line.productId)) {
        return {
          success: false,
          error: `«${line.name}» без корректного iiko productId`,
        };
      }
    }

    const defaultModifiersByProduct =
      await loadIikoDefaultModifiersByProductId();
    const parseStoredModifiers = (
      raw: string | null | undefined,
    ): IikoCreateModifier[] => {
      if (!raw?.trim()) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const out: IikoCreateModifier[] = [];
        for (const row of parsed) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          const productId = typeof r.productId === "string" ? r.productId : "";
          const groupId =
            typeof r.groupId === "string"
              ? r.groupId
              : typeof r.productGroupId === "string"
                ? r.productGroupId
                : "";
          if (!productId || !groupId) continue;
          out.push({
            productId,
            productGroupId: groupId,
            amount:
              typeof r.amount === "number" && Number.isFinite(r.amount)
                ? Math.max(1, Math.round(r.amount))
                : 1,
            name: typeof r.name === "string" ? r.name : "",
          });
        }
        return out;
      } catch {
        return [];
      }
    };
    const iikoResult = await createIikoDeliveryOrderReliable({
      orderNumber: existing.number,
      customerName: existing.customerName,
      customerPhone: existing.customerPhone,
      customerEmail: existing.customerEmail,
      fulfillmentMode: existing.fulfillmentMode,
      comment: existing.comment,
      utensils: existing.utensils,
      totalRub: existing.totalRub,
      deliveryFeeRub: existing.deliveryFeeRub,
      paymentStatus: existing.paymentStatus as
        | "pending"
        | "paid"
        | "failed"
        | "refunded",
      paymentMethod: existing.paymentMethod,
      timeMode: existing.timeMode,
      scheduledAt: existing.scheduledAt,
      deliveryAddress: existing.deliveryAddress,
      deliveryApartment: existing.deliveryApartment,
      deliveryEntrance: existing.deliveryEntrance,
      deliveryFloor: existing.deliveryFloor,
      deliveryIntercom: existing.deliveryIntercom,
      deliveryCourierComment: existing.deliveryCourierComment,
      deliveryLat: existing.deliveryLat,
      deliveryLng: existing.deliveryLng,
      items: existing.items.map((line) => {
        const stored = parseStoredModifiers(
          "modifiersJson" in line
            ? String((line as { modifiersJson?: string }).modifiersJson ?? "")
            : "",
        );
        const defaults = defaultModifiersByProduct.get(line.productId) || [];
        const fallback: IikoCreateModifier[] = defaults.map((mod) => ({
          productId: mod.productId,
          productGroupId: mod.productGroupId,
          amount: mod.amount,
          name: mod.name,
        }));
        const modifiers = stored.length ? stored : fallback;
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

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: iikoResult.ok
        ? {
            iikoOrderId: iikoResult.iikoOrderId,
            iikoCorrelationId: iikoResult.correlationId || null,
            iikoCreationStatus: iikoResult.creationStatus,
            iikoSyncError: "",
            statusLogs: {
              create: {
                status: existing.status,
                note: `Повторно отправлено в iiko (${iikoResult.creationStatus}, попыток: ${iikoResult.attempts})`,
              },
            },
          }
        : {
            iikoOrderId: iikoResult.iikoOrderId || existing.iikoOrderId,
            iikoCorrelationId:
              iikoResult.correlationId || existing.iikoCorrelationId,
            iikoCreationStatus: iikoResult.creationStatus || "Error",
            iikoSyncError: iikoResult.error.slice(0, 500),
            statusLogs: {
              create: {
                status: existing.status,
                note: `iiko retry: ${iikoResult.error} (попыток: ${iikoResult.attempts})`.slice(
                  0,
                  255,
                ),
              },
            },
          },
      include: orderInclude,
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/orders/${existing.id}`);
    return { success: true, data: toOrderPublic(updated) };
  } catch {
    return { success: false, error: "Не удалось отправить заказ в iiko" };
  }
};

export const listOrdersAdminAction = async (): Promise<
  ActionResult<OrderPublic[]>
> => {
  try {
    await requireAuth();
    if (isIikoConfigured()) {
      const syncResults = await syncOpenOrdersFromIiko();
      await notifySyncedStatusChanges(syncResults);
    }
    const rows = await prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { success: true, data: rows.map(toOrderPublic) };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

export const listMyOrdersAction = async (): Promise<
  ActionResult<OrderPublic[]>
> => {
  try {
    const customer = await getCustomer();
    if (!customer) {
      return { success: false, error: "Войдите в аккаунт" };
    }
    if (isIikoConfigured()) {
      const open = await prisma.order.findMany({
        where: {
          customerId: customer.id,
          iikoOrderId: { not: null },
          status: { notIn: ["Closed", "Cancelled"] },
        },
        select: { id: true },
        take: 30,
      });
      if (open.length) {
        const syncResults = await syncOpenOrdersFromIiko({
          localOrderIds: open.map((row) => row.id),
        });
        await notifySyncedStatusChanges(
          syncResults.filter((row) => row.customerId === customer.id),
        );
      }
    }
    const rows = await prisma.order.findMany({
      where: { customerId: customer.id },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { success: true, data: rows.map(toOrderPublic) };
  } catch {
    return { success: false, error: "Не удалось загрузить заказы" };
  }
};

export const getMyOrderAction = async (
  orderId: string,
): Promise<ActionResult<OrderPublic>> => {
  try {
    const customer = await requireCustomer();
    if (!orderId?.trim()) {
      return { success: false, error: "Заказ не найден" };
    }
    if (isIikoConfigured()) {
      const syncResults = await syncOpenOrdersFromIiko({
        localOrderIds: [orderId],
      });
      await notifySyncedStatusChanges(
        syncResults.filter((row) => row.customerId === customer.id),
      );
    }
    const row = await prisma.order.findFirst({
      where: { id: orderId, customerId: customer.id },
      include: orderInclude,
    });
    if (!row) {
      return { success: false, error: "Заказ не найден" };
    }
    return { success: true, data: toOrderPublic(row) };
  } catch {
    return { success: false, error: "Войдите, чтобы увидеть заказ" };
  }
};

/**
 * Create a new Sber payment link for an unpaid online order (same site order).
 * Updates iiko comment to «ожидает повторной оплаты» when applicable.
 */
export const retrySberPaymentAction = async (
  input: unknown,
): Promise<ActionResult<{ paymentUrl: string; order: OrderPublic }>> => {
  try {
    const customer = await requireCustomer();
    const parsed = retrySberPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Заказ не найден" };
    }
    if (!isSberConfigured()) {
      return {
        success: false,
        error: "Онлайн-оплата временно недоступна. Попробуйте позже.",
      };
    }

    const existing = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, customerId: customer.id },
      include: orderInclude,
    });
    if (!existing) {
      return { success: false, error: "Заказ не найден" };
    }
    if (!canRetryOnlinePayment(existing)) {
      return {
        success: false,
        error:
          existing.paymentStatus === "paid"
            ? "Заказ уже оплачен"
            : "Повторная оплата для этого заказа недоступна",
      };
    }

    // Sber requires a unique orderNumber per register — append retry suffix.
    const sberOrderNumber = `${existing.number}-P${Date.now().toString(36)}`.slice(
      0,
      36,
    );
    const registered = await sberRegisterOrder({
      orderNumber: sberOrderNumber,
      amountRub: existing.totalRub,
      description: `Заказ ${existing.number} - ДЕНИСОВ (повтор)`,
      customerEmail: existing.customerEmail || undefined,
      customerPhone: existing.customerPhone,
    });
    if (!registered.ok) {
      return {
        success: false,
        error: `Не удалось создать оплату: ${registered.error}`,
      };
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        paymentStatus: "pending",
        sberOrderId: registered.orderId,
        sberFormUrl: registered.formUrl.slice(0, 1000),
        statusLogs: {
          create: {
            status: existing.status,
            note: "Новая ссылка на оплату Sber (повтор)",
          },
        },
      },
      include: orderInclude,
    });

    if (updated.iikoOrderId && isIikoConfigured()) {
      const commentSync = await syncIikoOnlinePaymentComment({
        iikoOrderId: updated.iikoOrderId,
        comment: updated.comment,
        utensils: updated.utensils,
        fulfillmentMode: updated.fulfillmentMode,
        paymentStatus: "pending",
        deliveryCourierComment: updated.deliveryCourierComment,
      });
      if (!commentSync.ok) {
        await prisma.order.update({
          where: { id: updated.id },
          data: { iikoSyncError: commentSync.error.slice(0, 500) },
        });
      } else {
        await prisma.order.update({
          where: { id: updated.id },
          data: {
            iikoSyncError: "",
            statusLogs: {
              create: {
                status: updated.status,
                note: "iiko: комментарий — ожидает онлайн-оплаты",
              },
            },
          },
        });
      }
    }

    const fresh = await prisma.order.findUniqueOrThrow({
      where: { id: updated.id },
      include: orderInclude,
    });

    return {
      success: true,
      data: {
        paymentUrl: registered.formUrl,
        order: toOrderPublic(fresh),
      },
    };
  } catch {
    return {
      success: false,
      error: "Не удалось начать оплату. Войдите и попробуйте снова.",
    };
  }
};

export const countNewOrdersAdminAction = async (): Promise<
  ActionResult<{ count: number }>
> => {
  try {
    await requireAuth();
    const count = await prisma.order.count({
      where: { status: "Unconfirmed" },
    });
    return { success: true, data: { count } };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

export const getOrderAdminAction = async (
  orderId: string,
): Promise<ActionResult<OrderPublic>> => {
  try {
    await requireAuth();
    if (!orderId?.trim()) {
      return { success: false, error: "Заказ не найден" };
    }
    if (isIikoConfigured()) {
      const syncResults = await syncOpenOrdersFromIiko({
        localOrderIds: [orderId],
      });
      await notifySyncedStatusChanges(syncResults);
    }
    const row = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!row) {
      return { success: false, error: "Заказ не найден" };
    }
    return { success: true, data: toOrderPublic(row) };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

/** Statuses are driven by iiko — manual admin changes are disabled. */
export const updateOrderStatusAction = async (
  input: unknown,
): Promise<ActionResult<OrderPublic>> => {
  void input;
  return {
    success: false,
    error: "Статус меняется только в iiko. Обновите заказ — подтянем оттуда.",
  };
};

/**
 * Full card refund via Sber (refund.do / reverse.do).
 * Site admin only — cancelling in iiko does not return money.
 */
export const refundSberOrderAdminAction = async (
  input: unknown,
): Promise<ActionResult<OrderPublic>> => {
  try {
    await requireAuth();
    const parsed = refundSberOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    if (!isSberConfigured()) {
      return { success: false, error: "Sber эквайринг не настроен (.env)" };
    }

    const existing = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: orderInclude,
    });
    if (!existing) {
      return { success: false, error: "Заказ не найден" };
    }

    if (existing.paymentMethod !== "sber") {
      return {
        success: false,
        error: "Возврат через API только для онлайн-оплаты Sber",
      };
    }
    if (existing.paymentStatus === "refunded") {
      return { success: true, data: toOrderPublic(existing) };
    }
    if (existing.paymentStatus !== "paid") {
      return {
        success: false,
        error: "Возврат доступен только для оплаченного заказа",
      };
    }
    if (!existing.sberOrderId) {
      return { success: false, error: "Нет ID оплаты Sber у заказа" };
    }

    const gateway = await sberRefundOrReverseOrder({
      sberOrderId: existing.sberOrderId,
      amountRub: existing.totalRub,
    });
    if (!gateway.ok) {
      return { success: false, error: gateway.error };
    }

    const methodLabel =
      gateway.method === "reverse"
        ? "отмена (reverse)"
        : gateway.method === "refund"
          ? "возврат (refund)"
          : "уже возвращено в Sber";
    await markSberOrderRefunded(
      existing.id,
      `Возврат на карту из админки: ${methodLabel}`,
    );

    const updated = await prisma.order.findUnique({
      where: { id: existing.id },
      include: orderInclude,
    });
    if (!updated) {
      return { success: false, error: "Заказ не найден после возврата" };
    }

    revalidatePath("/admin");
    revalidatePath("/profile");
    revalidatePath("/profile/orders");
    return { success: true, data: toOrderPublic(updated) };
  } catch {
    return { success: false, error: "Не удалось выполнить возврат" };
  }
};

/** Removes the order from the site DB only — does not cancel it in iiko. */
export const deleteOrderAdminAction = async (
  input: unknown,
): Promise<ActionResult<{ id: string }>> => {
  try {
    await requireAuth();
    const parsed = deleteOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const existing = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    });
    if (!existing) {
      return { success: false, error: "Заказ не найден" };
    }

    if (
      existing.paymentMethod === "sber" &&
      existing.paymentStatus === "paid"
    ) {
      return {
        success: false,
        error:
          "Сначала верните оплату на карту (кнопка в карточке заказа), затем удаляйте",
      };
    }

    await prisma.order.delete({ where: { id: existing.id } });

    revalidatePath("/admin");
    revalidatePath("/profile");
    revalidatePath("/profile/orders");
    return { success: true, data: { id: existing.id } };
  } catch {
    return { success: false, error: "Не удалось удалить заказ" };
  }
};
