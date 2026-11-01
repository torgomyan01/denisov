"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/site";

export type StaffTelegramRecipientRow = {
  id: string;
  chatId: string;
  name: string;
  title: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const chatIdSchema = z
  .string()
  .trim()
  .regex(/^-?\d{5,20}$/, "Chat id — число (например 809580214)");

const createSchema = z.object({
  chatId: chatIdSchema,
  name: z.string().trim().min(1, "Укажите имя").max(120),
  title: z.string().trim().max(120).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  chatId: chatIdSchema,
  name: z.string().trim().min(1, "Укажите имя").max(120),
  title: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
});

const toRow = (row: {
  id: string;
  chatId: string;
  name: string;
  title: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): StaffTelegramRecipientRow => ({
  id: row.id,
  chatId: row.chatId,
  name: row.name,
  title: row.title,
  isActive: row.isActive,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listStaffTelegramRecipientsAction = async (): Promise<
  ActionResult<StaffTelegramRecipientRow[]>
> => {
  try {
    await requireAuth();
    const rows = await prisma.staffTelegramRecipient.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return { success: true, data: rows.map(toRow) };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

export const createStaffTelegramRecipientAction = async (
  input: unknown,
): Promise<ActionResult<StaffTelegramRecipientRow>> => {
  try {
    await requireAuth();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Проверьте данные",
      };
    }

    const chatId = parsed.data.chatId;
    const existing = await prisma.staffTelegramRecipient.findUnique({
      where: { chatId },
    });
    if (existing) {
      return { success: false, error: "Этот chat id уже добавлен" };
    }

    const row = await prisma.staffTelegramRecipient.create({
      data: {
        chatId,
        name: parsed.data.name,
        title: (parsed.data.title ?? "").trim(),
        isActive: true,
      },
    });
    revalidatePath("/admin");
    return { success: true, data: toRow(row) };
  } catch {
    return { success: false, error: "Не удалось добавить" };
  }
};

export const updateStaffTelegramRecipientAction = async (
  input: unknown,
): Promise<ActionResult<StaffTelegramRecipientRow>> => {
  try {
    await requireAuth();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Проверьте данные",
      };
    }

    const clash = await prisma.staffTelegramRecipient.findFirst({
      where: {
        chatId: parsed.data.chatId,
        NOT: { id: parsed.data.id },
      },
    });
    if (clash) {
      return { success: false, error: "Этот chat id уже используется" };
    }

    const row = await prisma.staffTelegramRecipient.update({
      where: { id: parsed.data.id },
      data: {
        chatId: parsed.data.chatId,
        name: parsed.data.name,
        title: (parsed.data.title ?? "").trim(),
        ...(typeof parsed.data.isActive === "boolean"
          ? { isActive: parsed.data.isActive }
          : {}),
      },
    });
    revalidatePath("/admin");
    return { success: true, data: toRow(row) };
  } catch {
    return { success: false, error: "Не удалось сохранить" };
  }
};

export const deleteStaffTelegramRecipientAction = async (
  id: string,
): Promise<ActionResult<{ ok: true }>> => {
  try {
    await requireAuth();
    if (!id?.trim()) {
      return { success: false, error: "Не найден" };
    }
    await prisma.staffTelegramRecipient.delete({ where: { id } });
    revalidatePath("/admin");
    return { success: true, data: { ok: true } };
  } catch {
    return { success: false, error: "Не удалось удалить" };
  }
};
