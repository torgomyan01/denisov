import { randomBytes } from "crypto";
import type { FulfillmentMode } from "@/lib/customer-auth";
import {
  isOrderNotifyStatus,
  orderStatusNotifyPayload,
} from "@/lib/order-notify";
import {
  ORDER_STATUS_LABELS,
  type OrderPublic,
  type OrderStatus,
} from "@/lib/orders";
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

const siteOrigin = (): string => {
  const raw = process.env.SITE_URL?.trim() || "https://cafedenisov.ru";
  return raw.replace(/\/$/, "");
};

/** Comma/space-separated chat ids for staff alerts (admin, manager, …). */
export const getAdminTelegramChatIds = (): string[] => {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_IDS?.trim() ?? "";
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

type TelegramSendResult = {
  ok: boolean;
  blocked?: boolean;
  queued?: boolean;
};

/** Enqueue Telegram message for Vercel drain (VPS cannot reach Telegram/Vercel TLS). */
export const enqueueTelegramMessage = async (input: {
  chatId: string;
  text: string;
  customerId?: string | null;
}): Promise<boolean> => {
  const chatId = input.chatId.trim();
  const text = input.text.trim().slice(0, 4000);
  if (!chatId || !text) return false;
  try {
    await prisma.telegramOutbox.create({
      data: {
        chatId,
        text,
        customerId: input.customerId?.trim() || null,
        status: "pending",
      },
    });
    return true;
  } catch (error) {
    console.info("[tg-outbox-enqueue-fail]", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
};

/**
 * Deliver a Telegram message.
 * On this host we only enqueue to DB; Vercel gateway drains the outbox.
 * Never throws.
 */
export const sendTelegramToChat = async (
  chatId: string,
  text: string,
  opts?: { customerId?: string | null },
): Promise<TelegramSendResult> => {
  const id = chatId.trim();
  const body = text.trim();
  if (!id || !body) return { ok: false };

  const queued = await enqueueTelegramMessage({
    chatId: id,
    text: body,
    customerId: opts?.customerId,
  });
  if (!queued) return { ok: false };

  // Best-effort ping to Vercel drain (usually fails on Jino TLS — safe to ignore).
  const gateway = gatewayConfig();
  if (gateway) {
    const drainUrl = gateway.url.replace(/\/send\/?$/, "/drain");
    void fetch(drainUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gateway.secret}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    }).catch(() => undefined);
  }

  return { ok: true, queued: true };
};

/** Send via Vercel gateway. Never throws. Clears chat_id if bot blocked. */
export const sendTelegramToCustomer = async (
  customerId: string,
  text: string,
): Promise<void> => {
  try {
    if (!customerId || !text.trim()) return;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { telegramChatId: true },
    });
    const chatId = customer?.telegramChatId?.trim();
    if (!chatId) return;

    await sendTelegramToChat(chatId, text, { customerId });
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

const formatMoneyRub = (rub: number): string =>
  `${Math.max(0, Math.round(rub)).toLocaleString("ru-RU")} ₽`;

const formatOrderWhen = (order: OrderPublic): string => {
  if (order.timeMode === "scheduled" && order.scheduledAt) {
    try {
      return new Date(order.scheduledAt).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return order.scheduledAt;
    }
  }
  return "Как можно скорее";
};

/** Full new-order alert for staff Telegram chats. */
export const formatAdminNewOrderTelegramText = (order: OrderPublic): string => {
  const adminUrl = `${siteOrigin()}/admin#order/${order.id}`;
  const mode =
    order.fulfillmentMode === "delivery" ? "Доставка" : "Самовывоз";
  const lines: string[] = [
    "🆕 Новый заказ · Денисов",
    `№ ${order.number}`,
    `Статус: ${ORDER_STATUS_LABELS[order.status]}`,
    "",
    `Клиент: ${order.customerName || "—"}`,
    `Телефон: ${order.customerPhone || "—"}`,
  ];
  if (order.customerEmail) {
    lines.push(`Email: ${order.customerEmail}`);
  }
  lines.push("", `Получение: ${mode}`, `Время: ${formatOrderWhen(order)}`);

  if (order.fulfillmentMode === "pickup") {
    lines.push(`Точка: ${order.pickupPointName || "—"}`);
    if (order.pickupPointAddress) {
      lines.push(`Адрес точки: ${order.pickupPointAddress}`);
    }
  } else {
    lines.push(`Адрес: ${order.deliveryAddress || "—"}`);
    if (order.deliveryApartment) lines.push(`Кв./офис: ${order.deliveryApartment}`);
    if (order.deliveryEntrance) lines.push(`Подъезд: ${order.deliveryEntrance}`);
    if (order.deliveryFloor) lines.push(`Этаж: ${order.deliveryFloor}`);
    if (order.deliveryIntercom) lines.push(`Домофон: ${order.deliveryIntercom}`);
    if (order.deliveryCourierComment) {
      lines.push(`Комментарий курьеру: ${order.deliveryCourierComment}`);
    }
  }

  lines.push("", "Состав:");
  for (const item of order.items) {
    lines.push(
      `• ${item.name} × ${item.qty} — ${formatMoneyRub(item.lineTotalRub)}`,
    );
  }

  if (order.deliveryFeeRub > 0) {
    lines.push(`Доставка: ${formatMoneyRub(order.deliveryFeeRub)}`);
  }
  lines.push(`Итого: ${formatMoneyRub(order.totalRub)}`);

  if (order.utensils > 0) {
    lines.push(`Приборы: ${order.utensils}`);
  }
  if (order.comment.trim()) {
    lines.push(`Комментарий гостя: ${order.comment.trim()}`);
  }

  lines.push("", `Открыть в админке: ${adminUrl}`);
  return lines.join("\n");
};

/** Queue new-order alerts for all staff chat ids (drained by Vercel gateway). */
export const notifyAdminsNewOrder = async (
  order: OrderPublic,
): Promise<void> => {
  const chatIds = getAdminTelegramChatIds();
  if (!chatIds.length) {
    console.info("[tg-admin]", { count: 0, orderNumber: order.number });
    return;
  }
  const text = formatAdminNewOrderTelegramText(order);
  const results = await Promise.all(
    chatIds.map((chatId) => sendTelegramToChat(chatId, text)),
  );
  console.info("[tg-admin]", {
    count: chatIds.length,
    queued: results.filter((r) => r.ok).length,
    orderNumber: order.number,
  });
};

export type TelegramOutboxRow = {
  id: string;
  chatId: string;
  text: string;
  customerId: string | null;
};

export const pullTelegramOutbox = async (
  limit = 20,
): Promise<TelegramOutboxRow[]> => {
  const take = Math.min(50, Math.max(1, limit));
  const staleBefore = new Date(Date.now() - 90_000);
  // Reclaim claims that never got an ack (drain crash / timeout).
  await prisma.telegramOutbox.updateMany({
    where: {
      status: "sending",
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
    },
    data: { status: "pending", claimedAt: null },
  });

  const rows = await prisma.telegramOutbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take,
    select: { id: true, chatId: true, text: true, customerId: true },
  });
  if (rows.length) {
    await prisma.telegramOutbox.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        status: "sending",
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }
  return rows;
};

export type TelegramOutboxAckItem = {
  id: string;
  ok: boolean;
  blocked?: boolean;
  error?: string;
};

export const ackTelegramOutbox = async (
  items: TelegramOutboxAckItem[],
): Promise<void> => {
  for (const item of items) {
    if (!item?.id) continue;
    if (item.ok) {
      await prisma.telegramOutbox
        .update({
          where: { id: item.id },
          data: { status: "sent", sentAt: new Date(), lastError: null },
        })
        .catch(() => undefined);
      continue;
    }

    await prisma.telegramOutbox
      .update({
        where: { id: item.id },
        data: {
          // Re-queue soft failures; permanent Telegram blocks stay failed.
          status: item.blocked ? "failed" : "pending",
          lastError: (item.error || "send failed").slice(0, 500),
        },
      })
      .catch(() => undefined);

    if (item.blocked) {
      const row = await prisma.telegramOutbox.findUnique({
        where: { id: item.id },
        select: { customerId: true },
      });
      if (row?.customerId) {
        await prisma.customer
          .update({
            where: { id: row.customerId },
            data: { telegramChatId: null, telegramUsername: null },
          })
          .catch(() => undefined);
      }
    }
  }
};
