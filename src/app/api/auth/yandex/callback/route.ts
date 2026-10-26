import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createCustomerSession } from "@/lib/customer-auth";
import {
  exchangeYandexCode,
  fetchYandexProfile,
  upsertCustomerFromYandex,
  yandexConfigured,
} from "@/lib/yandex-oauth";

export const dynamic = "force-dynamic";

const origin = (): string =>
  (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  // Prefer SITE_URL: behind nginx, request.nextUrl.origin is often http://127.0.0.1:3000
  const base = origin();

  if (!yandexConfigured()) {
    return NextResponse.redirect(`${base}/auth?error=yandex_not_configured`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${base}/auth?error=yandex_denied`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("yandex_oauth_state")?.value;
  cookieStore.delete("yandex_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${base}/auth?error=yandex_state`);
  }

  try {
    const accessToken = await exchangeYandexCode(code);
    const profile = await fetchYandexProfile(accessToken);
    const customerId = await upsertCustomerFromYandex(profile);
    await createCustomerSession(customerId);
    return NextResponse.redirect(`${base}/auth?ok=yandex`);
  } catch {
    return NextResponse.redirect(`${base}/auth?error=yandex_failed`);
  }
}
