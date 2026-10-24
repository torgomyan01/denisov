"use client";

import { useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { CartSync } from "@/components/cart/CartSync";
import { makeStore, type AppStore } from "@/store";

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <CartSync />
      {children}
    </Provider>
  );
};
