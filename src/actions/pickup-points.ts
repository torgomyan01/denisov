"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  listActivePickupPoints,
  listAllPickupPoints,
  toPickupPointAdmin,
  type PickupPointAdmin,
  type PickupPointPublic,
} from "@/lib/pickup-points";
import type { ActionResult } from "@/types/site";

const pointSchema = z
  .object({
    name: z.string().trim().min(2, "Введите название").max(120),
    phone: z.string().trim().min(1, "Укажите телефон"),
    address: z.string().trim().min(5, "Укажите адрес").max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .superRefine((data, ctx) => {
    const phone = normalizePhone(data.phone);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        message: "Телефон в формате +7 XXX XXX-XX-XX",
        path: ["phone"],
      });
    }
  });

const updateSchema = pointSchema.and(
  z.object({
    id: z.string().min(1),
  }),
);

export const listPickupPointsPublicAction = async (): Promise<
  ActionResult<PickupPointPublic[]>
> => {
  try {
    const data = await listActivePickupPoints();
    return { success: true, data };
  } catch {
    return { success: false, error: "Не удалось загрузить точки" };
  }
};

export const listPickupPointsAdminAction = async (): Promise<
  ActionResult<PickupPointAdmin[]>
> => {
  try {
    await requireAuth();
    const data = await listAllPickupPoints();
    return { success: true, data };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

export const createPickupPointAction = async (
  input: unknown,
): Promise<ActionResult<PickupPointAdmin>> => {
  try {
    await requireAuth();
    const parsed = pointSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Проверьте поля",
      };
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return { success: false, error: "Некорректный телефон" };
    }

    const maxSort = await prisma.pickupPoint.aggregate({
      _max: { sortOrder: true },
    });
    const sortOrder =
      typeof parsed.data.sortOrder === "number"
        ? parsed.data.sortOrder
        : (maxSort._max.sortOrder ?? -1) + 1;

    const row = await prisma.pickupPoint.create({
      data: {
        name: parsed.data.name,
        phone,
        address: parsed.data.address,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        isActive: parsed.data.isActive ?? true,
        sortOrder,
      },
    });

    revalidatePath("/menu");
    revalidatePath("/");
    return { success: true, data: toPickupPointAdmin(row) };
  } catch {
    return { success: false, error: "Не удалось создать точку" };
  }
};

export const updatePickupPointAction = async (
  input: unknown,
): Promise<ActionResult<PickupPointAdmin>> => {
  try {
    await requireAuth();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Проверьте поля",
      };
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return { success: false, error: "Некорректный телефон" };
    }

    const existing = await prisma.pickupPoint.findUnique({
      where: { id: parsed.data.id },
    });
    if (!existing) {
      return { success: false, error: "Точка не найдена" };
    }

    const row = await prisma.pickupPoint.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        phone,
        address: parsed.data.address,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        isActive: parsed.data.isActive ?? existing.isActive,
        sortOrder:
          typeof parsed.data.sortOrder === "number"
            ? parsed.data.sortOrder
            : existing.sortOrder,
      },
    });

    revalidatePath("/menu");
    revalidatePath("/");
    return { success: true, data: toPickupPointAdmin(row) };
  } catch {
    return { success: false, error: "Не удалось сохранить точку" };
  }
};

export const deletePickupPointAction = async (
  id: string,
): Promise<ActionResult<{ id: string }>> => {
  try {
    await requireAuth();
    const trimmed = String(id || "").trim();
    if (!trimmed) return { success: false, error: "Некорректный id" };

    await prisma.pickupPoint.delete({ where: { id: trimmed } });
    revalidatePath("/menu");
    revalidatePath("/");
    return { success: true, data: { id: trimmed } };
  } catch {
    return { success: false, error: "Не удалось удалить точку" };
  }
};
