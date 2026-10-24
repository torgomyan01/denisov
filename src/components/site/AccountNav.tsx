"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Package,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { logoutCustomerAction } from "@/actions/customer-auth";
import { resetCartToGuestMode } from "@/lib/cart-auth-sync";
import type { CustomerPublic } from "@/lib/customer-auth";
import {
  customerDisplayName,
  customerFirstName,
  customerInitials,
} from "@/lib/customer-display";
import { formatPhoneDisplay } from "@/lib/phone";
import { underlineLink } from "@/components/site/styles";

const menuItemBase =
  "flex w-full cursor-pointer items-center gap-[0.55rem] rounded-[10px] border-0 bg-transparent px-[0.7rem] py-[0.65rem] text-left font-sans text-[0.9rem] leading-[1.2] font-semibold transition-[background-color,color] duration-150 disabled:cursor-wait disabled:opacity-55";
const menuItemDefault =
  "text-ink hover:enabled:bg-clay/10 hover:enabled:text-[#6f4a34]";
const menuItemDanger =
  "text-[#8a2f22] hover:enabled:bg-[rgba(163,59,43,0.08)] hover:enabled:text-[#8a2f22]";

interface AccountNavProps {
  customer: CustomerPublic | null;
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}

export const AccountNav = ({
  customer,
  variant,
  onNavigate,
}: AccountNavProps) => {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!customer) {
    return (
      <Link
        href="/auth"
        className={variant === "desktop" ? underlineLink : undefined}
        onClick={onNavigate}
      >
        Войти
      </Link>
    );
  }

  const name = customerDisplayName(customer);
  const phone = customer.phone ? formatPhoneDisplay(customer.phone) : null;
  const initials = customerInitials(customer);
  const isMobile = variant === "mobile";

  const go = (href: string) => {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logoutCustomerAction();
      resetCartToGuestMode();
      setOpen(false);
      onNavigate?.();
      router.replace("/auth");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={
        isMobile
          ? "relative flex w-full flex-col items-stretch"
          : "relative inline-flex flex-col items-end"
      }
    >
      <button
        type="button"
        className={`inline-flex cursor-pointer items-center rounded-full border text-ink no-underline normal-case tracking-[0] font-[inherit] transition-[border-color,box-shadow,translate] duration-[250ms] hover:-translate-y-px hover:border-clay/45 hover:shadow-[0_10px_22px_rgba(156,107,74,0.12)] motion-reduce:transition-none ${
          open
            ? "border-clay/50 shadow-[0_10px_22px_rgba(156,107,74,0.12)]"
            : "border-clay/[.22] shadow-[0_6px_18px_rgba(33,30,25,0.05)]"
        } ${
          isMobile
            ? "mt-1 w-full max-w-none gap-[0.85rem] rounded-[18px] py-[0.85rem] pr-4 pl-[0.85rem] [background:linear-gradient(120deg,rgba(156,107,74,0.12),transparent_45%),rgba(255,255,255,0.7)]"
            : "max-w-[12.5rem] gap-[0.55rem] py-[0.28rem] pr-[0.55rem] pl-[0.28rem] [background:linear-gradient(135deg,rgba(156,107,74,0.1),rgba(251,248,241,0.9)_55%),rgba(255,255,255,0.55)]"
        }`}
        aria-label={`Аккаунт: ${name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`grid shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#9C6B4A,#6f4a34)] font-sans font-bold tracking-[0.06em] text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${
            isMobile ? "size-11 text-[13px]" : "size-[1.85rem] text-[10px]"
          }`}
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="flex min-w-0 flex-col text-left leading-[1.15]">
          <span
            className={`overflow-hidden text-ellipsis whitespace-nowrap ${
              isMobile
                ? "font-serif text-[1.35rem] font-medium tracking-[0.01em]"
                : "font-sans text-[12px] font-[650] tracking-[0.02em]"
            }`}
          >
            {isMobile ? name : customerFirstName(customer)}
          </span>
          <span
            className={`font-sans opacity-90 ${
              isMobile
                ? "mt-[0.15rem] text-[11px] font-medium tracking-[0.12em] text-ink/55"
                : "text-[9px] font-semibold tracking-[0.16em] text-clay uppercase"
            }`}
          >
            {isMobile ? (phone ?? "Личный кабинет") : "Аккаунт"}
          </span>
        </span>
        <span
          className={`ml-auto inline-flex text-clay opacity-75 transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <ChevronDown
            size={isMobile ? 18 : 16}
            strokeWidth={1.75}
            className="block shrink-0"
          />
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          className={`z-[70] animate-account-menu rounded-2xl border border-ink/10 bg-paper/[.98] p-[0.45rem] shadow-[0_18px_40px_rgba(33,30,25,0.14)] motion-reduce:animate-none ${
            isMobile
              ? "relative mt-[0.55rem] w-full"
              : "absolute top-[calc(100%+0.45rem)] right-0 w-[min(17.5rem,calc(100vw-1.5rem))]"
          }`}
          role="menu"
          aria-label="Меню аккаунта"
        >
          <div className="mb-1 flex flex-col gap-[0.15rem] border-b border-ink/[.08] px-[0.7rem] pt-[0.55rem] pb-[0.65rem]">
            <strong className="font-sans text-[0.92rem] leading-[1.25] font-[650] text-ink">
              {name}
            </strong>
            <span className="text-[0.78rem] text-ink/50">
              {phone ?? "Личный кабинет"}
            </span>
          </div>

          <button
            type="button"
            className={`${menuItemBase} ${menuItemDefault}`}
            role="menuitem"
            onClick={() => go("/profile")}
          >
            <UserRound
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="block shrink-0"
            />
            Профиль
          </button>
          <button
            type="button"
            className={`${menuItemBase} ${menuItemDefault}`}
            role="menuitem"
            onClick={() => go("/profile/orders")}
          >
            <Package
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="block shrink-0"
            />
            Мои заказы
          </button>
          <button
            type="button"
            className={`${menuItemBase} ${menuItemDefault}`}
            role="menuitem"
            onClick={() => go("/menu")}
          >
            <ShoppingBag
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="block shrink-0"
            />
            Меню
          </button>

          <div className="mx-[0.45rem] my-1 h-px bg-ink/[.08]" role="separator" />

          <button
            type="button"
            className={`${menuItemBase} ${menuItemDanger}`}
            role="menuitem"
            disabled={busy}
            onClick={() => void onLogout()}
          >
            <LogOut
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="block shrink-0"
            />
            {busy ? "Выход…" : "Выйти"}
          </button>
        </div>
      ) : null}
    </div>
  );
};
