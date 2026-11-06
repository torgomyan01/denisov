"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  listAllDeliveryZones,
  nextZoneColor,
  normalizeZoneColor,
  toDeliveryZoneAdmin,
  type DeliveryZoneAdmin,
} from "@/lib/delivery-zones";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import { prisma } from "@/lib/prisma";
import { getSite } from "@/lib/site";
import type { ActionResult, DeliverySettings } from "@/types/site";

const polygonSchema = z
  .array(z.tuple([z.number(), z.number()]))
  .min(3, "Нарисуйте зону минимум из 3 точек");

const zoneBodySchema = z.object({
  name: z.string().trim().min(2, "Укажите название зоны").max(120),
  color: z.string().trim().optional(),
  polygon: polygonSchema,
  deliveryFee: z.number().int().min(0).max(100_000),
  freeDeliveryFrom: z.number().int().min(0).max(1_000_000).optional(),
  minOrderAmount: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const updateZoneSchema = zoneBodySchema.and(
  z.object({
    id: z.string().min(1),
  }),
);

const deliverySettingsPatchSchema = z.object({
  ordersEnabled: z.boolean(),
  title: z.string().trim().max(255).optional(),
  subtitle: z.string().trim().max(500).optional(),
  minOrderAmount: z.number().int().min(0).max(1_000_000),
  deliveryFee: z.number().int().min(0).max(100_000),
  freeDeliveryFrom: z.number().int().min(0).max(1_000_000),
});

const revalidateDelivery = () => {
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/admin");
};

export const listDeliveryZonesAdminAction = async (): Promise<
  ActionResult<DeliveryZoneAdmin[]>
> => {
  try {
    await requireAuth();
    const data = await listAllDeliveryZones();
    return { success: true, data };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

export const getDeliverySettingsAdminAction = async (): Promise<
  ActionResult<DeliverySettings>
> => {
  try {
    await requireAuth();
    const site = await getSite();
    return {
      success: true,
      data: site.delivery ?? createDefaultDeliverySettings(),
    };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};

export const updateDeliverySettingsAction = async (
  input: unknown,
): Promise<ActionResult<DeliverySettings>> => {
  try {
    await requireAuth();
    const parsed = deliverySettingsPatchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Проверьте поля",
      };
    }

    const defaults = createDefaultDeliverySettings();
    await prisma.deliverySettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        title: parsed.data.title?.trim() || defaults.title,
        subtitle: parsed.data.subtitle?.trim() || defaults.subtitle,
        ordersEnabled: parsed.data.ordersEnabled,
        minOrderAmount: parsed.data.minOrderAmount,
        deliveryFee: parsed.data.deliveryFee,
        freeDeliveryFrom: parsed.data.freeDeliveryFrom,
      },
      update: {
        ...(parsed.data.title != null
          ? { title: parsed.data.title.trim() || defaults.title }
          : {}),
        ...(parsed.data.subtitle != null
          ? { subtitle: parsed.data.subtitle.trim() }
          : {}),
        ordersEnabled: parsed.data.ordersEnabled,
        minOrderAmount: parsed.data.minOrderAmount,
        deliveryFee: parsed.data.deliveryFee,
        freeDeliveryFrom: parsed.data.freeDeliveryFrom,
      },
    });

    revalidateDelivery();
    const site = await getSite();
    return {
      success: true,
      data: site.delivery ?? createDefaultDeliverySettings(),
    };
  } catch {
    return { success: false, error: "Не удалось сохранить настройки" };
  }
};

export const createDeliveryZoneAction = async (
  input: unknown,
): Promise<ActionResult<DeliveryZoneAdmin>> => {
  try {
    await requireAuth();
    const parsed = zoneBodySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Проверьте поля",
      };
    }

    const existing = await listAllDeliveryZones();
    const maxSort = existing.reduce(
      (max, z) => Math.max(max, z.sortOrder),
      -1,
    );
    const color =
      normalizeZoneColor(parsed.data.color) ||
      nextZoneColor(existing.map((z) => z.color));

    const row = await prisma.deliveryZone.create({
      data: {
        name: parsed.data.name,
        color,
        polygonJson: JSON.stringify(parsed.data.polygon),
        deliveryFee: parsed.data.deliveryFee,
        freeDeliveryFrom: parsed.data.freeDeliveryFrom ?? 0,
        minOrderAmount: parsed.data.minOrderAmount ?? 0,
        isActive: parsed.data.isActive ?? true,
        sortOrder:
          typeof parsed.data.sortOrder === "number"
            ? parsed.data.sortOrder
            : maxSort + 1,
      },
    });

    revalidateDelivery();
    return { success: true, data: toDeliveryZoneAdmin(row) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось создать зону";
    if (/deliveryZone|DeliveryZone|does not exist|P2021/i.test(message)) {
      return {
        success: false,
        error:
          "Таблица зон ещё не создана. Выполните на сервере: npm run db:push",
      };
    }
    if (/P1001|Can't reach database|ECONNREFUSED/i.test(message)) {
      return {
        success: false,
        error: "Нет связи с базой (проверьте SSH-туннель к MySQL)",
      };
    }
    console.error("[createDeliveryZoneAction]", error);
    return {
      success: false,
      error: message.slice(0, 240) || "Не удалось создать зону",
    };
  }
};

export const updateDeliveryZoneAction = async (
  input: unknown,
): Promise<ActionResult<DeliveryZoneAdmin>> => {
  try {
    await requireAuth();
    const parsed = updateZoneSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Проверьте поля",
      };
    }

    const existing = await prisma.deliveryZone.findUnique({
      where: { id: parsed.data.id },
    });
    if (!existing) {
      return { success: false, error: "Зона не найдена" };
    }

    const row = await prisma.deliveryZone.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        color: normalizeZoneColor(parsed.data.color || existing.color),
        polygonJson: JSON.stringify(parsed.data.polygon),
        deliveryFee: parsed.data.deliveryFee,
        freeDeliveryFrom: parsed.data.freeDeliveryFrom ?? 0,
        minOrderAmount: parsed.data.minOrderAmount ?? 0,
        isActive: parsed.data.isActive ?? existing.isActive,
        ...(typeof parsed.data.sortOrder === "number"
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
      },
    });

    revalidateDelivery();
    return { success: true, data: toDeliveryZoneAdmin(row) };
  } catch {
    return { success: false, error: "Не удалось сохранить зону" };
  }
};

export const deleteDeliveryZoneAction = async (
  id: unknown,
): Promise<ActionResult> => {
  try {
    await requireAuth();
    const trimmed = String(id ?? "").trim();
    if (!trimmed) return { success: false, error: "Некорректный id" };

    await prisma.deliveryZone.delete({ where: { id: trimmed } });
    revalidateDelivery();
    return { success: true };
  } catch {
    return { success: false, error: "Не удалось удалить зону" };
  }
};
