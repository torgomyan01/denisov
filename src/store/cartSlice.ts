import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  FulfillmentMode,
  PickupTimeMode,
} from "@/lib/cart-fulfillment";

export type CartProduct = {
  id: string;
  name: string;
  price: string;
  image: string;
  categoryId: string;
  categoryName: string;
};

export type CartLine = CartProduct & {
  qty: number;
};

export type PersistedCart = {
  items: CartLine[];
  utensils: number;
  comment: string;
  fulfillmentMode: FulfillmentMode;
  pickupPointId: string | null;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: PickupTimeMode;
  scheduledAt: string | null;
};

type CartState = {
  items: CartLine[];
  utensils: number;
  comment: string;
  commentOpen: boolean;
  fulfillmentMode: FulfillmentMode;
  pickupPointId: string | null;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: PickupTimeMode;
  scheduledAt: string | null;
  isOpen: boolean;
};

const STORAGE_KEY = "denisov_cart_v5";

const normalizeCoord = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

export const parsePriceNumber = (price: string): number => {
  const match = String(price ?? "").replace(",", ".").match(/[\d.]+/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
};

export const cartLineTotal = (line: CartLine): number =>
  parsePriceNumber(line.price) * line.qty;

export const cartSubtotal = (items: CartLine[]): number =>
  items.reduce((sum, line) => sum + cartLineTotal(line), 0);

export const cartItemCount = (items: CartLine[]): number =>
  items.reduce((sum, line) => sum + line.qty, 0);

const emptyPersisted = (): PersistedCart => ({
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

const normalizeLine = (row: unknown): CartLine | null => {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const name = typeof r.name === "string" ? r.name : "";
  if (!id || !name) return null;
  const qtyRaw = typeof r.qty === "number" ? r.qty : 1;
  return {
    id,
    name,
    price: typeof r.price === "string" ? r.price : "",
    image: typeof r.image === "string" ? r.image : "",
    categoryId: typeof r.categoryId === "string" ? r.categoryId : "",
    categoryName: typeof r.categoryName === "string" ? r.categoryName : "",
    qty: Math.max(1, Math.min(99, Math.round(qtyRaw))),
  };
};

const normalizeMode = (value: unknown): FulfillmentMode =>
  value === "delivery" ? "delivery" : "pickup";

const normalizeTimeMode = (value: unknown): PickupTimeMode =>
  value === "scheduled" ? "scheduled" : "asap";

export const loadPersistedCart = (): PersistedCart => {
  if (typeof window === "undefined") return emptyPersisted();
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem("denisov_cart_v4") ||
      window.localStorage.getItem("denisov_cart_v3") ||
      window.localStorage.getItem("denisov_cart_v2") ||
      window.localStorage.getItem("denisov_cart_v1");
    if (!raw) return emptyPersisted();

    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        ...emptyPersisted(),
        items: parsed
          .map(normalizeLine)
          .filter((row): row is CartLine => Boolean(row)),
      };
    }
    if (!parsed || typeof parsed !== "object") return emptyPersisted();

    const data = parsed as Record<string, unknown>;
    const items = Array.isArray(data.items)
      ? data.items
          .map(normalizeLine)
          .filter((row): row is CartLine => Boolean(row))
      : [];
    const utensilsRaw = typeof data.utensils === "number" ? data.utensils : 0;
    const comment = typeof data.comment === "string" ? data.comment : "";
    const deliveryAddress =
      typeof data.deliveryAddress === "string" ? data.deliveryAddress : "";
    const pickupPointId =
      typeof data.pickupPointId === "string" && data.pickupPointId
        ? data.pickupPointId
        : null;
    const scheduledRaw =
      typeof data.scheduledAt === "string" ? data.scheduledAt : null;
    const scheduledAt =
      scheduledRaw && !Number.isNaN(new Date(scheduledRaw).getTime())
        ? scheduledRaw
        : null;

    return {
      items,
      utensils: Math.max(0, Math.min(20, Math.round(utensilsRaw))),
      comment: comment.slice(0, 500),
      fulfillmentMode: normalizeMode(data.fulfillmentMode),
      pickupPointId,
      deliveryAddress: deliveryAddress.slice(0, 240),
      deliveryLat: normalizeCoord(data.deliveryLat),
      deliveryLng: normalizeCoord(data.deliveryLng),
      timeMode: normalizeTimeMode(data.timeMode),
      scheduledAt,
    };
  } catch {
    return emptyPersisted();
  }
};

