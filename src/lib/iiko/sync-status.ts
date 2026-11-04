import { getIikoConfig, isIikoConfigured, type IikoConfig } from "@/lib/iiko/config";
import { IikoApiError, iikoRequest } from "@/lib/iiko/client";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { FulfillmentMode } from "@/lib/customer-auth";

type IikoDeliveryByIdRow = {
  id?: string;
  creationStatus?: string;
  errorInfo?: { message?: string; description?: string } | null;
  order?: {
    status?: string;
  } | null;
};

type IikoDeliveriesByIdResponse = {
  correlationId?: string;
  orders?: IikoDeliveryByIdRow[];
};

const STATUS_SET = new Set<string>(ORDER_STATUSES);

export const parseIikoDeliveryStatus = (
  raw: string | null | undefined,
): OrderStatus | null => {
  const value = String(raw ?? "").trim();
  if (!value || !STATUS_SET.has(value)) return null;
  return value as OrderStatus;
};

export const fetchIikoDeliveriesByIds = async (
  orderIds: string[],
  config: IikoConfig = getIikoConfig(),
): Promise<IikoDeliveryByIdRow[]> => {
  if (!isIikoConfigured(config) || orderIds.length === 0) return [];

  const unique = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];

  const response = await iikoRequest<IikoDeliveriesByIdResponse>(
    "/api/1/deliveries/by_id",
    {
      organizationId: config.organizationId,
      orderIds: unique,
    },
    config,
  );

  return Array.isArray(response.orders) ? response.orders : [];
};

export type SyncIikoOrderResult = {
  orderId: string;
  changed: boolean;
  statusChanged: boolean;
  status: OrderStatus;
  previousStatus: OrderStatus;
  iikoCreationStatus: string;
  customerId: string | null;
  orderNumber: string;
  fulfillmentMode: FulfillmentMode;
  error?: string;
};

/**
 * Pull delivery statuses from iiko for open local orders and update DB.
 * Mirrors iiko `order.status` — admin must not invent transitions.
 */
export const syncOpenOrdersFromIiko = async (options?: {
  localOrderIds?: string[];
  take?: number;
}): Promise<SyncIikoOrderResult[]> => {
  if (!isIikoConfigured()) return [];

  const rows = await prisma.order.findMany({
    where: {
      iikoOrderId: { not: null },
      status: { notIn: ["Closed", "Cancelled"] },
      ...(options?.localOrderIds?.length
        ? { id: { in: options.localOrderIds } }
        : {}),
    },
    select: {
      id: true,
      status: true,
      iikoOrderId: true,
      iikoCreationStatus: true,
      iikoSyncError: true,
      customerId: true,
      number: true,
      fulfillmentMode: true,
    },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 80,
  });

  if (!rows.length) return [];

  const byIikoId = new Map(
    rows
      .filter((row): row is typeof row & { iikoOrderId: string } =>
        Boolean(row.iikoOrderId),
      )
      .map((row) => [row.iikoOrderId, row]),
  );

  let remote: IikoDeliveryByIdRow[] = [];
  try {
    remote = await fetchIikoDeliveriesByIds([...byIikoId.keys()]);
  } catch (error) {
    const message =
      error instanceof IikoApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "iiko sync failed";
    return rows.map((row) => ({
      orderId: row.id,
      changed: false,
      statusChanged: false,
      status: row.status as OrderStatus,
      previousStatus: row.status as OrderStatus,
      iikoCreationStatus: row.iikoCreationStatus,
      customerId: row.customerId,
      orderNumber: row.number,
      fulfillmentMode: row.fulfillmentMode as FulfillmentMode,
      error: message.slice(0, 500),
    }));
  }

  const results: SyncIikoOrderResult[] = [];
  const now = new Date();

  for (const remoteOrder of remote) {
    const iikoId = String(remoteOrder.id ?? "").trim();
    const local = iikoId ? byIikoId.get(iikoId) : undefined;
    if (!local) continue;

    const previousStatus = local.status as OrderStatus;
    const creationStatus = String(remoteOrder.creationStatus ?? "").trim();
    const nextStatus = parseIikoDeliveryStatus(remoteOrder.order?.status);
    const remoteError =
      remoteOrder.errorInfo?.message ||
      remoteOrder.errorInfo?.description ||
      "";

    const data: {
      iikoCreationStatus?: string;
      iikoSyncError?: string;
      status?: OrderStatus;
      statusUpdatedAt?: Date;
      fulfilledAt?: Date | null;
      statusLogs?: { create: { status: OrderStatus; note: string } };
    } = {};

    let metaChanged = false;

    if (creationStatus && creationStatus !== local.iikoCreationStatus) {
      data.iikoCreationStatus = creationStatus.slice(0, 32);
      metaChanged = true;
    }

    if (creationStatus === "Error" && remoteError) {
      if (remoteError.slice(0, 500) !== local.iikoSyncError) {
        data.iikoSyncError = remoteError.slice(0, 500);
        metaChanged = true;
      }
    } else if (
      creationStatus === "Success" &&
      local.iikoSyncError
    ) {
      data.iikoSyncError = "";
      metaChanged = true;
    }

    const statusChanged = Boolean(nextStatus && nextStatus !== previousStatus);
    if (statusChanged && nextStatus) {
      data.status = nextStatus;
      data.statusUpdatedAt = now;
      data.statusLogs = {
        create: {
          status: nextStatus,
          note: "Статус из iiko",
        },
      };
      if (nextStatus === "Closed") {
        data.fulfilledAt = now;
      }
    }

    if (!metaChanged && !statusChanged) {
      results.push({
        orderId: local.id,
        changed: false,
        statusChanged: false,
        status: previousStatus,
        previousStatus,
        iikoCreationStatus: creationStatus || local.iikoCreationStatus,
        customerId: local.customerId,
        orderNumber: local.number,
        fulfillmentMode: local.fulfillmentMode as FulfillmentMode,
      });
      continue;
    }

    const updated = await prisma.order.update({
      where: { id: local.id },
      data,
      select: {
        id: true,
        status: true,
        iikoCreationStatus: true,
        customerId: true,
        number: true,
        fulfillmentMode: true,
      },
    });

    results.push({
      orderId: updated.id,
      changed: true,
      statusChanged,
      status: updated.status as OrderStatus,
      previousStatus,
      iikoCreationStatus: updated.iikoCreationStatus,
      customerId: updated.customerId,
      orderNumber: updated.number,
      fulfillmentMode: updated.fulfillmentMode as FulfillmentMode,
    });
  }

  return results;
};
