import { randomBytes } from "crypto";
import type { FulfillmentMode } from "@/lib/customer-auth";

const parsePriceNumber = (price: string): number => {
  const match = String(price ?? "").replace(",", ".").match(/[\d.]+/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
};

export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivering"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  preparing: "Готовится",
  ready: "Готов",
  delivering: "В пути",
  completed: "Выдан",
  cancelled: "Отменён",
};

export const ORDER_STATUS_HINTS: Record<OrderStatus, string> = {
  new: "Заказ только что оформлен",
  confirmed: "Принят в работу",
  preparing: "Кухня готовит заказ",
  ready: "Можно выдавать / отдавать курьеру",
  delivering: "Курьер везёт клиенту",
  completed: "Клиент получил заказ",
  cancelled: "Заказ отменён",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
};

/** Allowed next statuses from current (by fulfillment). */
export const nextOrderStatuses = (
  status: OrderStatus,
  fulfillmentMode: FulfillmentMode,
): OrderStatus[] => {
  switch (status) {
    case "new":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["preparing", "cancelled"];
    case "preparing":
      return ["ready", "cancelled"];
    case "ready":
      return fulfillmentMode === "delivery"
        ? ["delivering", "cancelled"]
        : ["completed", "cancelled"];
    case "delivering":
      return ["completed", "cancelled"];
    case "completed":
    case "cancelled":
      return [];
    default:
      return [];
  }
};

export const generateOrderNumber = (): string =>
  `D-${randomBytes(3).toString("hex").toUpperCase()}`;

/** Opaque handoff code shown as customer QR (pickup desk / courier). */
export const generateFulfillmentToken = (): string =>
  randomBytes(8).toString("hex").toUpperCase();

export const FULFILLMENT_QR_PREFIX = "DN1.";

export const encodeFulfillmentQrPayload = (token: string): string =>
  `${FULFILLMENT_QR_PREFIX}${token.trim().toUpperCase()}`;

export const parseFulfillmentQrPayload = (raw: string): string | null => {
  const compact = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s·._-]+/g, "");
  if (!compact) return null;
  const body = compact.startsWith("DN1") ? compact.slice(3) : compact;
  return /^[A-F0-9]{16}$/.test(body) ? body : null;
};

/** When staff/courier may scan QR to hand over the order. */
export const canFulfillOrderByQr = (
  status: OrderStatus,
  fulfillmentMode: FulfillmentMode,
): boolean => {
  if (status === "completed" || status === "cancelled") return false;
  if (fulfillmentMode === "pickup") return status === "ready";
  return status === "ready" || status === "delivering";
};

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
  fulfillmentToken: string;
  fulfilledAt: string | null;
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
  fulfillmentToken: string;
  fulfilledAt: Date | null;
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
  fulfillmentToken: row.fulfillmentToken,
  fulfilledAt: row.fulfilledAt ? row.fulfilledAt.toISOString() : null,
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
