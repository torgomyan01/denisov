import { NextResponse } from "next/server";
import { assertGatewaySecret } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type OutboxMessage = {
  id: string;
  chatId: string;
  text: string;
  customerId?: string | null;
};

type AckItem = {
  id: string;
  ok: boolean;
  blocked?: boolean;
  error?: string;
};

const outboxConfig = (): { url: string; secret: string } | null => {
  const explicit = process.env.DENISOV_OUTBOX_URL?.trim().replace(/\/$/, "");
  const fromBind = process.env.DENISOV_BIND_URL?.trim().replace(/\/bind\/?$/, "/outbox");
  const url = explicit || fromBind || "";
  const secret =
    process.env.DENISOV_BIND_SECRET?.trim() ||
    process.env.GATEWAY_SECRET?.trim() ||
    "";
  if (!url || !secret) return null;
  return { url, secret };
};

const assertDrainAuth = (request: Request): boolean => {
  if (assertGatewaySecret(request)) return true;
  // Vercel Cron invokes GET with this header (and optional CRON_SECRET bearer).
  if (request.headers.get("x-vercel-cron") === "1") {
    const cron = process.env.CRON_SECRET?.trim();
    if (!cron) return true;
    const header = request.headers.get("authorization")?.trim() ?? "";
    const bearer = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : "";
    return bearer === cron;
  }
  const cron = process.env.CRON_SECRET?.trim();
  if (!cron) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  return bearer === cron;
};

const drainOnce = async (): Promise<{
  ok: boolean;
  pulled: number;
  sent: number;
  failed: number;
  error?: string;
}> => {
  const cfg = outboxConfig();
  if (!cfg) {
    return {
      ok: false,
      pulled: 0,
      sent: 0,
      failed: 0,
      error: "DENISOV_OUTBOX_URL / DENISOV_BIND_* not configured",
    };
  }

  const pullRes = await fetch(`${cfg.url}?limit=20`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cfg.secret}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!pullRes.ok) {
    const body = await pullRes.text().catch(() => "");
    return {
      ok: false,
      pulled: 0,
      sent: 0,
      failed: 0,
      error: `pull ${pullRes.status}: ${body.slice(0, 200)}`,
    };
  }

  const pullData = (await pullRes.json()) as {
    ok?: boolean;
    messages?: OutboxMessage[];
  };
  const messages = Array.isArray(pullData.messages) ? pullData.messages : [];
  if (!messages.length) {
    return { ok: true, pulled: 0, sent: 0, failed: 0 };
  }

  const results: AckItem[] = [];
  for (const msg of messages) {
    if (!msg?.id || !msg.chatId || !msg.text) {
      results.push({ id: msg?.id || "", ok: false, error: "invalid message" });
      continue;
    }
    try {
      const sent = await sendTelegramMessage(msg.chatId, msg.text);
      if (sent.ok) {
        results.push({ id: msg.id, ok: true });
      } else {
        results.push({
          id: msg.id,
          ok: false,
          blocked: sent.blocked === true,
          error: sent.description || "Telegram send failed",
        });
      }
    } catch (error) {
      results.push({
        id: msg.id,
        ok: false,
        error: error instanceof Error ? error.message : "send error",
      });
    }
  }

  const ackRes = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ results }),
    cache: "no-store",
  });

  if (!ackRes.ok) {
    const body = await ackRes.text().catch(() => "");
    return {
      ok: false,
      pulled: messages.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      error: `ack ${ackRes.status}: ${body.slice(0, 200)}`,
    };
  }

  return {
    ok: true,
    pulled: messages.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
};

/** Cron / manual: pull cafedenisov outbox → Telegram → ack. */
export const GET = async (request: Request): Promise<Response> => {
  if (!assertDrainAuth(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainOnce();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drain failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
};

/** Best-effort wake from Denisov after enqueue (often blocked by Jino TLS). */
export const POST = async (request: Request): Promise<Response> => {
  if (!assertDrainAuth(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainOnce();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drain failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
};
