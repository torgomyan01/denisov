import { getIikoConfig, isIikoConfigured, type IikoConfig } from "@/lib/iiko/config";
import { IikoApiError, iikoRequest } from "@/lib/iiko/client";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";

export type IikoDeliveryListItem = {
  id: string;
  number: string;
  status: OrderStatus | string;
  creationStatus: string;
  phone: string;
  customerName: string;
  orderServiceType: string;
  completeBefore: string | null;
  whenCreated: string | null;
  whenClosed: string | null;
  comment: string;
  sum: number | null;
  sourceKey: string;
  address: string;
  items: Array<{
    name: string;
    amount: number;
    sum: number | null;
  }>;
  problem: string;
  error: string;
};

type RemoteOrderInfo = {
  id?: string;
  creationStatus?: string;
  errorInfo?: { message?: string; description?: string } | null;
  order?: {
    number?: number | string;
    externalNumber?: string | null;
    status?: string;
    phone?: string;
    comment?: string;
    completeBefore?: string | null;
    whenCreated?: string | null;
    whenClosed?: string | null;
    orderServiceType?: string;
    sourceKey?: string | null;
    sum?: number | null;
    customer?: { name?: string | null } | null;
    deliveryPoint?: {
      address?: {
        street?: { name?: string | null } | null;
        house?: string | null;
        flat?: string | null;
        line1?: string | null;
      } | null;
      comment?: string | null;
    } | null;
    items?: Array<{
      product?: { name?: string | null } | string | null;
      name?: string | null;
      type?: string;
      amount?: number;
      sum?: number | null;
      price?: number | null;
    }> | null;
    problem?: { message?: string | null } | null;
  } | null;
};

type ByDateAndStatusResponse = {
  correlationId?: string;
  ordersByOrganizations?: Array<{
    organizationId?: string;
    orders?: RemoteOrderInfo[];
  }>;
};

const STATUS_SET = new Set<string>(ORDER_STATUSES);

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** Local calendar day → iiko `yyyy-MM-dd HH:mm:ss.SSS` */
export const formatIikoDateTime = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
  `${pad(date.getMilliseconds(), 3)}`;

export const startOfLocalDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfLocalDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatAddress = (order: NonNullable<RemoteOrderInfo["order"]>): string => {
  const addr = order.deliveryPoint?.address;
  if (!addr) return "";
  if (addr.line1?.trim()) return addr.line1.trim();
  const parts = [
    addr.street?.name?.trim(),
    addr.house?.trim() ? `д. ${addr.house.trim()}` : "",
    addr.flat?.trim() ? `кв. ${addr.flat.trim()}` : "",
  ].filter(Boolean);
  return parts.join(", ");
};

const mapRemoteOrder = (row: RemoteOrderInfo): IikoDeliveryListItem => {
  const order = row.order;
  const statusRaw = String(order?.status ?? "").trim();
  const status = STATUS_SET.has(statusRaw) ? statusRaw : statusRaw || "—";
  const number =
    String(order?.externalNumber ?? "").trim() ||
    (order?.number != null ? String(order.number) : "") ||
    String(row.id ?? "").slice(0, 8);

  const items = (order?.items || [])
    .filter((item) => item && item.type !== "Compound")
    .map((item) => {
      const productName =
        typeof item.product === "object" && item.product
          ? String(item.product.name ?? "").trim()
          : "";
      return {
        name: String(item.name || productName || "Позиция").trim(),
        amount: Number(item.amount) || 0,
        sum:
          typeof item.sum === "number" && Number.isFinite(item.sum)
            ? item.sum
            : typeof item.price === "number" && Number.isFinite(item.price)
              ? item.price * (Number(item.amount) || 0)
              : null,
      };
    });

  return {
    id: String(row.id ?? ""),
    number,
    status,
    creationStatus: String(row.creationStatus ?? "").trim(),
    phone: String(order?.phone ?? "").trim(),
    customerName: String(order?.customer?.name ?? "").trim(),
    orderServiceType: String(order?.orderServiceType ?? "").trim(),
    completeBefore: order?.completeBefore ?? null,
    whenCreated: order?.whenCreated ?? null,
    whenClosed: order?.whenClosed ?? null,
    comment: String(order?.comment ?? "").trim(),
    sum:
      typeof order?.sum === "number" && Number.isFinite(order.sum)
        ? order.sum
        : null,
    sourceKey: String(order?.sourceKey ?? "").trim(),
    address: order ? formatAddress(order) : "",
    items,
    problem: String(order?.problem?.message ?? "").trim(),
    error: String(
      row.errorInfo?.message || row.errorInfo?.description || "",
    ).trim(),
  };
};

export const listIikoDeliveriesByDate = async (input?: {
  dateFrom?: Date;
  dateTo?: Date;
  statuses?: string[];
  config?: IikoConfig;
}): Promise<
  | { ok: true; orders: IikoDeliveryListItem[] }
  | { ok: false; error: string }
> => {
  const config = input?.config ?? getIikoConfig();
  if (!isIikoConfigured(config)) {
    return { ok: false, error: "iiko не настроен (.env)" };
  }

  const from = input?.dateFrom ?? startOfLocalDay(new Date());
  const to = input?.dateTo ?? endOfLocalDay(new Date());

  try {
    const body: Record<string, unknown> = {
      organizationIds: [config.organizationId],
      deliveryDateFrom: formatIikoDateTime(from),
      deliveryDateTo: formatIikoDateTime(to),
    };
    if (input?.statuses?.length) {
      body.statuses = input.statuses;
    }

    const response = await iikoRequest<ByDateAndStatusResponse>(
      "/api/1/deliveries/by_delivery_date_and_status",
      body,
      config,
    );

    const orders: IikoDeliveryListItem[] = [];
    for (const org of response.ordersByOrganizations || []) {
      for (const row of org.orders || []) {
        if (!row?.id) continue;
        orders.push(mapRemoteOrder(row));
      }
    }

    orders.sort((a, b) => {
      const ta = a.whenCreated || a.completeBefore || "";
      const tb = b.whenCreated || b.completeBefore || "";
      return tb.localeCompare(ta);
    });

    return { ok: true, orders };
  } catch (error) {
    const message =
      error instanceof IikoApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Не удалось загрузить заказы iiko";
    return { ok: false, error: message.slice(0, 500) };
  }
};
