import { NextResponse } from "next/server";
import {
  ackTelegramOutbox,
  pullTelegramOutbox,
  type TelegramOutboxAckItem,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assertOutboxSecret = (request: Request): boolean => {
  const expected =
    process.env.TELEGRAM_GATEWAY_SECRET?.trim() ||
    process.env.TELEGRAM_BIND_SECRET?.trim() ||
    "";
  if (!expected) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const alt = request.headers.get("x-gateway-secret")?.trim() ?? "";
  return bearer === expected || alt === expected;
};

/** Vercel drain: pull pending outbound Telegram messages. */
export const GET = async (request: Request): Promise<Response> => {
  if (!assertOutboxSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "20");
  const messages = await pullTelegramOutbox(limit);
  return NextResponse.json({ ok: true, messages });
};

type AckBody = {
  results?: TelegramOutboxAckItem[];
};

/** Vercel drain: acknowledge send results. */
export const POST = async (request: Request): Promise<Response> => {
  if (!assertOutboxSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: AckBody;
  try {
    body = (await request.json()) as AckBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const results = Array.isArray(body.results) ? body.results : [];
  await ackTelegramOutbox(results);
  return NextResponse.json({ ok: true, acked: results.length });
};
