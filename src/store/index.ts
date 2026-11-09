import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import cartReducer, { addToCart, addToCartQuiet } from "@/store/cartSlice";
import { METRIKA_GOALS, reachMetrikaGoal } from "@/lib/yandex-metrika";

const cartMetrikaListener = createListenerMiddleware();

cartMetrikaListener.startListening({
  actionCreator: addToCart,
  effect: () => {
    reachMetrikaGoal(METRIKA_GOALS.addToCart);
  },
});

cartMetrikaListener.startListening({
  actionCreator: addToCartQuiet,
  effect: () => {
    reachMetrikaGoal(METRIKA_GOALS.addToCart);
  },
});

export const makeStore = () =>
  configureStore({
    reducer: {
      cart: cartReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(cartMetrikaListener.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
