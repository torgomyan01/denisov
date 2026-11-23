import { randomUUID } from "crypto";
import { getIikoConfig, isIikoConfigured, type IikoConfig } from "@/lib/iiko/config";
import { IikoApiError, iikoRequest } from "@/lib/iiko/client";
import { fetchIikoDeliveriesByIds } from "@/lib/iiko/sync-status";
import { rubFromPriceString } from "@/lib/orders";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Transient iiko failures we should retry from our side. */
export const isRetriableIikoCreationError = (error: string): boolean => {
  const t = error.toLowerCase();
  if (
    t.includes("не настроен") ||
    t.includes("некорректн") ||
    t.includes("телефон") ||
    t.includes("productid") ||
    t.includes("uuid") ||
    t.includes("нет iiko") ||
    t.includes("payment_type") ||
    t.includes("payment type")
  ) {
    return false;
  }
  if (!t.trim()) return true;
  return (
    t.includes("timeout") ||
    t.includes("transited to error") ||
    t.includes("creationstatus=error") ||
    t.includes("creation status") ||
    t.includes("временно") ||
    t.includes("try again") ||
    t.includes("unavailable") ||
    t.includes("econnreset") ||
    t.includes("etimedout") ||
    t.includes("socket") ||
    t.includes("502") ||
    t.includes("503") ||
    t.includes("504") ||
    t.includes("429") ||
    t.includes("network") ||
    t.includes("fetch failed") ||
    t.includes("iiko вернул creationstatus=error")
  );
};

export type IikoCreateModifier = {
  productId: string;
  productGroupId: string;
  amount: number;
  name?: string;
};

export type IikoCreateLine = {
  /** Our MenuItem id (for errors) */
  productId: string;
  name: string;
  /** iiko product UUID */
  iikoProductId: string;
  price: string;
  qty: number;
  /** Required / selected modifiers (productGroupId + child productId). */
  modifiers?: IikoCreateModifier[];
};

export type IikoCreateOrderInput = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fulfillmentMode: "pickup" | "delivery";
  comment: string;
  utensils: number;
  totalRub: number;
  deliveryFeeRub: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  /** sber | on_receipt — needed so pending online is not labeled «при получении» */
  paymentMethod?: string;
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
  items: IikoCreateLine[];
};

export type IikoCreateOrderResult =
  | {
      ok: true;
      iikoOrderId: string;
      correlationId: string;
      creationStatus: string;
    }
  | {
      ok: false;
      error: string;
      iikoOrderId?: string;
      correlationId?: string;
      creationStatus?: string;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isIikoProductId = (value: string): boolean => UUID_RE.test(value.trim());

/** Normalize RU phones to +7… as required by iiko. */
export const normalizeIikoPhone = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  if (digits.length >= 8) {
    return `+${digits}`;
  }
  return null;
};

const parseHouseFromAddress = (address: string): { street: string; house: string } => {
  const cleaned = address.replace(/\s+/g, " ").trim();
  if (!cleaned) return { street: "Адрес", house: "1" };

  // «…, д. 12» / «… д 12к1» / trailing «12» / «12/3»
  const houseMatch = cleaned.match(
    /(?:,?\s*(?:д\.?|дом)\s*)(\d+[а-яА-Яa-zA-Z]?(?:[\/\-]\d+[а-яА-Яa-zA-Z]?)?)\s*$/i,
  );
  if (houseMatch?.[1]) {
    const house = houseMatch[1];
    const street = cleaned
      .slice(0, houseMatch.index)
      .replace(/[,\s]+$/g, "")
      .trim();
    return {
      street: (street || cleaned).slice(0, 60),
      house: house.slice(0, 10),
    };
  }

  const trailing = cleaned.match(/(\d+[а-яА-Яa-zA-Z]?(?:[\/\-]\d+)?)\s*$/);
  if (trailing?.[1] && trailing.index != null && trailing.index > 0) {
    return {
      street: cleaned.slice(0, trailing.index).replace(/[,\s]+$/g, "").slice(0, 60) || cleaned.slice(0, 60),
      house: trailing[1].slice(0, 10),
    };
  }

  return { street: cleaned.slice(0, 60), house: "1" };
};

