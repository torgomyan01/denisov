import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "@/lib/cookie-secure";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "denisov_customer_session";
const SESSION_DAYS = 30;

export type FulfillmentMode = "pickup" | "delivery";

export type CustomerRole = "customer" | "courier";

export type CustomerPublic = {
  id: string;
  name: string;
  surname: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  deliveryAddress: string | null;
  deliveryApartment: string | null;
  deliveryEntrance: string | null;
  deliveryFloor: string | null;
  deliveryIntercom: string | null;
  deliveryCourierComment: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupPointId: string | null;
  fulfillmentMode: FulfillmentMode;
  role: CustomerRole;
  hasYandex: boolean;
  isCourier: boolean;
};

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const toCustomerPublic = (customer: {
  id: string;
  name: string;
  surname?: string | null;
  phone: string | null;
  email: string | null;
  birthday: Date | null;
  deliveryAddress?: string | null;
  deliveryApartment?: string | null;
  deliveryEntrance?: string | null;
  deliveryFloor?: string | null;
  deliveryIntercom?: string | null;
  deliveryCourierComment?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupPointId?: string | null;
  fulfillmentMode?: FulfillmentMode | null;
  role?: CustomerRole | null;
  yandexId: string | null;
}): CustomerPublic => {
  const role: CustomerRole =
    customer.role === "courier" ? "courier" : "customer";
  const lat =
    typeof customer.deliveryLat === "number" &&
    Number.isFinite(customer.deliveryLat)
      ? customer.deliveryLat
      : null;
  const lng =
    typeof customer.deliveryLng === "number" &&
    Number.isFinite(customer.deliveryLng)
      ? customer.deliveryLng
      : null;
  return {
    id: customer.id,
    name: customer.name ?? "",
    surname: customer.surname ?? "",
    phone: customer.phone,
    email: customer.email,
    birthday: customer.birthday
      ? customer.birthday.toISOString().slice(0, 10)
      : null,
    deliveryAddress: customer.deliveryAddress ?? null,
    deliveryApartment: customer.deliveryApartment?.trim() || null,
    deliveryEntrance: customer.deliveryEntrance?.trim() || null,
    deliveryFloor: customer.deliveryFloor?.trim() || null,
    deliveryIntercom: customer.deliveryIntercom?.trim() || null,
    deliveryCourierComment: customer.deliveryCourierComment?.trim() || null,
    deliveryLat: lat,
    deliveryLng: lng,
    pickupPointId: customer.pickupPointId?.trim() || null,
    fulfillmentMode: customer.fulfillmentMode ?? "pickup",
    role,
    hasYandex: Boolean(customer.yandexId),
    isCourier: role === "courier",
  };
};

export const createCustomerSession = async (
  customerId: string,
): Promise<void> => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, await sessionCookieOptions(expiresAt));
};

export const destroyCustomerSession = async (): Promise<void> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.customerSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  cookieStore.set(COOKIE_NAME, "", {
    ...(await sessionCookieOptions(new Date(0))),
    maxAge: 0,
  });
};

export const getCustomer = async (): Promise<CustomerPublic | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.customerSession.delete({ where: { id: session.id } });
    try {
      cookieStore.set(COOKIE_NAME, "", {
        ...(await sessionCookieOptions(new Date(0))),
        maxAge: 0,
      });
    } catch {
      /* ignore */
    }
    return null;
  }

  return toCustomerPublic(session.customer);
};

export const requireCustomer = async (): Promise<CustomerPublic> => {
  const customer = await getCustomer();
  if (!customer) {
    throw new Error("Unauthorized");
  }
  return customer;
};

export const requireCourier = async (): Promise<CustomerPublic> => {
  const customer = await requireCustomer();
  if (!customer.isCourier) {
    throw new Error("Forbidden");
  }
  return customer;
};

export const pruneExpiredCustomerSessions = async (): Promise<void> => {
  await prisma.customerSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
};
