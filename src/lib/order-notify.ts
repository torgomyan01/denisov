import type { FulfillmentMode } from "@/lib/customer-auth";
import {
  ORDER_STATUS_HINTS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/lib/orders";

export type OrderNotifyPayload = {
  title: string;
  body: string;
  /** Longer text for Telegram (multiline). */
  telegramText: string;
  url: string;
  tag?: string;
};

const ALL_STATUSES = new Set<OrderStatus>([
  "new",
  "confirmed",
  "preparing",
  "ready",
  "delivering",
  "completed",
  "cancelled",
]);

export const isOrderNotifyStatus = (status: OrderStatus): boolean =>
  ALL_STATUSES.has(status);

const fulfillmentLabel = (mode?: FulfillmentMode | null): string => {
  if (mode === "delivery") return "Доставка";
  if (mode === "pickup") return "Самовывоз";
  return "";
};

const detailForStatus = (
  status: OrderStatus,
  orderNumber: string,
  mode?: FulfillmentMode | null,
): { pushBody: string; lines: string[] } => {
  const label = ORDER_STATUS_LABELS[status];
  const hint = ORDER_STATUS_HINTS[status];
  const fulfill = fulfillmentLabel(mode);

  switch (status) {
    case "new":
      return {
        pushBody: `Заказ ${orderNumber} оформлен и ожидает подтверждения`,
        lines: [
          `Заказ ${orderNumber} успешно оформлен.`,
          hint,
          fulfill ? `Способ получения: ${fulfill}.` : "",
        ],
      };
    case "confirmed":
      return {
        pushBody: `Заказ ${orderNumber} подтверждён и принят в работу`,
        lines: [
          `Заказ ${orderNumber} подтверждён.`,
          "Мы приняли его в работу.",
          fulfill ? `Способ получения: ${fulfill}.` : "",
        ],
      };
    case "preparing":
      return {
        pushBody: `Заказ ${orderNumber} готовится на кухне`,
        lines: [
          `Заказ ${orderNumber}: статус «${label}».`,
          "Кухня готовит ваш заказ.",
        ],
      };
    case "ready":
      if (mode === "delivery") {
        return {
          pushBody: `Заказ ${orderNumber} готов — передаём курьеру`,
          lines: [
            `Заказ ${orderNumber} готов.`,
            "Сейчас передаём его курьеру для доставки.",
          ],
        };
      }
      return {
        pushBody: `Заказ ${orderNumber} готов — можно забирать`,
        lines: [
          `Заказ ${orderNumber} готов.`,
          "Можно забирать в точке самовывоза.",
        ],
      };
    case "delivering":
      return {
        pushBody: `Заказ ${orderNumber} уже в пути к вам`,
        lines: [
          `Заказ ${orderNumber} в пути.`,
          "Курьер везёт заказ к вам.",
        ],
      };
    case "completed":
      if (mode === "delivery") {
        return {
          pushBody: `Заказ ${orderNumber} доставлен`,
          lines: [
            `Заказ ${orderNumber} доставлен.`,
            "Спасибо, что выбрали Денисов!",
          ],
        };
      }
      return {
        pushBody: `Заказ ${orderNumber} выдан`,
        lines: [
          `Заказ ${orderNumber} выдан.`,
          "Спасибо, что выбрали Денисов!",
        ],
      };
    case "cancelled":
      return {
        pushBody: `Заказ ${orderNumber} отменён`,
        lines: [
          `Заказ ${orderNumber} отменён.`,
          "Если это ошибка — напишите нам или оформите заказ снова.",
        ],
      };
    default:
      return {
        pushBody: `Заказ ${orderNumber}: ${label}`,
        lines: [`Заказ ${orderNumber}: ${label}.`, hint],
      };
  }
};

const siteOrigin = (): string => {
  const raw = process.env.SITE_URL?.trim() || "https://cafedenisov.ru";
  return raw.replace(/\/$/, "");
};

export const orderStatusNotifyPayload = (input: {
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
  fulfillmentMode?: FulfillmentMode | null;
}): OrderNotifyPayload | null => {
  const { status, orderId, orderNumber, fulfillmentMode } = input;
  if (!isOrderNotifyStatus(status)) return null;

  const path = `/profile/orders/${orderId}`;
  const url = path;
  const label = ORDER_STATUS_LABELS[status];
  const { pushBody, lines } = detailForStatus(
    status,
    orderNumber,
    fulfillmentMode,
  );
  const absoluteUrl = `${siteOrigin()}${path}`;
  const telegramText = [
    "Кафе Денисов",
    `Заказ ${orderNumber}`,
    `Статус: ${label}`,
    "",
    ...lines.filter(Boolean),
    "",
    `Открыть заказ: ${absoluteUrl}`,
  ].join("\n");

  return {
    title: `Денисов · ${orderNumber}`,
    body: pushBody,
    telegramText,
    url,
    tag: `order-${orderId}-${status}`,
  };
};
