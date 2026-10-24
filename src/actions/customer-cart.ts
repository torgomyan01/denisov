"use server";

import { getCustomer, requireCustomer } from "@/lib/customer-auth";
import {
  emptyCustomerCart,
  loadCustomerCart,
  mergePersistedCarts,
  saveCustomerCart,
} from "@/lib/customer-cart";
import { persistedCartSchema } from "@/lib/customer-cart-schema";
import type { ActionResult } from "@/types/site";
import type { PersistedCart } from "@/store/cartSlice";

export const getMyCartAction = async (): Promise<
  ActionResult<PersistedCart>
> => {
  try {
    const customer = await getCustomer();
    if (!customer) {
      return { success: true, data: emptyCustomerCart() };
    }
    const data = await loadCustomerCart(customer.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Не удалось загрузить корзину" };
  }
};

export const saveMyCartAction = async (
  input: unknown,
): Promise<ActionResult<PersistedCart>> => {
  try {
    const customer = await requireCustomer();
    const parsed = persistedCartSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные корзины",
      };
    }
    const data = await saveCustomerCart(customer.id, parsed.data);
    return { success: true, data };
  } catch {
    return { success: false, error: "Войдите, чтобы сохранить корзину" };
  }
};

/** After login/register: merge local guest cart into DB and return the result. */
export const syncCartAfterAuthAction = async (
  localCart: unknown,
): Promise<ActionResult<PersistedCart>> => {
  try {
    const customer = await requireCustomer();
    const remote = await loadCustomerCart(customer.id);
    const parsed = persistedCartSchema.safeParse(localCart);
    const local = parsed.success ? parsed.data : emptyCustomerCart();
    const merged = mergePersistedCarts(local, remote);
    const data = await saveCustomerCart(customer.id, merged);
    return { success: true, data };
  } catch {
    return { success: false, error: "Не удалось синхронизировать корзину" };
  }
};
