import { syncCartAfterAuthAction } from "@/actions/customer-cart";
import { coalesceGuestCarts } from "@/lib/customer-cart";
import type { AppDispatch, AppStore } from "@/store";
import {
  cartSnapshot,
  clearPersistedCart,
  hydrateCart,
  loadPersistedCart,
  setCartCloudPersist,
  type PersistedCart,
} from "@/store/cartSlice";

/** Single in-flight merge so login + CartSync boot cannot double-add guest lines. */
let mergeInFlight: Promise<PersistedCart | null> | null = null;

const emptyGuest = (): PersistedCart => ({
  items: [],
  utensils: 0,
  comment: "",
  fulfillmentMode: "pickup",
  pickupPointId: null,
  deliveryAddress: "",
  deliveryLat: null,
  deliveryLng: null,
  timeMode: "asap",
  scheduledAt: null,
});

/**
 * Collect guest cart from localStorage + Redux, merge into the account cart in DB,
 * then clear localStorage so guest lines live only on the account.
 */
export const applyCartAfterAuth = async (
  dispatch: AppDispatch,
  store?: AppStore,
): Promise<void> => {
  if (!mergeInFlight) {
    mergeInFlight = (async (): Promise<PersistedCart | null> => {
      const fromStorage = loadPersistedCart();
      const fromRedux = store
        ? cartSnapshot(store.getState().cart)
        : emptyGuest();
      const guest = coalesceGuestCarts(fromStorage, fromRedux);

      const sync = await syncCartAfterAuthAction(guest);
      if (!sync.success || !sync.data) return null;

      clearPersistedCart();
      setCartCloudPersist(true);
      return sync.data;
    })().finally(() => {
      mergeInFlight = null;
    });
  }

  const data = await mergeInFlight;
  if (data) {
    setCartCloudPersist(true);
    clearPersistedCart();
    dispatch(hydrateCart(data));
  }
};

export const resetCartToGuestMode = (): void => {
  setCartCloudPersist(false);
};
