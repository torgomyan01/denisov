"use client";

import { useEffect, useRef } from "react";
import { getMyCartAction, saveMyCartAction } from "@/actions/customer-cart";
import { getCustomerAction } from "@/actions/customer-auth";
import { applyCartAfterAuth } from "@/lib/cart-auth-sync";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import {
  cartSnapshot,
  hydrateCart,
  isCartCloudPersist,
  loadPersistedCart,
  setCartCloudPersist,
} from "@/store/cartSlice";

/**
 * Guest → localStorage. Logged-in → DB.
 * If guest items exist in localStorage when a session is present, merge into account once.
 */
export const CartSync = () => {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const readyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const auth = await getCustomerAction();
      if (cancelled) return;

      const customer = auth.success && auth.data ? auth.data : null;

      if (!customer) {
        setCartCloudPersist(false);
        dispatch(hydrateCart(loadPersistedCart()));
        readyRef.current = true;
        return;
      }

      const guestLocal = loadPersistedCart();
      if (guestLocal.items.length > 0) {
        await applyCartAfterAuth(dispatch, store);
      } else {
        const remote = await getMyCartAction();
        if (cancelled) return;
        setCartCloudPersist(true);
        dispatch(
          hydrateCart(
            remote.success && remote.data
              ? remote.data
              : cartSnapshot(store.getState().cart),
          ),
        );
      }

      if (!cancelled) readyRef.current = true;
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [dispatch, store]);

  useEffect(() => {
    const scheduleSave = () => {
      if (!readyRef.current || !isCartCloudPersist()) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (!isCartCloudPersist()) return;
        void saveMyCartAction(cartSnapshot(store.getState().cart));
      }, 500);
    };

    const unsub = store.subscribe(scheduleSave);
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store]);

  return null;
};