const formatCompleteBefore = (date: Date): string => {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    `${pad(date.getMilliseconds(), 3)}`
  );
};

export const buildIikoOrderComment = (input: {
  comment: string;
  utensils: number;
  fulfillmentMode: "pickup" | "delivery";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  deliveryCourierComment?: string;
}): string => {
  const parts: string[] = [];
  if (input.comment.trim()) parts.push(input.comment.trim());
  if (input.utensils > 0) parts.push(`Приборы: ${input.utensils}`);
  if (input.fulfillmentMode === "pickup") {
    parts.push("Самовывоз (сайт Денисов)");
  }
  if (input.paymentStatus === "paid") {
    parts.push("Оплата: онлайн");
  } else if (input.paymentStatus === "refunded") {
    parts.push("Оплата: возврат на карту");
  } else if (input.paymentStatus === "failed") {
    parts.push("Оплата: онлайн не прошла — ожидает повторной оплаты");
  } else if (input.paymentMethod === "sber") {
    parts.push("Оплата: онлайн (ожидает)");
  } else {
    parts.push("Оплата: при получении");
  }
  const courier = (input.deliveryCourierComment || "").trim();
  if (courier) parts.push(`Курьеру: ${courier}`);
  return parts.join(". ").slice(0, 500);
};

const buildComment = (input: IikoCreateOrderInput): string =>
  buildIikoOrderComment(input);

type CreateDeliveryResponse = {
  correlationId?: string;
  orderInfo?: {
    id?: string;
    creationStatus?: string;
    errorInfo?: { message?: string; description?: string; code?: string };
  };
};

