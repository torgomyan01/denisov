import {
  createIikoDeliveryOrderReliable,
  isIikoProductId,
  isRetriableIikoCreationError,
  type IikoCreateModifier,
  type IikoCreateOrderInput,
} from "@/lib/iiko/create-delivery";
import { loadIikoDefaultModifiersByProductId } from "@/lib/iiko/catalog-cache";
import { isIikoConfigured } from "@/lib/iiko/config";
import { prisma } from "@/lib/prisma";

const AUTO_RETRY_NOTE_PREFIX = "iiko автоповтор";
const MAX_AUTO_RETRIES = 3;
/** Don't hammer the same order more often than this. */
const MIN_GAP_BETWEEN_AUTO_RETRIES_MS = 90_000;
const MAX_ORDERS_PER_CYCLE = 4;

const parseStoredModifiers = (
  raw: string | null | undefined,
): IikoCreateModifier[] => {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: IikoCreateModifier[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      const groupId =
        typeof r.groupId === "string"
          ? r.groupId
          : typeof r.productGroupId === "string"
            ? r.productGroupId
            : "";
      if (!productId || !groupId) continue;
      out.push({
        productId,
        productGroupId: groupId,
        amount:
          typeof r.amount === "number" && Number.isFinite(r.amount)
            ? Math.max(1, Math.round(r.amount))
            : 1,
        name: typeof r.name === "string" ? r.name : "",
      });
    }
    return out;
  } catch {
    return [];
  }
};

const buildInputFromOrder = async (
  order: {
    number: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    fulfillmentMode: "pickup" | "delivery";
    comment: string;
    utensils: number;
    totalRub: number;
    deliveryFeeRub: number;
    paymentStatus: string;
    paymentMethod: string;
    timeMode: string;
    scheduledAt: Date | null;
    deliveryAddress: string;
    deliveryApartment: string;
    deliveryEntrance: string;
    deliveryFloor: string;
    deliveryIntercom: string;
    deliveryCourierComment: string;
    deliveryLat: number | null;
    deliveryLng: number | null;
    items: Array<{
      productId: string;
      name: string;
      price: string;
      qty: number;
      modifiersJson: string;
    }>;
  },
): Promise<IikoCreateOrderInput | { error: string }> => {
  for (const line of order.items) {
    if (!isIikoProductId(line.productId)) {
      return { error: `«${line.name}» без корректного iiko productId` };
    }
  }

  const defaultModifiersByProduct = await loadIikoDefaultModifiersByProductId();

  return {
    orderNumber: order.number,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    fulfillmentMode: order.fulfillmentMode,
    comment: order.comment,
    utensils: order.utensils,
    totalRub: order.totalRub,
    deliveryFeeRub: order.deliveryFeeRub,
    paymentStatus: order.paymentStatus as IikoCreateOrderInput["paymentStatus"],
    paymentMethod: order.paymentMethod,
    timeMode: order.timeMode,
    scheduledAt: order.scheduledAt,
    deliveryAddress: order.deliveryAddress,
    deliveryApartment: order.deliveryApartment,
    deliveryEntrance: order.deliveryEntrance,
    deliveryFloor: order.deliveryFloor,
    deliveryIntercom: order.deliveryIntercom,
    deliveryCourierComment: order.deliveryCourierComment,
    deliveryLat: order.deliveryLat,
    deliveryLng: order.deliveryLng,
    items: order.items.map((line) => {
      const stored = parseStoredModifiers(line.modifiersJson);
      const defaults = defaultModifiersByProduct.get(line.productId) || [];
      const fallback: IikoCreateModifier[] = defaults.map((mod) => ({
        productId: mod.productId,
        productGroupId: mod.productGroupId,
        amount: mod.amount,
        name: mod.name,
      }));
      const modifiers = stored.length ? stored : fallback;
      return {
        productId: line.productId,
        name: line.name,
        iikoProductId: line.productId,
        price: line.price,
        qty: line.qty,
        ...(modifiers.length ? { modifiers } : {}),
      };
    }),
  };
};

