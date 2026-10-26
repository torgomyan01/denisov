import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieSecure } from "@/lib/cookie-secure";
import {
  buildYandexAuthorizeUrl,
  yandexConfigured,
} from "@/lib/yandex-oauth";

export const dynamic = "force-dynamic";

const siteOrigin = (): string =>
  (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

export async function GET() {
  const base = siteOrigin();

  if (!yandexConfigured()) {
    return NextResponse.redirect(
      new URL("/auth?error=yandex_not_configured", base),
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("yandex_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildYandexAuthorizeUrl(state));
}
