import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { username?: string };
  };
};

const extractStartToken = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/start")) return null;
  const parts = trimmed.split(/\s+/);
  const payload = parts[1]?.trim();
  if (!payload) return null;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(payload)) return null;
  return payload;
};

export const POST = async (request: Request): Promise<Response> => {
  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text ?? "";
  if (chatId == null) {
    return NextResponse.json({ ok: true });
  }

  const token = extractStartToken(text);
  if (!token) {
    if (text.startsWith("/start")) {
      await sendTelegramMessage(
        chatId,
        "Чтобы получать уведомления о заказах, откройте профиль на сайте кафе Денисов и нажмите «Подключить Telegram».",
      ).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  const bindUrl = process.env.DENISOV_BIND_URL?.trim();
  const bindSecret = process.env.DENISOV_BIND_SECRET?.trim();
  if (!bindUrl || !bindSecret) {
    await sendTelegramMessage(
      chatId,
      "Сервис временно недоступен. Попробуйте позже.",
    ).catch(() => undefined);
    return NextResponse.json({ ok: true });
  }

  try {
    const res = await fetch(bindUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bindSecret}`,
      },
      body: JSON.stringify({
        token,
        chatId: String(chatId),
        username: update.message?.from?.username ?? null,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
    } | null;

    if (res.ok && data?.success) {
      await sendTelegramMessage(
        chatId,
        "Готово! Вы подписаны на уведомления о заказах кафе Денисов.",
      ).catch(() => undefined);
    } else {
      const err =
        data?.error === "expired"
          ? "Ссылка устарела. Откройте профиль на сайте и нажмите «Подключить Telegram» снова."
          : data?.error === "used"
            ? "Эта ссылка уже использована. Создайте новую в профиле на сайте."
            : "Не удалось привязать аккаунт. Создайте новую ссылку в профиле на сайте.";
      await sendTelegramMessage(chatId, err).catch(() => undefined);
    }
  } catch {
    await sendTelegramMessage(
      chatId,
      "Не удалось связаться с сайтом. Попробуйте позже.",
    ).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
};
