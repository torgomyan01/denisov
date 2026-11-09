"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  ANALYTICS_RANGES,
  COMPLETED_ORDER_STATUSES,
  formatDayLabel,
  isCompletedOrderStatus,
  moscowDayKey,
  moscowHour,
  resolveAnalyticsWindow,
  type AdminAnalyticsPayload,
  type AnalyticsAbandonedCartRow,
  type AnalyticsCartProductRow,
  type AnalyticsCustomerRow,
  type AnalyticsDayPoint,
  type AnalyticsHourPoint,
  type AnalyticsNamedSlice,
  type AnalyticsProductRow,
  type AnalyticsRange,
  type AnalyticsStatusSlice,
} from "@/lib/admin-analytics";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  rubFromPriceString,
  type OrderStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/site";

const inputSchema = z.object({
  range: z.enum(ANALYTICS_RANGES).default("30d"),
});

const PAYMENT_STATUS_FALLBACK: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
};

const iikoLabel = (status: string): string => {
  const key = status.trim().toLowerCase();
  if (!key) return "Не отправлялся";
  if (key === "success") return "iiko OK";
  if (key === "error") return "iiko ошибка";
  if (key === "inprogress" || key === "pending") return "iiko в процессе";
  if (key === "skipped") return "iiko пропущен";
  return status || "Прочее";
};

const customerDisplayName = (c: {
  name: string;
  surname: string;
}): string =>
  [c.name, c.surname].filter(Boolean).join(" ").trim() || "Без имени";

