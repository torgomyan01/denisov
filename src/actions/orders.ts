"use server";

import { revalidatePath } from "next/cache";
import { getSession, requireAuth } from "@/lib/auth";
import {
  getCustomer,
  requireCustomer,
  type CustomerPublic,
} from "@/lib/customer-auth";
import {
  clearCartItemsKeepingFulfillment,
  saveCustomerCart,
} from "@/lib/customer-cart";
import {
  placeOrderSchema,
  updateOrderStatusSchema,
  verifyOrderFulfillmentSchema,
} from "@/lib/order-schema";
import {
  canFulfillOrderByQr,
  generateFulfillmentToken,
  generateOrderNumber,
  nextOrderStatuses,
  parseFulfillmentQrPayload,
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
import { prisma } from "@/lib/prisma";
import { getSite } from "@/lib/site";
import type { ActionResult } from "@/types/site";

const orderInclude = {
  items: true,
  statusLogs: { orderBy: { createdAt: "asc" as const } },
} as const;

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

    // Test payment stub — accept any well-formed card; no charge.
    void payment;

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

    const itemsData = cart.items.map((line) => ({
      productId: line.id,
      name: line.name.slice(0, 255),
      price: String(line.price ?? "").slice(0, 64),
      image: String(line.image ?? "").slice(0, 500),
      categoryId: String(line.categoryId ?? "").slice(0, 64),
      categoryName: String(line.categoryName ?? "").slice(0, 255),
      qty: Math.max(1, Math.min(99, line.qty)),
      lineTotalRub: rubFromPriceString(line.price, line.qty),
    }));

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

      let fulfillmentToken = generateFulfillmentToken();
      for (let i = 0; i < 5; i += 1) {
        const clash = await tx.order.findUnique({
          where: { fulfillmentToken },
          select: { id: true },
        });
        if (!clash) break;
        fulfillmentToken = generateFulfillmentToken();
      }

      const created = await tx.order.create({
        data: {
          number,
          customerId: customer.id,
          customerName: customerName.slice(0, 255),
          customerPhone: customerPhone.slice(0, 32),
          customerEmail: (customer.email ?? "").slice(0, 255),
          fulfillmentMode: cart.fulfillmentMode,
          status: "new",
          paymentStatus: "paid",
          paymentMethod: "card_test",
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
          paidAt: now,
          fulfillmentToken,
          statusUpdatedAt: now,
          items: { create: itemsData },
          statusLogs: {
            create: {
              status: "new",
              note: "Заказ оформлен (тестовая оплата)",
            },
          },
        },
        include: orderInclude,
      });

      return created;
    });

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

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/profile");
    revalidatePath("/profile/orders");

    return { success: true, data: { order: toOrderPublic(order) } };
  } catch {
    return {
      success: false,
      error: "Не удалось оформить заказ. Войдите в аккаунт и попробуйте снова.",
    };
  }
};

export const listOrdersAdminAction = async (): Promise<
  ActionResult<OrderPublic[]>
