import type { FulfillmentMode } from "@/lib/customer-auth";
import type { OrderPublic, OrderStatus } from "@/lib/orders";

export type CustomerOrderStatusView = {
  title: string;
  detail: string;
  /** Short ETA line for the customer */
  eta: string;
  /** 0–100 progress for active orders */
  progress: number;
};

const PICKUP_FLOW: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

const DELIVERY_FLOW: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "delivering",
  "completed",
];

export const customerOrderFlow = (
  fulfillmentMode: FulfillmentMode,
): OrderStatus[] =>
  fulfillmentMode === "delivery" ? DELIVERY_FLOW : PICKUP_FLOW;

const formatClock = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const minutesSince = (iso: string, now: Date): number => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((now.getTime() - t) / 60000));
};

/** Rough remaining window from current status (not a promise — estimate). */
const etaForStatus = (
  order: OrderPublic,
  now: Date,
): { eta: string; progress: number } => {
  if (order.status === "cancelled") {
    return { eta: "Заказ отменён", progress: 0 };
  }
  if (order.status === "completed") {
    return { eta: "Уже у вас", progress: 100 };
  }

  if (order.timeMode === "scheduled" && order.scheduledAt) {
    const scheduled = new Date(order.scheduledAt);
    if (!Number.isNaN(scheduled.getTime()) && scheduled.getTime() > now.getTime()) {
      return {
        eta: `К ${formatClock(order.scheduledAt)}`,
        progress: progressForStatus(order),
      };
    }
  }

  const itemCount = order.items.reduce((sum, row) => sum + row.qty, 0);
  const cookPad = Math.min(15, Math.max(0, (itemCount - 2) * 3));

  switch (order.status) {
    case "new":
      return {
        eta: "Ожидает подтверждения · обычно до 5 мин",
        progress: 12,
      };
    case "confirmed":
      return {
        eta: "Скоро начнём готовить · около 5–10 мин",
        progress: 28,
      };
    case "preparing": {
      const elapsed = minutesSince(order.statusUpdatedAt, now);
      const base = order.fulfillmentMode === "delivery" ? 25 : 20;
      const remaining = Math.max(8, base + cookPad - Math.min(elapsed, base));
      return {
        eta: `Готовим · ещё примерно ${remaining}–${remaining + 10} мин`,
        progress: 55,
      };
    }
    case "ready":
      return order.fulfillmentMode === "delivery"
        ? {
            eta: "Передаём курьеру · около 5–10 мин",
            progress: 72,
          }
        : {
            eta: "Можно забирать сейчас",
            progress: 88,
          };
    case "delivering": {
      const elapsed = minutesSince(order.statusUpdatedAt, now);
      const remaining = Math.max(8, 20 - Math.min(elapsed, 15));
      return {
        eta: `Курьер в пути · ещё примерно ${remaining}–${remaining + 10} мин`,
        progress: 86,
      };
    }
    default:
      return { eta: "Обновляем статус…", progress: 20 };
  }
};

const progressForStatus = (order: OrderPublic): number => {
  const flow = customerOrderFlow(order.fulfillmentMode).filter(
    (s) => s !== "cancelled",
  );
  const idx = flow.findIndex((s) => s === order.status);
  if (idx < 0) return 10;
  return Math.round(((idx + 0.5) / flow.length) * 100);
};

export const getCustomerOrderStatusView = (
  order: OrderPublic,
  now: Date = new Date(),
): CustomerOrderStatusView => {
  const { eta, progress } = etaForStatus(order, now);

  switch (order.status) {
    case "new":
      return {
        title: "Заказ получен",
        detail: "Мы видим ваш заказ и скоро подтвердим его.",
        eta,
        progress,
      };
    case "confirmed":
      return {
        title: "Подтверждён",
        detail: "Заказ принят — ставим в очередь на кухню.",
        eta,
        progress,
      };
    case "preparing":
      return {
        title: "Готовим",
        detail: "Кухня собирает ваш заказ прямо сейчас.",
        eta,
        progress,
      };
    case "ready":
      return order.fulfillmentMode === "delivery"
        ? {
            title: "Готов к доставке",
            detail: "Заказ собран, передаём курьеру.",
            eta,
            progress,
          }
        : {
            title: "Готов к выдаче",
            detail: "Можно забирать в точке самовывоза.",
            eta,
            progress,
          };
    case "delivering":
      return {
        title: "В пути",
        detail: "Курьер уже едет к вам.",
        eta,
        progress,
      };
    case "completed":
      return {
        title: "Доставлен",
        detail: "Заказ у вас. Приятного аппетита!",
        eta,
        progress: 100,
      };
    case "cancelled":
      return {
        title: "Отменён",
        detail: "Этот заказ больше не выполняется.",
        eta,
        progress: 0,
      };
    default:
      return {
        title: "В работе",
        detail: "Следим за статусом заказа.",
        eta,
        progress,
      };
  }
};

export const customerFlowStepLabel = (status: OrderStatus): string => {
  switch (status) {
    case "new":
      return "Получен";
    case "confirmed":
      return "Подтверждён";
    case "preparing":
      return "Готовим";
    case "ready":
      return "Готов";
    case "delivering":
      return "В пути";
    case "completed":
      return "У вас";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
};