export const cartSnapshot = (state: {
  items: CartLine[];
  utensils: number;
  comment: string;
  fulfillmentMode: FulfillmentMode;
  pickupPointId: string | null;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: PickupTimeMode;
  scheduledAt: string | null;
}): PersistedCart => ({
  items: state.items,
  utensils: state.utensils,
  comment: state.comment,
  fulfillmentMode: state.fulfillmentMode,
  pickupPointId: state.pickupPointId,
  deliveryAddress: state.deliveryAddress,
  deliveryLat: state.deliveryLat,
  deliveryLng: state.deliveryLng,
  timeMode: state.timeMode,
  scheduledAt: state.scheduledAt,
});

/** When true, mutations still update Redux; localStorage writes are skipped (DB sync owns persistence). */
let cloudPersist = false;

export const setCartCloudPersist = (enabled: boolean): void => {
  cloudPersist = enabled;
};

export const isCartCloudPersist = (): boolean => cloudPersist;

export const persistCart = (state: {
  items: CartLine[];
  utensils: number;
  comment: string;
  fulfillmentMode: FulfillmentMode;
  pickupPointId: string | null;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  timeMode: PickupTimeMode;
  scheduledAt: string | null;
}): void => {
  if (typeof window === "undefined") return;
  if (cloudPersist) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(cartSnapshot(state)),
    );
  } catch {
    /* ignore quota */
  }
};

export const clearPersistedCart = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("denisov_cart_v4");
    window.localStorage.removeItem("denisov_cart_v3");
    window.localStorage.removeItem("denisov_cart_v2");
    window.localStorage.removeItem("denisov_cart_v1");
  } catch {
    /* ignore */
  }
};

