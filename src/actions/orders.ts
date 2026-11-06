"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCustomer, requireCustomer } from "@/lib/customer-auth";
import {
  clearCartItemsKeepingFulfillment,
  saveCustomerCart,
} from "@/lib/customer-cart";
import { deleteOrderSchema, placeOrderSchema } from "@/lib/order-schema";
import {
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
import {
  createIikoDeliveryOrder,
  isIikoProductId,
  type IikoCreateModifier,
} from "@/lib/iiko/create-delivery";
import { loadIikoDefaultModifiersByProductId } from "@/lib/iiko/menu";
import { syncOpenOrdersFromIiko } from "@/lib/iiko/sync-status";
import { prisma } from "@/lib/prisma";
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
): Promise<ActionResult<{ order: OrderPublic }>> => {
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
    // Prepaid card is still a test stub — accept any well-formed card; no charge.
    if (isPrepaid) void payment;

    const site = await getSite();
    const deliverySettings =
      site.delivery ?? createDefaultDeliverySettings();

    if (!deliverySettings.ordersEnabled) {
      return {
        success: false,
        error: "Приём заказов временно приостановлен",
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
        error: "Сюда пока не доставляем, можно забрать самовывозом",
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
    );
    if (cart.fulfillmentMode === "delivery" && !totals.meetsMinimum) {
      return {
        success: false,
        error: `Минимальная сумма доставки — ${deliverySettings.minOrderAmount} ₽ (ещё ${totals.minRemainingRub} ₽)`,
      };
    }
    const totalRub = totals.totalRub;
    const deliveryFeeRub = totals.deliveryFeeRub;
    const scheduledAt =
      cart.timeMode === "scheduled" && cart.scheduledAt
        ? new Date(cart.scheduledAt)
        : null;
    const now = new Date();

    const order = await prisma.$transaction(async (tx) => {
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
          paymentStatus: isPrepaid ? "paid" : "pending",
          paymentMethod: isPrepaid ? "card_test" : "on_receipt",
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
          paidAt: isPrepaid ? now : null,
          statusUpdatedAt: now,
          items: {
            create: itemsData.map(
              ({ modifiers: _mods, ...row }) => row,
            ),
          },
          statusLogs: {
            create: {
              status: "Unconfirmed",
              note: isPrepaid
                ? "Заказ оформлен (оплата онлайн, тест)"
                : "Заказ оформлен (оплата при получении)",
            },
          },
        },
        include: orderInclude,
      });

      return created;
    });

    let orderWithIiko = order;

    if (iikoEnabled) {
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
        paymentStatus: order.paymentStatus,
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
                  note: `Отправлено в iiko (${iikoResult.creationStatus})`,
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
                  note: `iiko: ${iikoResult.error}`.slice(0, 255),
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

    return { success: true, data: { order: orderPublic } };
  } catch {
    return {
      success: false,
      error: "Не удалось оформить заказ. Войдите в аккаунт и попробуйте снова.",
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
    const updated = syncResults.filter((row) => row.changed).length;
    if (updated > 0) {
      revalidatePath("/admin");
      revalidatePath("/profile/orders");
    }
    return { success: true, data: { updated } };
  } catch {
    return { success: false, error: "Не удалось синхронизировать статусы iiko" };
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
    if (existing.iikoOrderId && existing.iikoCreationStatus === "Success") {
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
    const iikoResult = await createIikoDeliveryOrder({
      orderNumber: existing.number,
      customerName: existing.customerName,
      customerPhone: existing.customerPhone,
      customerEmail: existing.customerEmail,
      fulfillmentMode: existing.fulfillmentMode,
      comment: existing.comment,
      utensils: existing.utensils,
      totalRub: existing.totalRub,
      deliveryFeeRub: existing.deliveryFeeRub,
      paymentStatus: existing.paymentStatus as "pending" | "paid" | "failed",
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
                note: `Повторно отправлено в iiko (${iikoResult.creationStatus})`,
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
                note: `iiko retry: ${iikoResult.error}`.slice(0, 255),
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
  _input: unknown,
): Promise<ActionResult<OrderPublic>> => {
  return {
    success: false,
    error: "Статус меняется только в iiko. Обновите заказ — подтянем оттуда.",
  };
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
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Заказ не найден" };
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
