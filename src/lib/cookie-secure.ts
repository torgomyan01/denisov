import { headers } from "next/headers";

/**
 * Secure cookies must match the browser URL scheme.
 * Prefer COOKIE_SECURE, then X-Forwarded-Proto from the reverse proxy.
 */
export const cookieSecure = async (): Promise<boolean> => {
  const forced = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (forced === "true" || forced === "1") return true;
  if (forced === "false" || forced === "0") return false;

  try {
    const headerStore = await headers();
    const proto = headerStore
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (proto === "https") return true;
    if (proto === "http") return false;
  } catch {
    /* no request context */
  }

  return false;
};

export const sessionCookieOptions = async (expiresAt: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: await cookieSecure(),
  path: "/",
  expires: expiresAt,
});
