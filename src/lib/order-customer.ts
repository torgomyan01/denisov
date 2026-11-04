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
  "Unconfirmed",
  "WaitCooking",
  "CookingStarted",
  "CookingCompleted",
  "Waiting",
  "Closed",
];

const DELIVERY_FLOW: OrderStatus[] = [
  "Unconfirmed",
  "WaitCooking",
  "CookingStarted",
  "CookingCompleted",
  "Waiting",
  "OnWay",
  "Delivered",
  "Closed",
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
  if (order.status === "Cancelled") {
    return { eta: "Заказ отменён", progress: 0 };
  }
  if (order.status === "Closed" || order.status === "Delivered") {
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
    case "Unconfirmed":
      return {
        eta: "Ожидает подтверждения · обычно до 5 мин",
        progress: 10,
      };
    case "WaitCooking":
    case "ReadyForCooking":
      return {
        eta: "Скоро начнём готовить · около 5–10 мин",
        progress: 28,
      };
    case "CookingStarted": {
      const elapsed = minutesSince(order.statusUpdatedAt, now);
      const base = order.fulfillmentMode === "delivery" ? 25 : 20;
      const remaining = Math.max(8, base + cookPad - Math.min(elapsed, base));
      return {
        eta: `Готовим · ещё примерно ${remaining}–${remaining + 10} мин`,
        progress: 55,
      };
    }
    case "CookingCompleted":
    case "Waiting":
      return order.fulfillmentMode === "delivery"
        ? {
            eta: "Передаём курьеру · около 5–10 мин",
            progress: 72,
          }
        : {
            eta: "Можно забирать сейчас",
            progress: 88,
          };
    case "OnWay": {
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
    (s) => s !== "Cancelled",
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
    case "Unconfirmed":
      return {
        title: "Заказ получен",
        detail: "Мы видим ваш заказ и скоро подтвердим его.",
        eta,
        progress,
      };
    case "WaitCooking":
    case "ReadyForCooking":
      return {
        title: "Подтверждён",
        detail: "Заказ принят — ставим в очередь на кухню.",
        eta,
        progress,
      };
    case "CookingStarted":
      return {
        title: "Готовим",
        detail: "Кухня собирает ваш заказ прямо сейчас.",
        eta,
        progress,
      };
    case "CookingCompleted":
      return {
        title: "Готов",
        detail: "Кухня закончила готовить ваш заказ.",
        eta,
        progress,
      };
    case "Waiting":
      return order.fulfillmentMode === "delivery"
        ? {
            title: "К доставке",
            detail: "Заказ собран, передаём курьеру.",
            eta,
            progress,
          }
        : {
            title: "К выдаче",
            detail: "Можно забирать в точке самовывоза.",
            eta,
            progress,
          };
    case "OnWay":
      return {
        title: "В пути",
        detail: "Курьер уже едет к вам.",
        eta,
        progress,
      };
    case "Delivered":
      return {
        title: "Доставлен",
        detail: "Курьер передал заказ. Приятного аппетита!",
        eta,
        progress: 100,
      };
    case "Closed":
      return {
        title: "Завершён",
        detail: "Заказ закрыт. Приятного аппетита!",
        eta,
        progress: 100,
      };
    case "Cancelled":
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

export const customerFlowStepLabel = (
  status: OrderStatus,
  fulfillmentMode: FulfillmentMode = "pickup",
): string => {
  switch (status) {
    case "Unconfirmed":
      return "Получен";
    case "WaitCooking":
    case "ReadyForCooking":
      return "Подтверждён";
    case "CookingStarted":
      return "Готовим";
    case "CookingCompleted":
      return "Готов";
    case "Waiting":
      return fulfillmentMode === "delivery" ? "К доставке" : "К выдаче";
    case "OnWay":
      return "В пути";
    case "Delivered":
      return "Доставлен";
    case "Closed":
      return "Завершён";
    case "Cancelled":
      return "Отменён";
    default:
      return "В работе";
  }
};
