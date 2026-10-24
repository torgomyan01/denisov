"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { logoutCustomerAction } from "@/actions/customer-auth";
import { resetCartToGuestMode } from "@/lib/cart-auth-sync";
import type { CustomerPublic } from "@/lib/customer-auth";
import { customerFirstName } from "@/lib/customer-display";
import type { SiteData } from "@/types/site";

type SiteMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  site: SiteData;
  customer: CustomerPublic | null;
  brand: string;
  panelId: string;
};

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const CLOSE_MS = 320;

export const SiteMobileMenu = ({
  open,
  onClose,
  site,
  customer,
  brand,
  panelId,
}: SiteMobileMenuProps) => {
  const router = useRouter();
  const [portalReady, setPortalReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const scrollYRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(id);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, CLOSE_MS);

    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    scrollYRef.current = window.scrollY;

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open]);

  if (!portalReady || !mounted) return null;

  const items: NavItem[] = [
    { href: "/#about", label: "О кафе" },
    { href: "/#visit", label: "Контакты" },
    {
      href: site.hero.telegramUrl,
      label: site.hero.telegramButtonLabel || "Telegram",
      external: true,
    },
  ];

  const onLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await logoutCustomerAction();
      resetCartToGuestMode();
      onClose();
      router.replace("/auth");
      router.refresh();
    } finally {
      setLogoutBusy(false);
    }
  };

  return createPortal(
    <div
      id={panelId}
      className="fixed inset-0 z-[80] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Мобильное меню"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`absolute inset-0 border-0 bg-ink/45 transition-opacity ease-out motion-reduce:transition-none ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${CLOSE_MS}ms` }}
        aria-label="Закрыть меню"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />

      <div
        className={`absolute inset-y-0 right-0 flex w-[min(100%,26.5rem)] flex-col overflow-y-auto overscroll-contain border-l border-ink/10 bg-paper shadow-[-28px_0_70px_rgba(33,30,25,0.22)] transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionDuration: `${CLOSE_MS}ms` }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_-10%,rgba(156,107,74,0.14),transparent_55%),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(91,98,72,0.08),transparent_50%),linear-gradient(165deg,#fbf8f1_0%,#efe7d8_52%,#f7f2e8_100%)]"
          aria-hidden="true"
        />

        <div className="relative flex min-h-full flex-col px-7 pt-6 pb-8">
          <div className="mb-10 flex items-start justify-between gap-4">
            <div>
              <p className="font-sans text-[10px] tracking-[0.36em] text-clay uppercase">
                Кафе · Петербург
              </p>
              <p className="mt-2 font-serif text-[1.75rem] leading-none tracking-[0.28em] text-ink">
                {brand}
              </p>
            </div>
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-ink/15 bg-paper/70 text-ink transition-[border-color,background-color] duration-200 hover:border-clay/45 hover:bg-sand"
              aria-label="Закрыть меню"
              tabIndex={visible ? 0 : -1}
              onClick={onClose}
            >
              <span className="relative block size-4" aria-hidden="true">
                <span className="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 rotate-45 rounded-full bg-current" />
                <span className="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>

          <nav className="flex flex-col" aria-label="Мобильная навигация">
            {items.map((item, index) => {
              const className =
                "group flex items-baseline gap-4 border-b border-ink/[.08] py-[1.05rem] text-ink no-underline";
              const inner = (
                <>
                  <span className="w-7 shrink-0 font-sans text-[11px] tracking-[0.18em] text-clay/80 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-[clamp(2rem,8vw,2.55rem)] leading-[1.05] tracking-[0.01em] transition-colors duration-200 group-hover:text-clay">
                    {item.label}
                  </span>
                </>
              );
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    tabIndex={visible ? 0 : -1}
                    onClick={onClose}
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={className}
                  tabIndex={visible ? 0 : -1}
                  onClick={onClose}
                >
                  {inner}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8">
            <Link
              href="/menu"
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-ink px-6 font-sans text-[12px] uppercase tracking-[0.28em] text-paper no-underline transition-[background-color,transform] duration-250 hover:bg-clay active:scale-[0.98]"
              tabIndex={visible ? 0 : -1}
              onClick={onClose}
            >
              {site.hero.menuButtonLabel || "Меню"}
            </Link>
          </div>

          <div className="mt-8 border-t border-ink/10 pt-6">
            {customer ? (
              <div className="flex flex-col gap-3">
                <p className="font-sans text-[10px] tracking-[0.22em] text-ink/40 uppercase">
                  Здравствуйте, {customerFirstName(customer)}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 font-sans text-[13px] tracking-[0.08em] uppercase">
                  <Link
                    href="/profile"
                    className="text-ink/70 no-underline transition-colors hover:text-clay"
                    tabIndex={visible ? 0 : -1}
                    onClick={onClose}
                  >
                    Профиль
                  </Link>
                  <Link
                    href="/profile/orders"
                    className="text-ink/70 no-underline transition-colors hover:text-clay"
                    tabIndex={visible ? 0 : -1}
                    onClick={onClose}
                  >
                    Заказы
                  </Link>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] tracking-[0.08em] text-danger/90 uppercase transition-colors hover:text-danger disabled:opacity-55"
                    disabled={logoutBusy}
                    tabIndex={visible ? 0 : -1}
                    onClick={() => void onLogout()}
                  >
                    {logoutBusy ? "Выход…" : "Выйти"}
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 font-sans text-[13px] tracking-[0.16em] text-ink/70 uppercase no-underline transition-colors hover:text-clay"
                tabIndex={visible ? 0 : -1}
                onClick={onClose}
              >
                Войти в аккаунт
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div className="mt-auto pt-12">
            <p className="font-sans text-[11px] leading-relaxed tracking-[0.06em] text-ink/45">
              {site.contacts.address || "Московский пр., 71/3"}
            </p>
            {site.contacts.hours ? (
              <p className="mt-1 font-sans text-[11px] tracking-[0.06em] text-ink/35">
                {site.contacts.hours}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