export const getAdminAnalyticsAction = async (
  input: unknown = { range: "30d" },
): Promise<ActionResult<AdminAnalyticsPayload>> => {
  try {
    await requireAuth();
    const parsed = inputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { success: false, error: "Некорректный период" };
    }

    const range = parsed.data.range as AnalyticsRange;
    const { from, to } = resolveAnalyticsWindow(range);
    const orderWhere = from ? { createdAt: { gte: from, lte: to } } : {};
    const now = new Date();

    const [
      customersTotal,
      couriersTotal,
      customersWithOrders,
      customersNewInPeriod,
      customersYandex,
      customersWithPassword,
      statusGroups,
      fulfillmentGroups,
      paymentStatusGroups,
      paymentMethodGroups,
      pickupPointGroups,
      timeModeGroups,
      iikoGroups,
      orderAgg,
      completedAgg,
      cancelledAgg,
      activeAgg,
      paidAgg,
      deliveryAgg,
      pickupAgg,
      guestOrders,
      asapOrders,
      scheduledOrders,
      periodOrders,
      orderItems,
      topCustomerGroups,
      customersWithoutRows,
      buyerOrderCounts,
      activeSessions,
      pushDevices,
      pushCustomers,
      cartsWithItemsCount,
      allCartItems,
      liveCarts,
    ] = await Promise.all([
      prisma.customer.count({ where: { role: "customer" } }),
      prisma.customer.count({ where: { role: "courier" } }),
      prisma.customer.count({
        where: { role: "customer", orders: { some: {} } },
      }),
      prisma.customer.count({
        where: {
          role: "customer",
          ...(from ? { createdAt: { gte: from, lte: to } } : {}),
        },
      }),
      prisma.customer.count({
        where: { role: "customer", yandexId: { not: null } },
      }),
      prisma.customer.count({
        where: { role: "customer", passwordHash: { not: null } },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.groupBy({
        by: ["fulfillmentMode"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.groupBy({
        by: ["paymentStatus"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.groupBy({
        by: ["paymentMethod"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.groupBy({
        by: ["pickupPointName"],
        where: {
          ...orderWhere,
          fulfillmentMode: "pickup",
          pickupPointName: { not: "" },
        },
        _count: { _all: true },
        _sum: { totalRub: true },
        orderBy: { _count: { pickupPointName: "desc" } },
        take: 12,
      }),
      prisma.order.groupBy({
        by: ["timeMode"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.groupBy({
        by: ["iikoCreationStatus"],
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.aggregate({
        where: orderWhere,
        _count: { _all: true },
        _sum: { totalRub: true, deliveryFeeRub: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderWhere,
          status: { in: [...COMPLETED_ORDER_STATUSES] },
        },
        _count: { _all: true },
        _sum: { totalRub: true },
        _avg: { totalRub: true },
        _max: { totalRub: true },
        _min: { totalRub: true },
      }),
      prisma.order.aggregate({
        where: { ...orderWhere, status: "Cancelled" },
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderWhere,
          status: { notIn: [...COMPLETED_ORDER_STATUSES, "Cancelled"] },
        },
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.aggregate({
        where: { ...orderWhere, paymentStatus: "paid" },
        _count: { _all: true },
        _sum: { totalRub: true },
      }),
      prisma.order.aggregate({
        where: { ...orderWhere, fulfillmentMode: "delivery" },
        _count: { _all: true },
        _sum: { deliveryFeeRub: true },
      }),
      prisma.order.aggregate({
        where: { ...orderWhere, fulfillmentMode: "pickup" },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: { ...orderWhere, customerId: null },
      }),
      prisma.order.count({
        where: { ...orderWhere, timeMode: "asap" },
      }),
      prisma.order.count({
        where: { ...orderWhere, timeMode: { not: "asap" } },
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: {
          createdAt: true,
          status: true,
          totalRub: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.orderItem.findMany({
        where: { order: orderWhere },
        select: {
          productId: true,
          name: true,
          categoryName: true,
          qty: true,
          lineTotalRub: true,
          orderId: true,
          order: { select: { status: true } },
        },
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: {
          ...orderWhere,
          customerId: { not: null },
          status: { in: [...COMPLETED_ORDER_STATUSES] },
        },
        _count: { _all: true },
        _sum: { totalRub: true },
        _max: { createdAt: true },
        orderBy: { _sum: { totalRub: "desc" } },
        take: 15,
      }),
      prisma.customer.findMany({
        where: { role: "customer", orders: { none: {} } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          name: true,
          surname: true,
          phone: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: {
          ...orderWhere,
          customerId: { not: null },
          status: { in: [...COMPLETED_ORDER_STATUSES] },
        },
        _count: { _all: true },
      }),
      prisma.customerSession.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.pushSubscription.count(),
      prisma.pushSubscription.groupBy({
        by: ["customerId"],
        _count: { _all: true },
      }),
      prisma.customerCart.count({
        where: { items: { some: {} } },
      }),
      prisma.customerCartItem.findMany({
        select: {
          productId: true,
          name: true,
          categoryName: true,
          price: true,
          qty: true,
          cartId: true,
        },
      }),
      prisma.customerCart.findMany({
        where: { items: { some: {} } },
        select: {
          id: true,
          customerId: true,
          fulfillmentMode: true,
          updatedAt: true,
          customer: {
            select: {
              name: true,
              surname: true,
              phone: true,
            },
          },
          items: {
            select: {
              productId: true,
              name: true,
              categoryName: true,
              price: true,
              qty: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);

    const productMap = new Map<
      string,
      AnalyticsProductRow & { orderIds: Set<string> }
    >();
    let itemsSoldCompleted = 0;
    const completedOrderItemCounts = new Map<string, number>();
    for (const row of orderItems) {
      if (!isCompletedOrderStatus(row.order.status)) continue;
      itemsSoldCompleted += row.qty;
      completedOrderItemCounts.set(
        row.orderId,
        (completedOrderItemCounts.get(row.orderId) ?? 0) + row.qty,
      );
      const key = row.productId || row.name;
      const prev = productMap.get(key);
      if (prev) {
        prev.qty += row.qty;
        prev.revenueRub += row.lineTotalRub;
        prev.orderIds.add(row.orderId);
      } else {
        productMap.set(key, {
          productId: row.productId,
          name: row.name,
          categoryName: row.categoryName || "",
          qty: row.qty,
          revenueRub: row.lineTotalRub,
          orders: 0,
          orderIds: new Set([row.orderId]),
        });
      }
    }
    const topProducts: AnalyticsProductRow[] = [...productMap.values()]
      .map(({ orderIds, ...rest }) => ({
        ...rest,
        orders: orderIds.size,
      }))
      .sort((a, b) => b.qty - a.qty || b.revenueRub - a.revenueRub)
      .slice(0, 20);

    const completedOrderCount = completedOrderItemCounts.size;
    const avgItemsPerCompletedOrder =
      completedOrderCount > 0
        ? Math.round(
            ([...completedOrderItemCounts.values()].reduce((a, b) => a + b, 0) /
              completedOrderCount) *
              10,
          ) / 10
        : 0;

    const customerIds = topCustomerGroups
      .map((g) => g.customerId)
      .filter((id): id is string => Boolean(id));
    const customerRows =
      customerIds.length > 0
        ? await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: {
              id: true,
              name: true,
              surname: true,
              phone: true,
              email: true,
              createdAt: true,
            },
          })
        : [];
    const customerById = new Map(customerRows.map((c) => [c.id, c]));

    const topCustomers: AnalyticsCustomerRow[] = topCustomerGroups.map((g) => {
      const c = g.customerId ? customerById.get(g.customerId) : undefined;
      return {
        id: g.customerId || "",
        name: c ? customerDisplayName(c) : "Гость",
        phone: c?.phone ?? null,
        email: c?.email ?? null,
        ordersCount: g._count._all,
        spentRub: g._sum.totalRub ?? 0,
        lastOrderAt: g._max.createdAt?.toISOString() ?? null,
        createdAt: c?.createdAt.toISOString() ?? "",
      };
    });

    const customersWithoutOrders: AnalyticsCustomerRow[] =
      customersWithoutRows.map((c) => ({
        id: c.id,
        name: customerDisplayName(c),
        phone: c.phone,
        email: c.email,
        ordersCount: 0,
        spentRub: 0,
        lastOrderAt: null,
        createdAt: c.createdAt.toISOString(),
      }));

    let repeatBuyers = 0;
    let oneTimeBuyers = 0;
    for (const g of buyerOrderCounts) {
      if (!g.customerId) continue;
      if (g._count._all >= 2) repeatBuyers += 1;
      else oneTimeBuyers += 1;
    }

    const byStatus: AnalyticsStatusSlice[] = statusGroups
      .map((g) => ({
        status: g.status as OrderStatus,
        count: g._count._all,
        totalRub: g._sum.totalRub ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const byFulfillment: AnalyticsNamedSlice[] = fulfillmentGroups.map((g) => ({
      key: g.fulfillmentMode,
      label: g.fulfillmentMode === "delivery" ? "Доставка" : "Самовывоз",
      count: g._count._all,
      totalRub: g._sum.totalRub ?? 0,
    }));

    const byPaymentStatus: AnalyticsNamedSlice[] = paymentStatusGroups.map(
      (g) => ({
        key: g.paymentStatus,
        label:
          PAYMENT_STATUS_LABELS[
            g.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
          ] ??
          PAYMENT_STATUS_FALLBACK[g.paymentStatus] ??
          g.paymentStatus,
        count: g._count._all,
        totalRub: g._sum.totalRub ?? 0,
      }),
    );

    const byPaymentMethod: AnalyticsNamedSlice[] = paymentMethodGroups.map(
      (g) => ({
        key: g.paymentMethod,
        label: PAYMENT_METHOD_LABELS[g.paymentMethod] || g.paymentMethod || "—",
        count: g._count._all,
        totalRub: g._sum.totalRub ?? 0,
      }),
    );

    const byPickupPoint: AnalyticsNamedSlice[] = pickupPointGroups.map((g) => ({
      key: g.pickupPointName,
      label: g.pickupPointName || "Без названия",
      count: g._count._all,
      totalRub: g._sum.totalRub ?? 0,
    }));

    const byTimeMode: AnalyticsNamedSlice[] = timeModeGroups.map((g) => ({
      key: g.timeMode,
      label: g.timeMode === "asap" ? "Как можно скорее" : "Ко времени",
      count: g._count._all,
      totalRub: g._sum.totalRub ?? 0,
    }));

    let iikoOk = 0;
    let iikoError = 0;
    let iikoOther = 0;
    const byIiko: AnalyticsNamedSlice[] = iikoGroups.map((g) => {
      const key = g.iikoCreationStatus || "";
      const lower = key.trim().toLowerCase();
      if (lower === "success") iikoOk += g._count._all;
      else if (lower === "error") iikoError += g._count._all;
      else iikoOther += g._count._all;
      return {
        key: key || "empty",
        label: iikoLabel(key),
        count: g._count._all,
        totalRub: g._sum.totalRub ?? 0,
      };
    });

    const dayMap = new Map<string, AnalyticsDayPoint>();
    const ensureDay = (key: string): AnalyticsDayPoint => {
      let point = dayMap.get(key);
      if (!point) {
        point = {
          day: key,
          label: formatDayLabel(key),
          orders: 0,
          completed: 0,
          cancelled: 0,
          revenueRub: 0,
        };
        dayMap.set(key, point);
      }
      return point;
    };

    if (from) {
      const cursor = new Date(from);
      const end = to;
      while (cursor <= end) {
        ensureDay(moscowDayKey(cursor));
        cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    const hourMap = new Map<number, AnalyticsHourPoint>();
    for (let h = 0; h < 24; h += 1) {
      hourMap.set(h, {
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        orders: 0,
        revenueRub: 0,
      });
    }

    for (const order of periodOrders) {
      const point = ensureDay(moscowDayKey(order.createdAt));
      point.orders += 1;
      if (isCompletedOrderStatus(order.status)) {
        point.completed += 1;
        point.revenueRub += order.totalRub;
      } else if (order.status === "Cancelled") {
        point.cancelled += 1;
      }

      const hourPoint = hourMap.get(moscowHour(order.createdAt));
      if (hourPoint) {
        hourPoint.orders += 1;
        if (isCompletedOrderStatus(order.status)) {
          hourPoint.revenueRub += order.totalRub;
        }
      }
    }

    const daily = [...dayMap.values()].sort((a, b) =>
      a.day.localeCompare(b.day),
    );
    const byHour = [...hourMap.values()];

    let cartUnitsTotal = 0;
    let cartValueEstimateRub = 0;
    const cartProductMap = new Map<
      string,
      AnalyticsCartProductRow & { cartIds: Set<string> }
    >();

    for (const item of allCartItems) {
      cartUnitsTotal += item.qty;
      const lineValue = rubFromPriceString(item.price, item.qty);
      cartValueEstimateRub += lineValue;
      const key = item.productId || item.name;
      const prev = cartProductMap.get(key);
      if (prev) {
        prev.qty += item.qty;
        prev.valueRub += lineValue;
        prev.cartIds.add(item.cartId);
      } else {
        cartProductMap.set(key, {
          productId: item.productId,
          name: item.name,
          categoryName: item.categoryName || "",
          qty: item.qty,
          valueRub: lineValue,
          carts: 0,
          cartIds: new Set([item.cartId]),
        });
      }
    }

    const cartLinesTotal = allCartItems.length;

    const abandonedCarts: AnalyticsAbandonedCartRow[] = liveCarts
      .slice(0, 25)
      .map((cart) => {
        let units = 0;
        let value = 0;
        for (const item of cart.items) {
          units += item.qty;
          value += rubFromPriceString(item.price, item.qty);
        }
        return {
          cartId: cart.id,
          customerId: cart.customerId,
          name: customerDisplayName(cart.customer),
          phone: cart.customer.phone,
          units,
          lines: cart.items.length,
          valueRub: value,
          fulfillmentMode: cart.fulfillmentMode,
          updatedAt: cart.updatedAt.toISOString(),
        };
      });

    const topCartProducts: AnalyticsCartProductRow[] = [
      ...cartProductMap.values(),
    ]
      .map(({ cartIds, ...rest }) => ({
        ...rest,
        carts: cartIds.size,
      }))
      .sort((a, b) => b.qty - a.qty || b.valueRub - a.valueRub)
      .slice(0, 15);

    const ordersCompleted = completedAgg._count._all;
    const ordersTotal = orderAgg._count._all;
    const revenueCompletedRub = completedAgg._sum.totalRub ?? 0;
    const cancelRatePct =
      ordersTotal > 0
        ? Math.round((cancelledAgg._count._all / ordersTotal) * 1000) / 10
        : 0;

    const payload: AdminAnalyticsPayload = {
      range,
      from: from?.toISOString() ?? null,
      to: to.toISOString(),
      generatedAt: new Date().toISOString(),
      kpis: {
        customersTotal,
        customersWithOrders,
        customersWithoutOrders: Math.max(
          0,
          customersTotal - customersWithOrders,
        ),
        customersNewInPeriod,
        customersYandex,
        customersWithPassword,
        couriersTotal,
        ordersTotal,
        ordersCompleted,
        ordersCancelled: cancelledAgg._count._all,
        ordersActive: activeAgg._count._all,
        ordersGuest: guestOrders,
        ordersWithAccount: Math.max(0, ordersTotal - guestOrders),
        revenueCompletedRub,
        revenuePaidRub: paidAgg._sum.totalRub ?? 0,
        revenueActiveRub: activeAgg._sum.totalRub ?? 0,
        revenueCancelledRub: cancelledAgg._sum.totalRub ?? 0,
        avgCheckCompletedRub:
          ordersCompleted > 0
            ? Math.round(revenueCompletedRub / ordersCompleted)
            : 0,
        maxCheckCompletedRub: completedAgg._max.totalRub ?? 0,
        minCheckCompletedRub:
          ordersCompleted > 0 ? (completedAgg._min.totalRub ?? 0) : 0,
        itemsSoldCompleted,
        uniqueProductsSold: productMap.size,
        avgItemsPerCompletedOrder,
        deliveryOrders: deliveryAgg._count._all,
        pickupOrders: pickupAgg._count._all,
        deliveryFeesRub: deliveryAgg._sum.deliveryFeeRub ?? 0,
        asapOrders,
        scheduledOrders,
        cancelRatePct,
        repeatBuyers,
        oneTimeBuyers,
        cartsWithItems: cartsWithItemsCount,
        cartUnitsTotal,
        cartLinesTotal,
        cartValueEstimateRub,
        activeSessions,
        pushCustomers: pushCustomers.length,
        pushDevices,
        iikoOk,
        iikoError,
        iikoOther,
      },
      byStatus,
      byFulfillment,
      byPaymentStatus,
      byPaymentMethod,
      byPickupPoint,
      byTimeMode,
      byIiko,
      daily,
      byHour,
      topProducts,
      topCustomers,
      customersWithoutOrders,
      topCartProducts,
      abandonedCarts,
    };

    return { success: true, data: payload };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить аналитику";
    return { success: false, error: message };
  }
};
