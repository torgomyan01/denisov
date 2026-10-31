import type { OrderStatus } from "@/lib/orders";

export type OrderNotifyPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

const NOTIFY_STATUSES = new Set<OrderStatus>([
  "ready",
  "delivering",
  "completed",
]);

export const isOrderNotifyStatus = (status: OrderStatus): boolean =>
  NOTIFY_STATUSES.has(status);

export const orderStatusNotifyPayload = (input: {
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
}): OrderNotifyPayload | null => {
  const { status, orderId, orderNumber } = input;
  const url = `/profile/orders/${orderId}`;
  switch (status) {
    case "ready":
      return {
        title: "Денисов",
        body: `Ваш заказ ${orderNumber} готов`,
        url,
        tag: `order-${orderId}-ready`,
      };
    case "delivering":
      return {
        title: "Денисов",
        body: `Ваш заказ ${orderNumber} в пути`,
        url,
        tag: `order-${orderId}-delivering`,
      };
    case "completed":
      return {
        title: "Денисов",
        body: `Ваш заказ ${orderNumber} выдан`,
        url,
        tag: `order-${orderId}-completed`,
      };
    default:
      return null;
  }
};
