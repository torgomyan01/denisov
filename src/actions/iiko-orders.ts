"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  endOfLocalDay,
  listIikoDeliveriesByDate,
  startOfLocalDay,
  type IikoDeliveryListItem,
} from "@/lib/iiko/list-deliveries";
import type { ActionResult } from "@/types/site";

const listSchema = z.object({
  /** Local calendar day `YYYY-MM-DD` */
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата")
    .optional(),
  statuses: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const parseLocalDay = (ymd: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

export const listIikoOrdersAdminAction = async (
  input?: unknown,
): Promise<ActionResult<IikoDeliveryListItem[]>> => {
  try {
    await requireAuth();
    const parsed = listSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const day = parsed.data.date
      ? parseLocalDay(parsed.data.date)
      : new Date();
    if (!day) {
      return { success: false, error: "Некорректная дата" };
    }

    const result = await listIikoDeliveriesByDate({
      dateFrom: startOfLocalDay(day),
      dateTo: endOfLocalDay(day),
      statuses: parsed.data.statuses,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.orders };
  } catch {
    return { success: false, error: "Нет доступа" };
  }
};
