"use server";

import { revalidatePath } from "next/cache";
import {
  createSession,
  destroySession,
  getSession,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";
import { loginSchema } from "@/lib/site-schema";
import type { ActionResult } from "@/types/site";

export const loginAction = async (
  input: unknown,
): Promise<ActionResult> => {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  if (!verifyPassword(parsed.data.password)) {
    return { success: false, error: "Неверный пароль" };
  }

  await pruneExpiredSessions();
  await createSession();
  return { success: true };
};

export const logoutAction = async (): Promise<ActionResult> => {
  await destroySession();
  revalidatePath("/admin");
  return { success: true };
};

export const checkAuthAction = async (): Promise<ActionResult<{ ok: boolean }>> => {
  const ok = await getSession();
  return { success: true, data: { ok } };
};
