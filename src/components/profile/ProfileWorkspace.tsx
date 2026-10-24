"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  Package,
  QrCode,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { logoutCustomerAction } from "@/actions/customer-auth";
import { resetCartToGuestMode } from "@/lib/cart-auth-sync";
import type { CustomerPublic } from "@/lib/customer-auth";
import {
  customerDisplayName,
  customerFirstName,
  customerInitials,
} from "@/lib/customer-display";
import { formatPhoneDisplay } from "@/lib/phone";

type ProfileWorkspaceProps = {
  customer: CustomerPublic;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: typeof UserRound;
  match: (path: string) => boolean;
};

export const ProfileWorkspace = ({
  customer,
  children,
}: ProfileWorkspaceProps) => {
  const pathname = usePathname() || "/profile";
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const displayName = customerDisplayName(customer);
  const firstName = customerFirstName(customer);
  const phoneDisplay = customer.phone
    ? formatPhoneDisplay(customer.phone)
    : null;

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [
      {
        href: "/profile",
        label: "Личные данные",
        hint: "Контакты и предпочтения",
        icon: UserRound,
        match: (path) => path === "/profile",
      },
    ];
    if (customer.isCourier) {
      items.push({
        href: "/profile/courier",
        label: "Доставка",
        hint: "Сканер QR и выдача",
        icon: QrCode,
        match: (path) => path.startsWith("/profile/courier"),
      });
    }
    items.push(
      {
        href: "/profile/orders",
        label: "Мои заказы",
        hint: "Статусы и история",
        icon: Package,
        match: (path) => path.startsWith("/profile/orders"),
      },
      {
        href: "/menu",
        label: "Меню кафе",
        hint: "Заказать снова",
        icon: ShoppingBag,
        match: () => false,
      },
    );
    return items;
  }, [customer.isCourier]);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    await logoutCustomerAction();
    resetCartToGuestMode();
    router.replace("/auth");
    router.refresh();
  };

  return (
    <div className="relative min-h-screen bg-[image:radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(156,107,74,0.1),transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(91,98,72,0.06),transparent_50%),linear-gradient(168deg,#fbf8f1_0%,#efe7d8_48%,#fbf8f1_100%)] text-ink">
      <div
        className="pointer-events-none absolute inset-0 bg-[image:radial-gradient(circle_at_90%_12%,rgba(156,107,74,0.07),transparent_30%),radial-gradient(circle_at_8%_90%,rgba(91,98,72,0.05),transparent_28%)]"
        aria-hidden="true"
      />
      <div className="relative z-[1] mx-auto grid min-h-screen max-w-[1180px] gap-4 p-4 min-[900px]:grid-cols-[280px_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-5 min-[900px]:px-6 min-[900px]:pt-6 min-[900px]:pb-8">
        <aside
          className="flex flex-col gap-4 rounded-[22px] bg-[image:linear-gradient(160deg,#211e19_0%,#2a221c_42%,#3d2c22_100%)] px-[1.05rem] pt-[1.15rem] pb-[1.2rem] text-paper shadow-[inset_0_1px_0_rgba(251,248,241,0.06),0_22px_50px_rgba(33,30,25,0.18)] min-[900px]:sticky min-[900px]:top-[5.5rem] min-[900px]:min-h-[calc(100vh-6.5rem)]"
          aria-label="Разделы аккаунта"
        >
          <div className="flex items-center gap-[0.85rem] border-b border-paper/10 px-[0.15rem] pt-[0.35rem] pb-[0.85rem]">
            <div
              className="grid size-[3.1rem] shrink-0 place-items-center rounded-full bg-[image:linear-gradient(145deg,#9c6b4a,#6f4a34)] font-sans text-[0.95rem] leading-none font-bold tracking-[0.06em] text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
              aria-hidden="true"
            >
              {customerInitials(customer)}
            </div>
            <div>
              <p className="text-[10px] tracking-[0.16em] text-paper/45 uppercase">
                {customer.isCourier ? "Кабинет курьера" : "Личный кабинет"}
              </p>
              <h1 className="mt-[0.2rem] font-serif text-[1.45rem] leading-[1.1] font-medium">
                {displayName}
              </h1>
              <p className="mt-1 text-[0.82rem] text-paper/55">
                {phoneDisplay ?? `Здравствуйте, ${firstName}`}
              </p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-[0.35rem] max-[560px]:grid max-[560px]:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-start gap-[0.7rem] rounded-[14px] border px-[0.8rem] py-3 no-underline transition-colors duration-180 ${
                    active
                      ? "border-clay/35 bg-clay/22 text-paper"
                      : "border-transparent text-paper/78 hover:bg-paper/6 hover:text-paper"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${
                      active
                        ? "bg-clay/35 text-paper"
                        : "bg-paper/8 text-[#d4a07a]"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon size={16} strokeWidth={1.85} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-[0.12rem]">
                    <strong className="font-sans text-[0.92rem] leading-[1.25] font-[650]">
                      {item.label}
                    </strong>
                    <em className="text-[0.75rem] text-paper/45 not-italic">
                      {item.hint}
                    </em>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-[0.65rem] border-t border-paper/10 pt-3">
            <button
              type="button"
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-[0.45rem] rounded-full border border-paper/14 bg-transparent font-sans text-[12px] leading-none font-[650] tracking-[0.08em] text-paper/82 uppercase transition-colors duration-180 hover:enabled:bg-danger/18 hover:enabled:text-[#f7d4ce] disabled:cursor-wait disabled:opacity-55"
              disabled={busy}
              onClick={() => void onLogout()}
            >
              <LogOut size={16} strokeWidth={1.85} aria-hidden="true" />
              {busy ? "Выход…" : "Выйти из аккаунта"}
            </button>
            <p className="text-center text-[0.72rem] tracking-[0.06em] text-paper/35">
              Денисов · Московский пр., 71/3
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="animate-profile-in motion-reduce:animate-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
