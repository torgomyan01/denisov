import { NextResponse } from "next/server";
import { bindTelegramChat } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assertBindSecret = (request: Request): boolean => {
  const expected =
    process.env.TELEGRAM_BIND_SECRET?.trim() ||
    process.env.TELEGRAM_GATEWAY_SECRET?.trim() ||
    "";
  if (!expected) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const alt = request.headers.get("x-gateway-secret")?.trim() ?? "";
  return bearer === expected || alt === expected;
};

type BindBody = {
  token?: string;
  chatId?: string | number;
  username?: string | null;
};

/**
 * Called by Vercel Telegram gateway after /start TOKEN.
 * Not a public customer API — shared secret only.
 */
export const POST = async (request: Request): Promise<Response> => {
  if (!assertBindSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: BindBody;
  try {
    body = (await request.json()) as BindBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid" },
      { status: 400 },
    );
  }

  const token = typeof body.token === "string" ? body.token : "";
  const chatId =
    body.chatId != null && body.chatId !== ""
      ? String(body.chatId)
      : "";
  const result = await bindTelegramChat({
    token,
    chatId,
    username: body.username,
  });

  if (!result.success) {
    const status =
      result.error === "invalid" ? 400 : result.error === "server" ? 500 : 410;
    return NextResponse.json(
      { success: false, error: result.error },
      { status },
    );
  }

  return NextResponse.json({ success: true });
};