export const createIikoDeliveryOrder = async (
  input: IikoCreateOrderInput,
  config: IikoConfig = getIikoConfig(),
): Promise<IikoCreateOrderResult> => {
  if (!isIikoConfigured(config)) {
    return { ok: false, error: "iiko не настроен (нет API ключей / organizationId)" };
  }

  const phone = normalizeIikoPhone(input.customerPhone);
  if (!phone) {
    return { ok: false, error: "Некорректный телефон для iiko (нужен +…)" };
  }

  for (const line of input.items) {
    if (!isIikoProductId(line.iikoProductId)) {
      return {
        ok: false,
        error: `У «${line.name}» нет корректного iikoProductId (UUID)`,
      };
    }
  }

  const orderId = randomUUID();
  const orderServiceType =
    input.fulfillmentMode === "delivery" ? "DeliveryByCourier" : "DeliveryByClient";

  const items = input.items.map((line) => {
    const unitRub = rubFromPriceString(line.price, 1);
    const modifiers = (line.modifiers || [])
      .filter(
        (mod) =>
          isIikoProductId(mod.productId) &&
          isIikoProductId(mod.productGroupId) &&
          mod.amount > 0,
      )
      .map((mod) => ({
        productId: mod.productId.trim(),
        productGroupId: mod.productGroupId.trim(),
        amount: mod.amount,
      }));

    return {
      type: "Product" as const,
      productId: line.iikoProductId.trim(),
      amount: line.qty,
      price: unitRub,
      positionId: randomUUID(),
      ...(modifiers.length ? { modifiers } : {}),
    };
  });

  const orderBody: Record<string, unknown> = {
    id: orderId,
    externalNumber: input.orderNumber.slice(0, 50),
    phone,
    orderServiceType,
    comment: buildComment(input) || null,
    customer: {
      type: "one-time",
      name: (input.customerName || "Гость").slice(0, 60),
    },
    items,
    sourceKey: config.sourceKey.slice(0, 100) || null,
  };

  if (input.timeMode === "scheduled" && input.scheduledAt) {
    orderBody.completeBefore = formatCompleteBefore(input.scheduledAt);
  }

  if (input.fulfillmentMode === "delivery") {
    const { street, house } = parseHouseFromAddress(input.deliveryAddress);
    const deliveryPoint: Record<string, unknown> = {
      address: {
        type: "legacy",
        street: {
          name: street.slice(0, 60) || "Адрес",
          city: config.city.slice(0, 60),
        },
        house: house.slice(0, 10) || "1",
        flat: input.deliveryApartment.slice(0, 100) || null,
        entrance: input.deliveryEntrance.slice(0, 10) || null,
        floor: input.deliveryFloor.slice(0, 10) || null,
        doorphone: input.deliveryIntercom.slice(0, 10) || null,
      },
      comment: [
        input.deliveryAddress,
        input.deliveryCourierComment,
      ]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(". ")
        .slice(0, 500) || null,
    };

    if (
      input.deliveryLat != null &&
      input.deliveryLng != null &&
      Number.isFinite(input.deliveryLat) &&
      Number.isFinite(input.deliveryLng)
    ) {
      deliveryPoint.coordinates = {
        latitude: input.deliveryLat,
        longitude: input.deliveryLng,
      };
    }

    orderBody.deliveryPoint = deliveryPoint;
  }

  if (input.paymentStatus === "paid" && config.paymentTypeId && isIikoProductId(config.paymentTypeId)) {
    orderBody.payments = [
      {
        paymentTypeKind: config.paymentTypeKind || "Card",
        sum: input.totalRub,
        paymentTypeId: config.paymentTypeId,
        isProcessedExternally: true,
      },
    ];
  }

  const requestBody: Record<string, unknown> = {
    organizationId: config.organizationId,
    order: orderBody,
  };
  if (config.terminalGroupId && isIikoProductId(config.terminalGroupId)) {
    requestBody.terminalGroupId = config.terminalGroupId;
  }

  try {
    const response = await iikoRequest<CreateDeliveryResponse>(
      "/api/1/deliveries/create",
      requestBody,
      config,
    );

    const info = response.orderInfo;
    const creationStatus = String(info?.creationStatus ?? "");
    const iikoOrderId = String(info?.id ?? orderId);
    const correlationId = String(response.correlationId ?? "");

    if (creationStatus === "Error") {
      const err =
        info?.errorInfo?.message ||
        info?.errorInfo?.description ||
        "iiko вернул creationStatus=Error";
      return {
        ok: false,
        error: err.slice(0, 500),
        iikoOrderId,
        correlationId,
        creationStatus,
      };
    }

    return {
      ok: true,
      iikoOrderId,
      correlationId,
      creationStatus: creationStatus || "InProgress",
    };
  } catch (error) {
    if (error instanceof IikoApiError) {
      return { ok: false, error: error.message.slice(0, 500) };
    }
    const message =
      error instanceof Error ? error.message : "Не удалось создать заказ в iiko";
    return { ok: false, error: message.slice(0, 500) };
  }
};

/**
 * Poll deliveries/by_id until creation settles (Success | Error) or time runs out.
 * If still InProgress — return ok with InProgress (background sync will continue).
 */
