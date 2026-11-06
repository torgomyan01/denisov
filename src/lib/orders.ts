import { randomBytes } from "crypto";
import type { FulfillmentMode } from "@/lib/customer-auth";

const parsePriceNumber = (price: string): number => {
  const match = String(price ?? "").replace(",", ".").match(/[\d.]+/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Order statuses — same set as iiko Cloud `DeliveryStatus`
 * (api-ru.iiko.services OpenAPI).
 */
export type OrderStatus =
  | "Unconfirmed"
  | "WaitCooking"
  | "ReadyForCooking"
  | "CookingStarted"
  | "CookingCompleted"
  | "Waiting"
  | "OnWay"
  | "Delivered"
  | "Closed"
  | "Cancelled";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "Unconfirmed",
  "WaitCooking",
  "ReadyForCooking",
  "CookingStarted",
  "CookingCompleted",
  "Waiting",
  "OnWay",
  "Delivered",
  "Closed",
  "Cancelled",
] as const;

export type PaymentStatus = "pending" | "paid" | "failed";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Unconfirmed: "Не подтверждён",
  WaitCooking: "Ожидает кухню",
  ReadyForCooking: "К готовке",
  CookingStarted: "Готовится",
  CookingCompleted: "Приготовлен",
  Waiting: "Ожидает выдачи",
  OnWay: "В пути",
  Delivered: "Доставлен",
  Closed: "Закрыт",
  Cancelled: "Отменён",
};

export const ORDER_STATUS_HINTS: Record<OrderStatus, string> = {
  Unconfirmed: "Заказ только что оформлен, ждёт подтверждения",
  WaitCooking: "Принят — в очереди на кухню",
  ReadyForCooking: "Можно отдавать на кухню",
  CookingStarted: "Кухня готовит заказ",
  CookingCompleted: "Блюда готовы",
  Waiting: "Ждёт выдачи клиенту или курьеру",
  OnWay: "Курьер везёт клиенту",
  Delivered: "Курьер доставил — можно закрыть",
  Closed: "Заказ завершён",
  Cancelled: "Заказ отменён",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
};

/** Stored on Order.paymentMethod */
export type OrderPaymentMethod = "card_test" | "on_receipt" | string;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card_test: "Онлайн картой (тест)",
  on_receipt: "При получении",
};

export const paymentMethodLabel = (method: string): string =>
  PAYMENT_METHOD_LABELS[method] || method || "—";

/** Allowed next statuses from current (by fulfillment), iiko-aligned. */
export const nextOrderStatuses = (
  status: OrderStatus,
  fulfillmentMode: FulfillmentMode,
): OrderStatus[] => {
  switch (status) {
    case "Unconfirmed":
      return ["WaitCooking", "Cancelled"];
    case "WaitCooking":
      return ["ReadyForCooking", "CookingStarted", "Cancelled"];
    case "ReadyForCooking":
      return ["CookingStarted", "Cancelled"];
    case "CookingStarted":
      return ["CookingCompleted", "Cancelled"];
    case "CookingCompleted":
      return ["Waiting", "Cancelled"];
    case "Waiting":
      return fulfillmentMode === "delivery"
        ? ["OnWay", "Cancelled"]
        : ["Cancelled"];
    case "OnWay":
      return ["Delivered", "Cancelled"];
    case "Delivered":
      return ["Cancelled"];
    case "Closed":
    case "Cancelled":
      return [];
    default:
      return [];
  }
};

export const generateOrderNumber = (): string =>
  `D-${randomBytes(3).toString("hex").toUpperCase()}`;

export const rubFromPriceString = (price: string, qty: number): number =>
  Math.round(parsePriceNumber(price) * Math.max(1, qty));

export type OrderItemPublic = {
  id: string;
  productId: string;
  name: string;
  price: string;
  image: string;
  categoryId: string;
  categoryName: string;
  qty: number;
  lineTotalRub: number;
};

export type OrderStatusLogPublic = {
  id: string;
  status: OrderStatus;
  note: string;
  createdAt: string;
};

export type OrderPublic = {
  id: string;
  number: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentMode: FulfillmentMode;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  totalRub: number;
  deliveryFeeRub: number;
  utensils: number;
  comment: string;
  pickupPointId: string | null;
  pickupPointName: string;
  pickupPointAddress: string;
  deliveryAddress: string;
  deliveryApartment: string;
  deliveryEntrance: string;
  deliveryFloor: string;
  deliveryIntercom: string;
  deliveryCourierComment: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: string;
  scheduledAt: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  iikoOrderId: string | null;
  iikoCreationStatus: string;
  iikoSyncError: string;
  statusUpdatedAt: string;
  createdAt: string;
  items: OrderItemPublic[];
  statusLogs: OrderStatusLogPublic[];
};

export const toOrderPublic = (row: {
  id: string;
  number: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentMode: FulfillmentMode;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  totalRub: number;
  deliveryFeeRub?: number | null;
  utensils: number;
  comment: string;
  pickupPointId: string | null;
  pickupPointName: string;
  pickupPointAddress: string;
  deliveryAddress: string;
  deliveryApartment?: string | null;
  deliveryEntrance?: string | null;
  deliveryFloor?: string | null;
  deliveryIntercom?: string | null;
  deliveryCourierComment?: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: string;
  scheduledAt: Date | null;
  paidAt: Date | null;
  fulfilledAt: Date | null;
  iikoOrderId?: string | null;
  iikoCreationStatus?: string | null;
  iikoSyncError?: string | null;
  statusUpdatedAt: Date;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: string;
    image: string;
    categoryId: string;
    categoryName: string;
    qty: number;
    lineTotalRub: number;
  }>;
  statusLogs: Array<{
    id: string;
    status: OrderStatus;
    note: string;
    createdAt: Date;
  }>;
}): OrderPublic => ({
  id: row.id,
  number: row.number,
  customerId: row.customerId,
  customerName: row.customerName,
  customerPhone: row.customerPhone,
  customerEmail: row.customerEmail,
  fulfillmentMode: row.fulfillmentMode,
  status: row.status,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  totalRub: row.totalRub,
  deliveryFeeRub: row.deliveryFeeRub ?? 0,
  utensils: row.utensils,
  comment: row.comment,
  pickupPointId: row.pickupPointId,
  pickupPointName: row.pickupPointName,
  pickupPointAddress: row.pickupPointAddress,
  deliveryAddress: row.deliveryAddress,
  deliveryApartment: row.deliveryApartment?.trim() || "",
  deliveryEntrance: row.deliveryEntrance?.trim() || "",
  deliveryFloor: row.deliveryFloor?.trim() || "",
  deliveryIntercom: row.deliveryIntercom?.trim() || "",
  deliveryCourierComment: row.deliveryCourierComment?.trim() || "",
  deliveryLat: row.deliveryLat,
  deliveryLng: row.deliveryLng,
  timeMode: row.timeMode,
  scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
  paidAt: row.paidAt ? row.paidAt.toISOString() : null,
  fulfilledAt: row.fulfilledAt ? row.fulfilledAt.toISOString() : null,
  iikoOrderId: row.iikoOrderId ?? null,
  iikoCreationStatus: row.iikoCreationStatus?.trim() || "",
  iikoSyncError: row.iikoSyncError?.trim() || "",
  statusUpdatedAt: row.statusUpdatedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  items: row.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.name,
    price: item.price,
    image: item.image,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    qty: item.qty,
    lineTotalRub: item.lineTotalRub,
  })),
  statusLogs: row.statusLogs.map((log) => ({
    id: log.id,
    status: log.status,
    note: log.note,
    createdAt: log.createdAt.toISOString(),
  })),
});
