import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cookieSecure } from "@/lib/cookie-secure";
import {
  buildYandexAuthorizeUrl,
  yandexConfigured,
} from "@/lib/yandex-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  if (!yandexConfigured()) {
    return NextResponse.redirect(
      new URL("/auth?error=yandex_not_configured", origin),
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