export const pollIikoCreationUntilSettled = async (
  iikoOrderId: string,
  options?: {
    maxMs?: number;
    intervalMs?: number;
    config?: IikoConfig;
  },
): Promise<IikoCreateOrderResult> => {
  const id = iikoOrderId.trim();
  if (!id || !isIikoProductId(id)) {
    return { ok: false, error: "Некорректный iiko order id для polling" };
  }

  const config = options?.config ?? getIikoConfig();
  const maxMs = options?.maxMs ?? 18_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < maxMs) {
    await sleep(intervalMs);
    try {
      const rows = await fetchIikoDeliveriesByIds([id], config);
      const row = rows[0];
      if (!row) continue;

      const status = String(row.creationStatus ?? "").trim();
      const errMsg =
        row.errorInfo?.message ||
        row.errorInfo?.description ||
        "";

      if (status === "Success") {
        return {
          ok: true,
          iikoOrderId: id,
          correlationId: "",
          creationStatus: "Success",
        };
      }

      if (status === "Error") {
        return {
          ok: false,
          error: (errMsg || "iiko вернул creationStatus=Error").slice(0, 500),
          iikoOrderId: id,
          correlationId: "",
          creationStatus: "Error",
        };
      }
    } catch (error) {
      // Keep polling through transient network blips.
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[iiko] creation poll:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return {
    ok: true,
    iikoOrderId: id,
    correlationId: "",
    creationStatus: "InProgress",
  };
};

export type IikoReliableCreateResult = IikoCreateOrderResult & {
  attempts: number;
};

/**
 * Create delivery in iiko with polling + immediate retries for transient errors
 * (e.g. «Creation timeout expired»). Maximizes success on our side.
 */
export const createIikoDeliveryOrderReliable = async (
  input: IikoCreateOrderInput,
  options?: {
    /** Create attempts (each may include polling). Default 2. */
    maxAttempts?: number;
    pollMaxMs?: number;
    pollIntervalMs?: number;
    config?: IikoConfig;
  },
): Promise<IikoReliableCreateResult> => {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 2);
  const config = options?.config ?? getIikoConfig();
  let last: IikoCreateOrderResult = {
    ok: false,
    error: "Не удалось создать заказ в iiko",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await createIikoDeliveryOrder(input, config);

    if (last.ok && last.creationStatus === "Success") {
      return { ...last, attempts: attempt };
    }

    if (last.ok && last.iikoOrderId && last.creationStatus !== "Success") {
      const polled = await pollIikoCreationUntilSettled(last.iikoOrderId, {
        maxMs: options?.pollMaxMs ?? 18_000,
        intervalMs: options?.pollIntervalMs ?? 2_000,
        config,
      });

      if (polled.ok && polled.creationStatus === "Success") {
        return {
          ok: true,
          iikoOrderId: polled.iikoOrderId,
          correlationId: last.correlationId || polled.correlationId,
          creationStatus: "Success",
          attempts: attempt,
        };
      }

      if (!polled.ok) {
        last = {
          ok: false,
          error: polled.error,
          iikoOrderId: polled.iikoOrderId || last.iikoOrderId,
          correlationId: last.correlationId || polled.correlationId,
          creationStatus: "Error",
        };
      } else if (polled.creationStatus === "InProgress") {
        // Not settled yet — keep InProgress; background auto-retry may help later.
        return {
          ok: true,
          iikoOrderId: last.iikoOrderId,
          correlationId: last.correlationId,
          creationStatus: "InProgress",
          attempts: attempt,
        };
      }
    }

    const errText = last.ok ? "" : last.error;
    const canRetry =
      attempt < maxAttempts &&
      (!last.ok ? isRetriableIikoCreationError(errText) : false);

    if (!canRetry) {
      return last.ok
        ? { ...last, attempts: attempt }
        : { ...last, attempts: attempt };
    }

    await sleep(2_000 * attempt);
  }

  return last.ok
    ? { ...last, attempts: maxAttempts }
    : { ...last, attempts: maxAttempts };
};

export type IikoPaymentSyncResult =
  | { ok: true; correlationId: string }
  | { ok: false; error: string };

/**
 * Add already-captured external payment to an existing delivery
 * (Sber paid after create). POST /api/1/deliveries/add_payments
 */
