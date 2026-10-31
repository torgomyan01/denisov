import type {
  CustomerPublic,
  FulfillmentMode,
} from "@/lib/customer-auth";
import { toCustomerPublic } from "@/lib/customer-auth";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type CustomerProfile = CustomerPublic & {
  createdAt: string;
  updatedAt: string;
};

export type UpdateCustomerProfileInput = {
  name: string;
  surname: string;
  phone?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupPointId?: string | null;
  fulfillmentMode?: FulfillmentMode;
};

const toProfile = (customer: {
  id: string;
  name: string;
  surname: string;
  phone: string | null;
  email: string | null;
  birthday: Date | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupPointId: string | null;
  fulfillmentMode: FulfillmentMode;
  role?: CustomerPublic["role"] | null;
  yandexId: string | null;
  telegramChatId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerProfile => ({
  ...toCustomerPublic(customer),
  createdAt: customer.createdAt.toISOString(),
  updatedAt: customer.updatedAt.toISOString(),
});

export const getCustomerProfileById = async (
  customerId: string,
): Promise<CustomerProfile | null> => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  return customer ? toProfile(customer) : null;
};

export const updateCustomerProfileById = async (
  customerId: string,
  input: UpdateCustomerProfileInput,
): Promise<
  | { ok: true; profile: CustomerProfile }
  | { ok: false; error: string; status: 400 | 404 | 409 }
> => {
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!existing) {
    return { ok: false, error: "Профиль не найден", status: 404 };
  }

  const phoneRaw = input.phone?.trim() || "";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) {
    return {
      ok: false,
      error: "Телефон в формате +7 XXX XXX-XX-XX",
      status: 400,
    };
  }

  if (phone && phone !== existing.phone) {
    const clash = await prisma.customer.findUnique({ where: { phone } });
    if (clash && clash.id !== customerId) {
      return { ok: false, error: "Этот телефон уже занят", status: 409 };
    }
  }

  const fulfillmentMode = input.fulfillmentMode ?? existing.fulfillmentMode;
  const deliveryAddress =
    input.deliveryAddress === undefined
      ? existing.deliveryAddress
      : input.deliveryAddress?.trim() || null;

  const deliveryLat =
    input.deliveryLat === undefined ? existing.deliveryLat : input.deliveryLat;
  const deliveryLng =
    input.deliveryLng === undefined ? existing.deliveryLng : input.deliveryLng;

  const pickupPointIdRaw =
    input.pickupPointId === undefined
      ? existing.pickupPointId
      : input.pickupPointId?.trim() || null;

  const hasPoint =
    deliveryLat != null &&
    deliveryLng != null &&
    Number.isFinite(deliveryLat) &&
    Number.isFinite(deliveryLng);

  if (fulfillmentMode === "delivery" && !hasPoint) {
    return {
      ok: false,
      error: "Отметьте точку доставки на карте",
      status: 400,
    };
  }

  let pickupPointId = pickupPointIdRaw;
  if (fulfillmentMode === "pickup") {
    if (!pickupPointId) {
      return {
        ok: false,
        error: "Выберите точку самовывоза",
        status: 400,
      };
    }
    const point = await prisma.pickupPoint.findFirst({
      where: { id: pickupPointId, isActive: true },
      select: { id: true },
    });
    if (!point) {
      return {
        ok: false,
        error: "Точка самовывоза недоступна",
        status: 400,
      };
    }
    pickupPointId = point.id;
  }

  const lat = hasPoint ? Number(Number(deliveryLat).toFixed(6)) : null;
  const lng = hasPoint ? Number(Number(deliveryLng).toFixed(6)) : null;
  const addressStored =
    deliveryAddress?.trim() || (hasPoint ? "Адрес на карте" : null);

  const updated = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.update({
      where: { id: customerId },
      data: {
        name: input.name,
        surname: input.surname,
        phone: phoneRaw ? phone : existing.phone,
        deliveryAddress: addressStored,
        deliveryLat: fulfillmentMode === "delivery" ? lat : existing.deliveryLat,
        deliveryLng: fulfillmentMode === "delivery" ? lng : existing.deliveryLng,
        pickupPointId:
          fulfillmentMode === "pickup" ? pickupPointId : existing.pickupPointId,
        fulfillmentMode,
      },
    });

    await tx.customerCart.updateMany({
      where: { customerId },
      data: {
        fulfillmentMode,
        ...(fulfillmentMode === "delivery"
          ? {
              deliveryAddress: (addressStored ?? "").slice(0, 240),
              deliveryLat: lat,
              deliveryLng: lng,
            }
          : {
              pickupPointId,
            }),
      },
    });

    return customer;
  });

  return { ok: true, profile: toProfile(updated) };
};
