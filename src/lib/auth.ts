import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "denisov_admin_session";
const SESSION_HOURS = 12;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const getAdminPassword = (): string =>
  process.env.ADMIN_PASSWORD?.trim() || "denisov2026";

/**
 * Secure cookies must match the browser URL scheme.
 * SITE_URL alone is unreliable (often https before TLS is live).
 * Prefer COOKIE_SECURE, then X-Forwarded-Proto from Nginx.
 */
const cookieSecure = async (): Promise<boolean> => {
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

const sessionCookieOptions = async (expiresAt: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: await cookieSecure(),
  path: "/",
  expires: expiresAt,
});

export const verifyPassword = (password: string): boolean => {
  const expected = Buffer.from(getAdminPassword());
  const actual = Buffer.from(password);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
};

export const createSession = async (): Promise<string> => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, await sessionCookieOptions(expiresAt));

  return token;
};

export const destroySession = async (): Promise<void> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  cookieStore.set(COOKIE_NAME, "", {
    ...(await sessionCookieOptions(new Date(0))),
    maxAge: 0,
  });
};

const touchSession = async (token: string): Promise<void> => {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.adminSession.updateMany({
    where: { tokenHash: hashToken(token) },
    data: { expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, await sessionCookieOptions(expiresAt));
};

export const getSession = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!session) return false;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } });
    try {
      cookieStore.set(COOKIE_NAME, "", {
        ...(await sessionCookieOptions(new Date(0))),
        maxAge: 0,
      });
    } catch {
      /* ignore — read-only contexts */
    }
    return false;
  }

  return true;
};

export const requireAuth = async (): Promise<void> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    throw new Error("Unauthorized");
  }

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    if (session) {
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    try {
      cookieStore.set(COOKIE_NAME, "", {
        ...(await sessionCookieOptions(new Date(0))),
        maxAge: 0,
      });
    } catch {
      /* ignore */
    }
    throw new Error("Unauthorized");
  }

  // Sliding expiration so long admin edits (e.g. menu sorting) stay signed in.
  await touchSession(token);
};

export const pruneExpiredSessions = async (): Promise<void> => {
  await prisma.adminSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
};