export const addIikoDeliveryPayments = async (
  input: {
    iikoOrderId: string;
    sumRub: number;
  },
  config: IikoConfig = getIikoConfig(),
): Promise<IikoPaymentSyncResult> => {
  if (!isIikoConfigured(config)) {
    return { ok: false, error: "iiko не настроен" };
  }
  if (!input.iikoOrderId.trim() || !isIikoProductId(input.iikoOrderId)) {
    return { ok: false, error: "Некорректный iiko order id" };
  }
  if (!config.paymentTypeId || !isIikoProductId(config.paymentTypeId)) {
    return {
      ok: false,
      error: "Нет IIKO_PAYMENT_TYPE_ID — нельзя отметить оплату в iiko",
    };
  }
  const sum = Math.round(input.sumRub);
  if (!Number.isFinite(sum) || sum <= 0) {
    return { ok: false, error: "Некорректная сумма оплаты для iiko" };
  }

  try {
    const response = await iikoRequest<{ correlationId?: string }>(
      "/api/1/deliveries/add_payments",
      {
        organizationId: config.organizationId,
        orderId: input.iikoOrderId.trim(),
        payments: [
          {
            paymentTypeKind: config.paymentTypeKind || "Card",
            sum,
            paymentTypeId: config.paymentTypeId,
            isProcessedExternally: true,
          },
        ],
      },
      config,
    );
    return {
      ok: true,
      correlationId: String(response.correlationId ?? ""),
    };
  } catch (error) {
    if (error instanceof IikoApiError) {
      return { ok: false, error: error.message.slice(0, 500) };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось добавить оплату в iiko";
    return { ok: false, error: message.slice(0, 500) };
  }
};

/** Update delivery comment (e.g. after online payment confirmed). */
export const changeIikoDeliveryComment = async (
  input: {
    iikoOrderId: string;
    comment: string;
  },
  config: IikoConfig = getIikoConfig(),
): Promise<IikoPaymentSyncResult> => {
  if (!isIikoConfigured(config)) {
    return { ok: false, error: "iiko не настроен" };
  }
  if (!input.iikoOrderId.trim() || !isIikoProductId(input.iikoOrderId)) {
    return { ok: false, error: "Некорректный iiko order id" };
  }

  try {
    const response = await iikoRequest<{ correlationId?: string }>(
      "/api/1/deliveries/change_comment",
      {
        organizationId: config.organizationId,
        orderId: input.iikoOrderId.trim(),
        comment: input.comment.slice(0, 500) || null,
      },
      config,
    );
    return {
      ok: true,
      correlationId: String(response.correlationId ?? ""),
    };
  } catch (error) {
    if (error instanceof IikoApiError) {
      return { ok: false, error: error.message.slice(0, 500) };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось обновить комментарий в iiko";
    return { ok: false, error: message.slice(0, 500) };
  }
};

/**
 * Update iiko delivery comment for online payment state (awaiting / failed / paid text).
 * Does not add payment rows — only kitchen-visible comment.
 */
export const syncIikoOnlinePaymentComment = async (input: {
  iikoOrderId: string;
  comment: string;
  utensils: number;
  fulfillmentMode: "pickup" | "delivery";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  deliveryCourierComment?: string;
}): Promise<IikoPaymentSyncResult> => {
  const comment = buildIikoOrderComment({
    comment: input.comment,
    utensils: input.utensils,
    fulfillmentMode: input.fulfillmentMode,
    paymentStatus: input.paymentStatus,
    paymentMethod: "sber",
    deliveryCourierComment: input.deliveryCourierComment,
  });
  return changeIikoDeliveryComment({
    iikoOrderId: input.iikoOrderId,
    comment,
  });
};

/**
 * After Sber capture: mark existing iiko delivery as paid online + fix comment.
 */
export const syncIikoPaidOnline = async (input: {
  iikoOrderId: string;
  sumRub: number;
  comment: string;
  utensils: number;
  fulfillmentMode: "pickup" | "delivery";
  deliveryCourierComment?: string;
}): Promise<IikoPaymentSyncResult> => {
  const payments = await addIikoDeliveryPayments({
    iikoOrderId: input.iikoOrderId,
    sumRub: input.sumRub,
  });
  if (!payments.ok) return payments;

  const updated = await syncIikoOnlinePaymentComment({
    iikoOrderId: input.iikoOrderId,
    comment: input.comment,
    utensils: input.utensils,
    fulfillmentMode: input.fulfillmentMode,
    paymentStatus: "paid",
    deliveryCourierComment: input.deliveryCourierComment,
  });
  if (!updated.ok) {
    return {
      ok: false,
      error: `Оплата в iiko добавлена, комментарий не обновлён: ${updated.error}`,
    };
  }
  return { ok: true, correlationId: payments.correlationId || updated.correlationId };
};
