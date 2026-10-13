import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "denisov_admin_session";
const SESSION_HOURS = 12;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const getAdminPassword = (): string =>
  process.env.ADMIN_PASSWORD?.trim() || "denisov2026";

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
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

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
  cookieStore.delete(COOKIE_NAME);
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
    cookieStore.delete(COOKIE_NAME);
    return false;
  }

  return true;
};

export const requireAuth = async (): Promise<void> => {
  const ok = await getSession();
  if (!ok) {
    throw new Error("Unauthorized");
  }
};

export const pruneExpiredSessions = async (): Promise<void> => {
  await prisma.adminSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
};
