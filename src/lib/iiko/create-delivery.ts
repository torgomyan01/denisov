import { randomUUID } from "crypto";
import { getIikoConfig, isIikoConfigured, type IikoConfig } from "@/lib/iiko/config";
import { IikoApiError, iikoRequest } from "@/lib/iiko/client";
import { rubFromPriceString } from "@/lib/orders";

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
  paymentStatus: "pending" | "paid" | "failed";
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

const buildComment = (input: IikoCreateOrderInput): string => {
  const parts: string[] = [];
  if (input.comment.trim()) parts.push(input.comment.trim());
  if (input.utensils > 0) parts.push(`Приборы: ${input.utensils}`);
  if (input.fulfillmentMode === "pickup") {
    parts.push("Самовывоз (сайт Денисов)");
  }
  if (input.deliveryCourierComment.trim()) {
    parts.push(`Курьеру: ${input.deliveryCourierComment.trim()}`);
  }
  return parts.join(". ").slice(0, 500);
};

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
