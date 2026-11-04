import type { FulfillmentMode } from "@/lib/customer-auth";
import {
  ORDER_STATUS_HINTS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/orders";

export type OrderNotifyPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

const ALL_STATUSES = new Set<OrderStatus>(ORDER_STATUSES);

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
    case "Unconfirmed":
      return {
        pushBody: `Заказ ${orderNumber} оформлен и ожидает подтверждения`,
        lines: [
          `Заказ ${orderNumber} успешно оформлен.`,
          hint,
          fulfill ? `Способ получения: ${fulfill}.` : "",
        ],
      };
    case "WaitCooking":
    case "ReadyForCooking":
      return {
        pushBody: `Заказ ${orderNumber} подтверждён и принят в работу`,
        lines: [
          `Заказ ${orderNumber}: статус «${label}».`,
          "Мы приняли его в работу.",
          fulfill ? `Способ получения: ${fulfill}.` : "",
        ],
      };
    case "CookingStarted":
      return {
        pushBody: `Заказ ${orderNumber} готовится на кухне`,
        lines: [
          `Заказ ${orderNumber}: статус «${label}».`,
          "Кухня готовит ваш заказ.",
        ],
      };
    case "CookingCompleted":
    case "Waiting":
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
    case "OnWay":
      return {
        pushBody: `Заказ ${orderNumber} уже в пути к вам`,
        lines: [
          `Заказ ${orderNumber} в пути.`,
          "Курьер везёт заказ к вам.",
        ],
      };
    case "Delivered":
    case "Closed":
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
    case "Cancelled":
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

export const orderStatusNotifyPayload = (input: {
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
  fulfillmentMode?: FulfillmentMode | null;
}): OrderNotifyPayload | null => {
  const { status, orderId, orderNumber, fulfillmentMode } = input;
  if (!isOrderNotifyStatus(status)) return null;

  const path = `/profile/orders/${orderId}`;
  const { pushBody } = detailForStatus(
    status,
    orderNumber,
    fulfillmentMode,
  );

  return {
    title: `Денисов · ${orderNumber}`,
    body: pushBody,
    url: path,
    tag: `order-${orderId}-${status}`,
  };
};
