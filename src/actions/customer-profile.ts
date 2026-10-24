"use server";

import { revalidatePath } from "next/cache";
import {
  getCustomer,
  type CustomerPublic,
} from "@/lib/customer-auth";
import {
  getCustomerProfileById,
  updateCustomerProfileById,
  type CustomerProfile,
} from "@/lib/customer-profile";
import { updateCustomerProfileSchema } from "@/lib/customer-schema";
import { normalizePhone } from "@/lib/phone";
import type { ActionResult } from "@/types/site";

export const getProfileAction = async (): Promise<
  ActionResult<CustomerProfile | null>
> => {
  try {
    const session = await getCustomer();
    if (!session) return { success: true, data: null };
    const profile = await getCustomerProfileById(session.id);
    return { success: true, data: profile };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка профиля";
    return { success: false, error: message };
  }
};

export const updateProfileAction = async (
  input: unknown,
): Promise<ActionResult<CustomerPublic>> => {
  try {
    const session = await getCustomer();
    if (!session) {
      return { success: false, error: "Требуется авторизация" };
    }

    const parsed = updateCustomerProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const phone = normalizePhone(parsed.data.phone);
    const result = await updateCustomerProfileById(session.id, {
      name: parsed.data.name,
      surname: parsed.data.surname,
      phone,
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      deliveryLat: parsed.data.deliveryLat ?? null,
      deliveryLng: parsed.data.deliveryLng ?? null,
      pickupPointId: parsed.data.pickupPointId ?? null,
      fulfillmentMode: parsed.data.fulfillmentMode,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/profile");
    revalidatePath("/menu");

    const { createdAt: _c, updatedAt: _u, ...publicProfile } = result.profile;
    return {
      success: true,
      data: publicProfile,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка сохранения";
    return { success: false, error: message };
  }
};
