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
};

/** Send via Vercel gateway to any chat. Never throws. */
export const sendTelegramToChat = async (
  chatId: string,
  text: string,
): Promise<TelegramSendResult> => {
  try {
    const gateway = gatewayConfig();
    const id = chatId.trim();
    const body = text.trim();
    if (!gateway || !id || !body) return { ok: false };

    const res = await fetch(gateway.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gateway.secret}`,
      },
      body: JSON.stringify({ chatId: id, text: body.slice(0, 4000) }),
    });

    if (res.status === 403) return { ok: false, blocked: true };
    if (!res.ok) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
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

    const result = await sendTelegramToChat(chatId, text);
    if (result.blocked) {
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

/** Fire-and-forget: notify all configured staff chat ids about a new order. */
export const notifyAdminsNewOrder = (order: OrderPublic): void => {
  const chatIds = getAdminTelegramChatIds();
  if (!chatIds.length) return;
  const text = formatAdminNewOrderTelegramText(order);
  void Promise.all(
    chatIds.map((chatId) => sendTelegramToChat(chatId, text)),
  );
};
