"use client";

import { ShoppingBag } from "lucide-react";
import { cartIcon } from "@/components/cart/cart-styles";
import { formatPrice } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  cartItemCount,
  cartSubtotal,
  openCart,
} from "@/store/cartSlice";

export const CartFab = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.cart.items);
  const count = cartItemCount(items);
  const total = cartSubtotal(items);
  const isOpen = useAppSelector((s) => s.cart.isOpen);

  if (isOpen) return null;

  const label =
    count > 0
      ? `Мой заказ · ${count} · ${formatPrice(String(Math.round(total)))}`
      : "Корзина";

  return (
    <button
      type="button"
      className="fixed right-4 bottom-[1.15rem] z-55 inline-flex min-h-[52px] max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-[0.55rem] rounded-full border-0 bg-ink pr-[1.05rem] pl-[0.95rem] text-[12px] leading-none font-[650] tracking-[0.1em] text-paper uppercase shadow-[0_14px_36px_rgba(33,30,25,0.28)] transition-[translate,background-color] duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-clay motion-reduce:transition-none"
      aria-label={count ? `Корзина, ${count}` : "Открыть корзину"}
      onClick={() => dispatch(openCart())}
    >
      <ShoppingBag
        size={22}
        strokeWidth={1.75}
        className={`${cartIcon} shrink-0`}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </button>
  );
};
