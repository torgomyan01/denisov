"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomerSession,
  destroyCustomerSession,
  getCustomer,
  pruneExpiredCustomerSessions,
  toCustomerPublic,
  type CustomerPublic,
} from "@/lib/customer-auth";
import {
  loginCustomerSchema,
  registerCustomerSchema,
} from "@/lib/customer-schema";
import { hashPassword, verifyPasswordHash } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/site";

const toPublic = toCustomerPublic;

export const getCustomerAction = async (): Promise<
  ActionResult<CustomerPublic | null>
> => {
  try {
    const customer = await getCustomer();
    return { success: true, data: customer };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return { success: false, error: message };
  }
};

export const registerCustomerAction = async (
  input: unknown,
): Promise<ActionResult<CustomerPublic>> => {
  const parsed = registerCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте данные",
    };
  }

  const { name, phone, password } = parsed.data;

  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) {
    return {
      success: false,
      error:
        "Этот телефон уже зарегистрирован. Войдите по номеру или через Яндекс ID.",
    };
  }

  await pruneExpiredCustomerSessions();

  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
      passwordHash: hashPassword(password),
    },
  });

  await createCustomerSession(customer.id);
  revalidatePath("/");
  revalidatePath("/auth");

  return { success: true, data: toPublic(customer) };
};

export const loginCustomerAction = async (
  input: unknown,
): Promise<ActionResult<CustomerPublic>> => {
  const parsed = loginCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте данные",
    };
  }

  const customer = await prisma.customer.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (!customer) {
    return {
      success: false,
      error: "Неверный телефон или пароль",
    };
  }

  if (!customer.passwordHash) {
    return {
      success: false,
      error:
        "Для этого аккаунта пароль не задан. Войдите через Яндекс ID.",
    };
  }

  if (!verifyPasswordHash(parsed.data.password, customer.passwordHash)) {
    return {
      success: false,
      error: "Неверный телефон или пароль",
    };
  }

  await pruneExpiredCustomerSessions();
  await createCustomerSession(customer.id);
  revalidatePath("/");
  revalidatePath("/auth");

  return { success: true, data: toPublic(customer) };
};

export const logoutCustomerAction = async (): Promise<ActionResult> => {
  await destroyCustomerSession();
  revalidatePath("/");
  revalidatePath("/auth");
  return { success: true };
};