> => {
  try {
    await requireAuth();
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
      where: { status: "new" },
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

export const updateOrderStatusAction = async (
  input: unknown,
): Promise<ActionResult<OrderPublic>> => {
  try {
    await requireAuth();
    const parsed = updateOrderStatusSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректный статус",
      };
    }

    const existing = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
    });
    if (!existing) {
      return { success: false, error: "Заказ не найден" };
    }

    const next = parsed.data.status as OrderStatus;
    // Final handover («Выдан») only via QR scan page.
    if (next === "completed") {
      return {
        success: false,
        error: "Выдачу подтверждайте сканером QR",
      };
    }

    const allowed = nextOrderStatuses(
      existing.status as OrderStatus,
      existing.fulfillmentMode,
    );
    if (!allowed.includes(next)) {
      return {
        success: false,
        error: "Этот статус недоступен на текущем этапе",
      };
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: next,
        statusUpdatedAt: now,
        statusLogs: {
          create: {
            status: next,
            note: (parsed.data.note ?? "").slice(0, 255),
          },
        },
      },
      include: orderInclude,
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/orders/${existing.id}`);
    revalidatePath("/profile/orders");
    revalidatePath(`/profile/orders/${existing.id}`);
    return { success: true, data: toOrderPublic(updated) };
  } catch {
    return { success: false, error: "Не удалось обновить статус" };
  }
};

const resolveFulfillmentToken = (raw: string): string | null => {
  const parsed = parseFulfillmentQrPayload(raw);
  if (parsed) return parsed;
  const compact = raw.trim().toUpperCase().replace(/[\s·._-]+/g, "");
  return /^[A-F0-9]{16}$/.test(compact) ? compact : null;
};

type FulfillmentActor =
  | { kind: "admin" }
  | { kind: "courier"; customer: CustomerPublic };

const requireFulfillmentActor = async (): Promise<FulfillmentActor> => {
  if (await getSession()) return { kind: "admin" };
  const customer = await getCustomer();
  if (customer?.isCourier) return { kind: "courier", customer };
  throw new Error("Unauthorized");
};

/** Lookup order by customer QR — does not change status. */
export const lookupOrderByFulfillmentTokenAction = async (
  input: unknown,
): Promise<ActionResult<OrderPublic>> => {
  try {
    await requireFulfillmentActor();
    const parsed = verifyOrderFulfillmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректный QR-код",
      };
    }

    const token = resolveFulfillmentToken(parsed.data.token);
    if (!token) {
      return { success: false, error: "Не удалось прочитать код из QR" };
    }

    const existing = await prisma.order.findUnique({
      where: { fulfillmentToken: token },
      include: orderInclude,
    });
    if (!existing) {
      return { success: false, error: "Заказ по этому QR не найден" };
    }

    return { success: true, data: toOrderPublic(existing) };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { success: false, error: "Требуется вход курьера или админа" };
    }
    return { success: false, error: "Не удалось найти заказ" };
  }
};

/** Confirm handover after staff/courier reviewed the order on the scan page. */
export const verifyOrderFulfillmentAction = async (
  input: unknown,
): Promise<ActionResult<OrderPublic>> => {
  try {
    const actor = await requireFulfillmentActor();
    const parsed = verifyOrderFulfillmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректный QR-код",
      };
    }

    const token = resolveFulfillmentToken(parsed.data.token);
    if (!token) {
      return { success: false, error: "Не удалось прочитать код из QR" };
    }

    const existing = await prisma.order.findUnique({
      where: { fulfillmentToken: token },
      include: orderInclude,
    });
    if (!existing) {
      return { success: false, error: "Заказ по этому QR не найден" };
    }

    if (existing.status === "completed") {
      return { success: true, data: toOrderPublic(existing) };
    }

    if (existing.status === "cancelled") {
      return { success: false, error: "Заказ отменён — выдача невозможна" };
    }

    if (
      !canFulfillOrderByQr(
        existing.status as OrderStatus,
        existing.fulfillmentMode,
      )
    ) {
      return {
        success: false,
        error:
          existing.fulfillmentMode === "pickup"
            ? "Заказ ещё не готов к выдаче"
            : "Заказ ещё не готов к передаче курьеру / клиенту",
      };
    }

    const note =
      actor.kind === "courier"
        ? `Выдача подтверждена курьером${actor.customer.name ? ` (${actor.customer.name})` : ""} по QR`
        : "Выдача подтверждена по QR";

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: "completed",
        fulfilledAt: now,
        statusUpdatedAt: now,
        statusLogs: {
          create: {
            status: "completed",
            note,
          },
        },
      },
      include: orderInclude,
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/orders/${existing.id}`);
    revalidatePath("/profile/courier");
    revalidatePath("/profile/orders");
    revalidatePath(`/profile/orders/${existing.id}`);
    return { success: true, data: toOrderPublic(updated) };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { success: false, error: "Требуется вход курьера или админа" };
    }
    return { success: false, error: "Не удалось подтвердить выдачу" };
  }
};
