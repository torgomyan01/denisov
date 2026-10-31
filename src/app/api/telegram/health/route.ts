import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public diagnostics — no secret values. */
export const GET = async (): Promise<Response> => {
  const gatewaySecret = process.env.GATEWAY_SECRET?.trim() ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const bindUrl = process.env.DENISOV_BIND_URL?.trim() ?? "";
  const bindSecret = process.env.DENISOV_BIND_SECRET?.trim() ?? "";

  return NextResponse.json({
    ok: true,
    hasGatewaySecret: gatewaySecret.length > 0,
    gatewaySecretLength: gatewaySecret.length,
    hasBotToken: botToken.length > 0,
    hasBindUrl: bindUrl.length > 0,
    hasBindSecret: bindSecret.length > 0,
    bindUrlHost: (() => {
      try {
        return bindUrl ? new URL(bindUrl).host : null;
      } catch {
        return "invalid";
      }
    })(),
  });
};
