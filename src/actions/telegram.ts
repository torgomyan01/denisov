"use server";

import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import {
  createTelegramLinkToken,
  disconnectTelegram,
  getTelegramBotUsername,
} from "@/lib/telegram";
import type { ActionResult } from "@/types/site";

export type TelegramStatus = {
  linked: boolean;
  username: string | null;
  botUsername: string | null;
  configured: boolean;
};

export const getTelegramStatusAction = async (): Promise<
  ActionResult<TelegramStatus>
> => {
  try {
    const session = await requireCustomer();
    const customer = await prisma.customer.findUnique({
      where: { id: session.id },
      select: { telegramChatId: true, telegramUsername: true },
    });
    const botUsername = getTelegramBotUsername();
    return {
      success: true,
      data: {
        linked: Boolean(customer?.telegramChatId?.trim()),
        username: customer?.telegramUsername?.trim() || null,
        botUsername,
        configured: Boolean(botUsername),
      },
    };
  } catch {
    return { success: false, error: "Требуется авторизация" };
  }
};

export const createTelegramLinkAction = async (): Promise<
  ActionResult<{ deepLink: string }>
> => {
  try {
    const session = await requireCustomer();
    const result = await createTelegramLinkToken(session.id);
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    return { success: true, data: { deepLink: result.deepLink } };
  } catch {
    return { success: false, error: "Требуется авторизация" };
  }
};

export const disconnectTelegramAction = async (): Promise<
  ActionResult<{ ok: true }>
> => {
  try {
    const session = await requireCustomer();
    await disconnectTelegram(session.id);
    return { success: true, data: { ok: true } };
  } catch {
    return { success: false, error: "Требуется авторизация" };
  }
};
