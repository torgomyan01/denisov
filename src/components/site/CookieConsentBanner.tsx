"use client";

import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "denisov_cookie_consent";

const isAccepted = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const accept = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
};

/**
 * One-time cookie notice for all public pages.
 * Accept or close — both dismiss and remember the choice.
 */
export const CookieConsentBanner = () => {
  const pathname = usePathname() || "/";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      setVisible(false);
      return;
    }
    setVisible(!isAccepted());
  }, [pathname]);

  if (!visible) return null;

  const dismiss = () => {
    accept();
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление о cookies"
    >
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 rounded-[18px] border border-ink/10 bg-paper/96 px-4 py-3.5 shadow-[0_18px_48px_rgba(33,30,25,0.16)] backdrop-blur-[12px] sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-clay/12 text-clay sm:grid">
          <Cookie size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-[0.9rem] leading-[1.4] text-ink/78">
          Мы используем файлы{" "}
          <span className="font-[650] text-ink">cookie</span>, чтобы сайт
          работал стабильно: вход в аккаунт, корзина и настройки. Подробнее — в{" "}
          <Link
            href="/privacy"
            className="font-[650] text-clay underline-offset-2 hover:underline"
          >
            политике конфиденциальности
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-full border-0 bg-clay px-[1.15rem] font-sans text-[11px] font-[650] tracking-[0.1em] text-paper uppercase transition-colors duration-180 hover:bg-ink sm:flex-none"
            onClick={dismiss}
          >
            Понятно
          </button>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/12 bg-white/80 text-ink/55 transition-colors duration-180 hover:border-ink/25 hover:text-ink"
            aria-label="Закрыть"
            onClick={dismiss}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
