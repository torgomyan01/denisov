import { randomBytes } from "crypto";
import type { FulfillmentMode } from "@/lib/customer-auth";
import {
  isOrderNotifyStatus,
  orderStatusNotifyPayload,
} from "@/lib/order-notify";
import type { OrderStatus } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

const LINK_TTL_MS = 15 * 60 * 1000;

export const getTelegramBotUsername = (): string | null => {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() ||
    process.env.TELEGRAM_BOT_USERNAME?.trim() ||
    "";
  return raw.replace(/^@/, "") || null;
};

export const createTelegramLinkToken = async (
  customerId: string,
): Promise<{ token: string; deepLink: string } | { error: string }> => {
  const username = getTelegramBotUsername();
  if (!username) {
    return { error: "Telegram-бот ещё не настроен" };
  }

  await prisma.telegramLinkToken.deleteMany({
    where: {
      OR: [{ customerId }, { expiresAt: { lt: new Date() } }],
    },
  });

  const token = randomBytes(16).toString("hex");
  await prisma.telegramLinkToken.create({
    data: {
      token,
      customerId,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });

  return {
    token,
    deepLink: `https://t.me/${username}?start=${token}`,
  };
};

export const disconnectTelegram = async (customerId: string): Promise<void> => {
  await prisma.customer.update({
    where: { id: customerId },
    data: { telegramChatId: null, telegramUsername: null },
  });
  await prisma.telegramLinkToken.deleteMany({ where: { customerId } });
};

export type BindTelegramResult =
  | { success: true }
  | { success: false; error: "expired" | "used" | "invalid" | "server" };

export const bindTelegramChat = async (input: {
  token: string;
  chatId: string;
  username?: string | null;
}): Promise<BindTelegramResult> => {
  const token = input.token.trim();
  const chatId = String(input.chatId).trim();
  if (!token || !chatId) return { success: false, error: "invalid" };

  try {
    const row = await prisma.telegramLinkToken.findUnique({
      where: { token },
    });
    if (!row) return { success: false, error: "used" };
    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.telegramLinkToken.delete({ where: { id: row.id } }).catch(() => undefined);
      return { success: false, error: "expired" };
    }

    const username =
      typeof input.username === "string" && input.username.trim()
        ? input.username.trim().replace(/^@/, "").slice(0, 64)
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: {
          telegramChatId: chatId,
          NOT: { id: row.customerId },
        },
        data: { telegramChatId: null, telegramUsername: null },
      });

      await tx.customer.update({
        where: { id: row.customerId },
        data: {
          telegramChatId: chatId,
          telegramUsername: username,
        },
      });

      await tx.telegramLinkToken.deleteMany({
        where: {
          OR: [{ id: row.id }, { customerId: row.customerId }],
        },
      });
    });

    return { success: true };
  } catch {
    return { success: false, error: "server" };
  }
};

const gatewayConfig = (): { url: string; secret: string } | null => {
  const base = process.env.TELEGRAM_GATEWAY_URL?.trim().replace(/\/$/, "");
  const secret = process.env.TELEGRAM_GATEWAY_SECRET?.trim();
  if (!base || !secret) return null;
  return { url: `${base}/api/telegram/send`, secret };
};

/** Send via Vercel gateway. Never throws. Clears chat_id if bot blocked. */
export const sendTelegramToCustomer = async (
  customerId: string,
  text: string,
): Promise<void> => {
  try {
    const gateway = gatewayConfig();
    if (!gateway || !customerId || !text.trim()) return;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { telegramChatId: true },
    });
    const chatId = customer?.telegramChatId?.trim();
    if (!chatId) return;

    const res = await fetch(gateway.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gateway.secret}`,
      },
      body: JSON.stringify({ chatId, text: text.trim() }),
    });

    if (res.status === 403) {
      await prisma.customer
        .update({
          where: { id: customerId },
          data: { telegramChatId: null, telegramUsername: null },
        })
        .catch(() => undefined);
    }
  } catch {
    /* never block order flow */
  }
};

export const notifyCustomerOrderStatusTelegram = (input: {
  customerId: string | null | undefined;
  status: OrderStatus;
  orderId: string;
  orderNumber: string;
  fulfillmentMode?: FulfillmentMode | null;
}): void => {
  const { customerId, status, orderId, orderNumber, fulfillmentMode } = input;
  if (!customerId || !isOrderNotifyStatus(status)) return;
  const payload = orderStatusNotifyPayload({
    status,
    orderId,
    orderNumber,
    fulfillmentMode,
  });
  if (!payload) return;
  void sendTelegramToCustomer(customerId, payload.telegramText);
};