const initialState: CartState = {
  items: [],
  utensils: 0,
  comment: "",
  commentOpen: false,
  fulfillmentMode: "pickup",
  pickupPointId: null,
  deliveryAddress: "",
  deliveryLat: null,
  deliveryLng: null,
  timeMode: "asap",
  scheduledAt: null,
  isOpen: false,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    hydrateCart(state, action: PayloadAction<PersistedCart>) {
      state.items = action.payload.items;
      state.utensils = action.payload.utensils;
      state.comment = action.payload.comment;
      state.fulfillmentMode = action.payload.fulfillmentMode;
      state.pickupPointId = action.payload.pickupPointId;
      state.deliveryAddress = action.payload.deliveryAddress;
      state.deliveryLat = action.payload.deliveryLat;
      state.deliveryLng = action.payload.deliveryLng;
      state.timeMode = action.payload.timeMode;
      state.scheduledAt = action.payload.scheduledAt;
    },
    openCart(state) {
      state.isOpen = true;
    },
    closeCart(state) {
      state.isOpen = false;
      state.commentOpen = false;
    },
    toggleCart(state) {
      state.isOpen = !state.isOpen;
      if (!state.isOpen) state.commentOpen = false;
    },
    addToCart(state, action: PayloadAction<CartProduct>) {
      const product = action.payload;
      const existing = state.items.find((line) => line.id === product.id);
      if (existing) {
        existing.qty = Math.min(99, existing.qty + 1);
      } else {
        state.items.push({ ...product, qty: 1 });
      }
      state.isOpen = true;
      persistCart(state);
    },
    /** Add without opening the drawer (catalog / modal). */
    addToCartQuiet(state, action: PayloadAction<CartProduct>) {
      const product = action.payload;
      const existing = state.items.find((line) => line.id === product.id);
      if (existing) {
        existing.qty = Math.min(99, existing.qty + 1);
      } else {
        state.items.push({ ...product, qty: 1 });
      }
      persistCart(state);
    },
    setQty(state, action: PayloadAction<{ id: string; qty: number }>) {
      const line = state.items.find((row) => row.id === action.payload.id);
      if (!line) return;
      const next = Math.round(action.payload.qty);
      if (next <= 0) {
        state.items = state.items.filter((row) => row.id !== action.payload.id);
      } else {
        line.qty = Math.min(99, next);
      }
      persistCart(state);
    },
    incrementQty(state, action: PayloadAction<string>) {
      const line = state.items.find((row) => row.id === action.payload);
      if (!line) return;
      line.qty = Math.min(99, line.qty + 1);
      persistCart(state);
    },
    decrementQty(state, action: PayloadAction<string>) {
      const line = state.items.find((row) => row.id === action.payload);
      if (!line) return;
      if (line.qty <= 1) {
        state.items = state.items.filter((row) => row.id !== action.payload);
      } else {
        line.qty -= 1;
      }
      persistCart(state);
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((row) => row.id !== action.payload);
      persistCart(state);
    },
    /** Clears line items / extras; keeps pickup / delivery choice until the user changes it. */
    clearCart(state) {
      state.items = [];
      state.utensils = 0;
      state.comment = "";
      state.commentOpen = false;
      state.timeMode = "asap";
      state.scheduledAt = null;
      persistCart(state);
    },
    setUtensils(state, action: PayloadAction<number>) {
      state.utensils = Math.max(0, Math.min(20, Math.round(action.payload)));
      persistCart(state);
    },
    incrementUtensils(state) {
      state.utensils = Math.min(20, state.utensils + 1);
      persistCart(state);
    },
    decrementUtensils(state) {
      state.utensils = Math.max(0, state.utensils - 1);
      persistCart(state);
    },
    setComment(state, action: PayloadAction<string>) {
      state.comment = action.payload.slice(0, 500);
      persistCart(state);
    },
    openComment(state) {
      state.commentOpen = true;
    },
    closeComment(state) {
      state.commentOpen = false;
    },
    toggleComment(state) {
      state.commentOpen = !state.commentOpen;
    },
    setFulfillmentMode(state, action: PayloadAction<FulfillmentMode>) {
      state.fulfillmentMode = action.payload;
      persistCart(state);
    },
    setPickupPointId(state, action: PayloadAction<string | null>) {
      state.pickupPointId = action.payload;
      persistCart(state);
    },
    setDeliveryAddress(state, action: PayloadAction<string>) {
      state.deliveryAddress = action.payload.slice(0, 240);
      persistCart(state);
    },
    setDeliveryLocation(
      state,
      action: PayloadAction<{
        lat: number;
        lng: number;
        address?: string;
      }>,
    ) {
      const { lat, lng, address } = action.payload;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      state.deliveryLat = Number(lat.toFixed(6));
      state.deliveryLng = Number(lng.toFixed(6));
      if (typeof address === "string") {
        state.deliveryAddress = address.slice(0, 240);
      } else if (!state.deliveryAddress.trim()) {
        state.deliveryAddress = "Адрес на карте";
      }
      state.fulfillmentMode = "delivery";
      persistCart(state);
    },
    clearDeliveryLocation(state) {
      state.deliveryAddress = "";
      state.deliveryLat = null;
      state.deliveryLng = null;
      persistCart(state);
    },
    setTimeMode(state, action: PayloadAction<PickupTimeMode>) {
      state.timeMode = action.payload;
      if (action.payload === "asap") state.scheduledAt = null;
      persistCart(state);
    },
    setScheduledAt(state, action: PayloadAction<string>) {
      const raw = action.payload;
      if (!raw || Number.isNaN(new Date(raw).getTime())) return;
      state.timeMode = "scheduled";
      state.scheduledAt = raw;
      persistCart(state);
    },
  },
});

export const {
  hydrateCart,
  openCart,
  closeCart,
  toggleCart,
  addToCart,
  addToCartQuiet,
  setQty,
  incrementQty,
  decrementQty,
  removeFromCart,
  clearCart,
  setUtensils,
  incrementUtensils,
  decrementUtensils,
  setComment,
  openComment,
  closeComment,
  toggleComment,
  setFulfillmentMode,
  setPickupPointId,
  setDeliveryAddress,
  setDeliveryLocation,
  clearDeliveryLocation,
  setTimeMode,
  setScheduledAt,
} = cartSlice.actions;

export default cartSlice.reducer;
