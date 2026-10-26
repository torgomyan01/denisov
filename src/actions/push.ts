"use server";

import { z } from "zod";
import { getCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey } from "@/lib/web-push";
import type { ActionResult } from "@/types/site";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
  userAgent: z.string().max(500).optional(),
});

export const getVapidPublicKeyAction = async (): Promise<
  ActionResult<{ publicKey: string }>
> => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return {
      success: false,
      error: "Push-уведомления пока не настроены на сервере",
    };
  }
  return { success: true, data: { publicKey } };
};

export const getPushSubscriptionStatusAction = async (): Promise<
  ActionResult<{ subscribed: boolean }>
> => {
  try {
    const customer = await getCustomer();
    if (!customer) {
      return { success: false, error: "Требуется авторизация" };
    }
    const count = await prisma.pushSubscription.count({
      where: { customerId: customer.id },
    });
    return { success: true, data: { subscribed: count > 0 } };
  } catch {
    return { success: false, error: "Не удалось проверить подписку" };
  }
};

export const subscribePushAction = async (
  input: unknown,
): Promise<ActionResult<{ subscribed: true }>> => {
  try {
    const customer = await getCustomer();
    if (!customer) {
      return { success: false, error: "Требуется авторизация" };
    }
    if (!getVapidPublicKey()) {
      return {
        success: false,
        error: "Push-уведомления пока не настроены на сервере",
      };
    }

    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректная подписка",
      };
    }

    const { endpoint, keys, userAgent } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        customerId: customer.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: (userAgent ?? "").slice(0, 500),
      },
      update: {
        customerId: customer.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: (userAgent ?? "").slice(0, 500),
      },
    });

    return { success: true, data: { subscribed: true } };
  } catch {
    return { success: false, error: "Не удалось сохранить подписку" };
  }
};

export const unsubscribePushAction = async (
  input: unknown,
): Promise<ActionResult<{ subscribed: false }>> => {
  try {
    const customer = await getCustomer();
    if (!customer) {
      return { success: false, error: "Требуется авторизация" };
    }

    const parsed = z
      .object({ endpoint: z.string().url().max(2048).optional() })
      .safeParse(input ?? {});
    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос" };
    }

    if (parsed.data.endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: {
          customerId: customer.id,
          endpoint: parsed.data.endpoint,
        },
      });
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { customerId: customer.id },
      });
    }

    return { success: true, data: { subscribed: false } };
  } catch {
    return { success: false, error: "Не удалось отключить уведомления" };
  }
};
