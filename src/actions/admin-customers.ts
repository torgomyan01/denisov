"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import type { CustomerRole } from "@/lib/customer-auth";
import { normalizePhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/site";

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  hasYandex: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  role: CustomerRole;
};

export type AdminAccountInfo = {
  role: "admin";
  label: string;
  note: string;
};

const roleSchema = z.enum(["customer", "courier"]);

const updateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(2, "Введите имя").max(80),
    phone: z.string().trim().optional(),
    password: z.string().optional(),
    role: roleSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.phone && data.phone.trim()) {
      const phone = normalizePhone(data.phone);
      if (!phone) {
        ctx.addIssue({
          code: "custom",
          message: "Телефон в формате +7 XXX XXX-XX-XX",
          path: ["phone"],
        });
      }
    }
    if (data.password && data.password.length > 0 && data.password.length < 6) {
      ctx.addIssue({
        code: "custom",
        message: "Пароль не короче 6 символов",
        path: ["password"],
      });
    }
  });

const toRow = (c: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: Date | null;
  yandexId: string | null;
  passwordHash: string | null;
  role: CustomerRole;
  createdAt: Date;
  updatedAt: Date;
}): AdminCustomerRow => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email,
  birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : null,
  hasYandex: Boolean(c.yandexId),
  hasPassword: Boolean(c.passwordHash),
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
  role: c.role === "courier" ? "courier" : "customer",
});

export const listCustomersAction = async (): Promise<
  ActionResult<{
    admin: AdminAccountInfo;
    customers: AdminCustomerRow[];
  }>
> => {
  try {
    await requireAuth();
    const customers = await prisma.customer.findMany({
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    });

    return {
      success: true,
      data: {
        admin: {
          role: "admin",
          label: "Администратор панели",
          note: "Вход через /admin и пароль ADMIN_PASSWORD. Не является клиентом сайта.",
        },
        customers: customers.map(toRow),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Требуется авторизация"
        : error instanceof Error
          ? error.message
          : "Ошибка загрузки";
    return { success: false, error: message };
  }
};

const createSchema = z.object({
  name: z.string().trim().min(2, "Введите имя").max(80),
  phone: z
    .string()
    .trim()
    .min(10, "Введите телефон")
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({
          code: "custom",
          message: "Телефон в формате +7 XXX XXX-XX-XX",
        });
        return z.NEVER;
      }
      return phone;
    }),
  password: z
    .string()
    .min(6, "Пароль не короче 6 символов")
    .max(72, "Слишком длинный пароль"),
  role: roleSchema.default("customer"),
});

export const createCustomerAction = async (
  input: unknown,
): Promise<ActionResult<AdminCustomerRow>> => {
  try {
    await requireAuth();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const { name, phone, password, role } = parsed.data;
    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      return { success: false, error: "Этот телефон уже зарегистрирован" };
    }

    const created = await prisma.customer.create({
      data: {
        name,
        phone,
        passwordHash: hashPassword(password),
        role,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/auth");
    revalidatePath("/profile");

    return { success: true, data: toRow(created) };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Требуется авторизация"
        : error instanceof Error
          ? error.message
          : "Ошибка создания";
    return { success: false, error: message };
  }
};

export const updateCustomerAction = async (
  input: unknown,
): Promise<ActionResult<AdminCustomerRow>> => {
  try {
    await requireAuth();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const { id, name } = parsed.data;
    const phoneRaw = parsed.data.phone?.trim() || "";
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    const password = parsed.data.password?.trim() || "";
    const role = parsed.data.role;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Пользователь не найден" };
    }

    if (phone && phone !== existing.phone) {
      const clash = await prisma.customer.findUnique({ where: { phone } });
      if (clash && clash.id !== id) {
        return { success: false, error: "Этот телефон уже занят" };
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone: phoneRaw ? phone : null,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        ...(role ? { role } : {}),
      },
    });

    revalidatePath("/admin");
    revalidatePath("/auth");
    revalidatePath("/profile");
    revalidatePath("/profile/courier");

    return { success: true, data: toRow(updated) };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Требуется авторизация"
        : error instanceof Error
          ? error.message
          : "Ошибка сохранения";
    return { success: false, error: message };
  }
};

const deleteSchema = z.object({
  id: z.string().min(1, "Не указан пользователь"),
});

export const deleteCustomerAction = async (
  input: unknown,
): Promise<ActionResult<{ id: string }>> => {
  try {
    await requireAuth();
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const { id } = parsed.data;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Пользователь не найден" };
    }

    await prisma.customer.delete({ where: { id } });

    revalidatePath("/admin");
    revalidatePath("/auth");
    revalidatePath("/profile");

    return { success: true, data: { id } };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Требуется авторизация"
        : error instanceof Error
          ? error.message
          : "Ошибка удаления";
    return { success: false, error: message };
  }
};