export type AutoRetryIikoResult = {
  orderId: string;
  retried: boolean;
  success: boolean;
  error?: string;
};

/**
 * Background safety net: re-create deliveries that failed with a transient
 * iiko error (timeout etc.). Called from the periodic status sync.
 */
export const autoRetryFailedIikoCreations = async (): Promise<
  AutoRetryIikoResult[]
> => {
  if (!isIikoConfigured()) return [];

  const candidates = await prisma.order.findMany({
    where: {
      status: { notIn: ["Closed", "Cancelled"] },
      OR: [
        { iikoCreationStatus: "Error" },
        {
          AND: [
            { iikoCreationStatus: "InProgress" },
            {
              updatedAt: {
                lt: new Date(Date.now() - 5 * 60_000),
              },
            },
          ],
        },
        {
          AND: [
            { iikoOrderId: null },
            { iikoSyncError: { not: "" } },
          ],
        },
      ],
    },
    include: {
      items: true,
      statusLogs: {
        where: { note: { startsWith: AUTO_RETRY_NOTE_PREFIX } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const results: AutoRetryIikoResult[] = [];
  let processed = 0;

  for (const order of candidates) {
    if (processed >= MAX_ORDERS_PER_CYCLE) break;

    const retryCount = order.statusLogs.length;
    if (retryCount >= MAX_AUTO_RETRIES) {
      results.push({
        orderId: order.id,
        retried: false,
        success: false,
        error: "Лимит автоповторов исчерпан",
      });
      continue;
    }

    const lastRetryAt = order.statusLogs[0]?.createdAt?.getTime() ?? 0;
    if (
      lastRetryAt &&
      Date.now() - lastRetryAt < MIN_GAP_BETWEEN_AUTO_RETRIES_MS
    ) {
      continue;
    }

    const errText = order.iikoSyncError || "";
    const looksRetriable =
      order.iikoCreationStatus === "InProgress" ||
      !errText ||
      isRetriableIikoCreationError(errText);

    if (!looksRetriable) {
      continue;
    }

    const input = await buildInputFromOrder({
      ...order,
      fulfillmentMode: order.fulfillmentMode as "pickup" | "delivery",
    });
    if ("error" in input) {
      results.push({
        orderId: order.id,
        retried: false,
        success: false,
        error: input.error,
      });
      continue;
    }

    processed += 1;
    const attemptNo = retryCount + 1;
    const iikoResult = await createIikoDeliveryOrderReliable(input, {
      maxAttempts: 2,
      pollMaxMs: 16_000,
    });

    if (iikoResult.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          iikoOrderId: iikoResult.iikoOrderId,
          iikoCorrelationId: iikoResult.correlationId || null,
          iikoCreationStatus: iikoResult.creationStatus,
          iikoSyncError: "",
          statusLogs: {
            create: {
              status: order.status,
              note: `${AUTO_RETRY_NOTE_PREFIX} #${attemptNo}: ${iikoResult.creationStatus}`.slice(
                0,
                255,
              ),
            },
          },
        },
      });
      results.push({
        orderId: order.id,
        retried: true,
        success: iikoResult.creationStatus === "Success",
      });
      continue;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        iikoOrderId: iikoResult.iikoOrderId || order.iikoOrderId,
        iikoCorrelationId:
          iikoResult.correlationId || order.iikoCorrelationId,
        iikoCreationStatus: iikoResult.creationStatus || "Error",
        iikoSyncError: iikoResult.error.slice(0, 500),
        statusLogs: {
          create: {
            status: order.status,
            note: `${AUTO_RETRY_NOTE_PREFIX} #${attemptNo}: ${iikoResult.error}`.slice(
              0,
              255,
            ),
          },
        },
      },
    });
    results.push({
      orderId: order.id,
      retried: true,
      success: false,
      error: iikoResult.error,
    });
  }

  return results;
};
