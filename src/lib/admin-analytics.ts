import type { OrderStatus } from "@/lib/orders";

export const ANALYTICS_RANGES = ["today", "7d", "30d", "90d", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  all: "Всё время",
};

/** Successful / money-making terminal statuses. */
export const COMPLETED_ORDER_STATUSES = [
  "Delivered",
  "Closed",
] as const satisfies readonly OrderStatus[];

export type CompletedOrderStatus = (typeof COMPLETED_ORDER_STATUSES)[number];

export const isCompletedOrderStatus = (
  status: string,
): status is CompletedOrderStatus =>
  (COMPLETED_ORDER_STATUSES as readonly string[]).includes(status);

export type AnalyticsKpis = {
  customersTotal: number;
  customersWithOrders: number;
  customersWithoutOrders: number;
  customersNewInPeriod: number;
  customersYandex: number;
  customersWithPassword: number;
  couriersTotal: number;
  ordersTotal: number;
  ordersCompleted: number;
  ordersCancelled: number;
  ordersActive: number;
  ordersGuest: number;
  ordersWithAccount: number;
  revenueCompletedRub: number;
  revenuePaidRub: number;
  revenueActiveRub: number;
  revenueCancelledRub: number;
  avgCheckCompletedRub: number;
  maxCheckCompletedRub: number;
  minCheckCompletedRub: number;
  itemsSoldCompleted: number;
  uniqueProductsSold: number;
  avgItemsPerCompletedOrder: number;
  deliveryOrders: number;
  pickupOrders: number;
  deliveryFeesRub: number;
  asapOrders: number;
  scheduledOrders: number;
  cancelRatePct: number;
  repeatBuyers: number;
  oneTimeBuyers: number;
  /** Live carts (not period-scoped) */
  cartsWithItems: number;
  cartUnitsTotal: number;
  cartLinesTotal: number;
  cartValueEstimateRub: number;
  activeSessions: number;
  pushCustomers: number;
  pushDevices: number;
  iikoOk: number;
  iikoError: number;
  iikoOther: number;
};

export type AnalyticsStatusSlice = {
  status: OrderStatus;
  count: number;
  totalRub: number;
};

export type AnalyticsNamedSlice = {
  key: string;
  label: string;
  count: number;
  totalRub: number;
};

export type AnalyticsDayPoint = {
  /** YYYY-MM-DD in Europe/Moscow */
  day: string;
  label: string;
  orders: number;
  completed: number;
  cancelled: number;
  revenueRub: number;
};

export type AnalyticsHourPoint = {
  hour: number;
  label: string;
  orders: number;
  revenueRub: number;
};

export type AnalyticsProductRow = {
  productId: string;
  name: string;
  categoryName: string;
  qty: number;
  revenueRub: number;
  orders: number;
};

export type AnalyticsCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  ordersCount: number;
  spentRub: number;
  lastOrderAt: string | null;
  createdAt: string;
};

export type AnalyticsCartProductRow = {
  productId: string;
  name: string;
  categoryName: string;
  qty: number;
  valueRub: number;
  carts: number;
};

export type AnalyticsAbandonedCartRow = {
  cartId: string;
  customerId: string;
  name: string;
  phone: string | null;
  units: number;
  lines: number;
  valueRub: number;
  fulfillmentMode: string;
  updatedAt: string;
};

export type AdminAnalyticsPayload = {
  range: AnalyticsRange;
  from: string | null;
  to: string;
  generatedAt: string;
  kpis: AnalyticsKpis;
  byStatus: AnalyticsStatusSlice[];
  byFulfillment: AnalyticsNamedSlice[];
  byPaymentStatus: AnalyticsNamedSlice[];
  byPaymentMethod: AnalyticsNamedSlice[];
  byPickupPoint: AnalyticsNamedSlice[];
  byTimeMode: AnalyticsNamedSlice[];
  byIiko: AnalyticsNamedSlice[];
  daily: AnalyticsDayPoint[];
  byHour: AnalyticsHourPoint[];
  topProducts: AnalyticsProductRow[];
  topCustomers: AnalyticsCustomerRow[];
  customersWithoutOrders: AnalyticsCustomerRow[];
  topCartProducts: AnalyticsCartProductRow[];
  abandonedCarts: AnalyticsAbandonedCartRow[];
};

/** Moscow calendar day key for a Date. */
export const moscowDayKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
};

export const moscowHour = (date: Date): number => {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const n = Number(hour);
  return Number.isFinite(n) ? n % 24 : 0;
};

/** Start of Moscow calendar day as UTC Date (approximate via offset parse). */
export const startOfMoscowDay = (base = new Date()): Date => {
  const key = moscowDayKey(base);
  return new Date(`${key}T00:00:00+03:00`);
};

export const resolveAnalyticsWindow = (
  range: AnalyticsRange,
  now = new Date(),
): { from: Date | null; to: Date } => {
  const to = now;
  if (range === "all") return { from: null, to };
  if (range === "today") return { from: startOfMoscowDay(now), to };
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const from = new Date(
    startOfMoscowDay(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000,
  );
  return { from, to };
};

export const formatRubCompact = (rub: number): string => {
  const n = Math.round(rub);
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
};

export const formatDayLabel = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
};
