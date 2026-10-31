import { NextResponse } from "next/server";
import { assertGatewaySecret } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBody = {
  chatId?: string | number;
  text?: string;
};

export const POST = async (request: Request): Promise<Response> => {
  if (!assertGatewaySecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const chatId = body.chatId;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (chatId == null || chatId === "" || !text) {
    return NextResponse.json(
      { ok: false, error: "chatId and text are required" },
      { status: 400 },
    );
  }

  try {
    const result = await sendTelegramMessage(chatId, text);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          blocked: result.blocked === true,
          error: result.description ?? "Telegram send failed",
        },
        { status: result.blocked ? 403 : 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
};
