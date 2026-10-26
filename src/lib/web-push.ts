import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/orders";

export type PushPayload = {
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

export const isPushNotifyStatus = (status: OrderStatus): boolean =>
  NOTIFY_STATUSES.has(status);

export const orderStatusPushPayload = (input: {
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
}): PushPayload | null => {
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

let vapidConfigured = false;

const ensureVapid = (): boolean => {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:hello@cafedenisov.ru";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
};

export const getVapidPublicKey = (): string | null => {
  const key =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    "";
  return key || null;
};

/** Send push to all devices of a customer. Never throws. */
export const sendPushToCustomer = async (
  customerId: string,
  payload: PushPayload,
): Promise<void> => {
  try {
    if (!customerId || !ensureVapid()) return;

    const rows = await prisma.pushSubscription.findMany({
      where: { customerId },
    });
    if (!rows.length) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            body,
          );
        } catch (error) {
          const statusCode =
            error &&
            typeof error === "object" &&
            "statusCode" in error &&
            typeof (error as { statusCode: unknown }).statusCode === "number"
              ? (error as { statusCode: number }).statusCode
              : null;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription
              .delete({ where: { id: row.id } })
              .catch(() => undefined);
          }
        }
      }),
    );
  } catch {
    /* never block order flow */
  }
};

/** Fire-and-forget helper after order status changes. */
export const notifyCustomerOrderStatus = (input: {
  customerId: string | null | undefined;
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
}): void => {
  const { customerId, status, orderId, orderNumber } = input;
  if (!customerId || !isPushNotifyStatus(status)) return;
  const payload = orderStatusPushPayload({ status, orderId, orderNumber });
  if (!payload) return;
  void sendPushToCustomer(customerId, payload);
};
