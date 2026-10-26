"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { CustomerPublic } from "@/lib/customer-auth";
import type { SiteData } from "@/types/site";
import { brandLabelOrDefault, resolveHeaderLogo } from "@/lib/format";
import { AccountNav } from "@/components/site/AccountNav";
import { PushPromptBanner } from "@/components/site/PushPromptBanner";
import { SiteMobileMenu } from "@/components/site/SiteMobileMenu";
import { underlineLink } from "@/components/site/styles";

interface SiteHeaderProps {
  site: SiteData;
  customer: CustomerPublic | null;
  /** When false, header is static (e.g. inside a parent sticky stack). Default true. */
  sticky?: boolean;
}

export const SiteHeader = ({
  site,
  customer,
  sticky = true,
}: SiteHeaderProps) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";
  const panelId = useId();
  const { logo, text, mode } = resolveHeaderLogo(site);
  const a11y = brandLabelOrDefault(site);
  const showBrand = mode !== "hidden" && Boolean(logo || text);
  const onMenu = pathname === "/menu" || pathname.startsWith("/menu/");

  const menuLinkClass = onMenu
    ? "rounded-full border border-transparent bg-ink px-4 py-2 text-paper transition hover:bg-clay"
    : "rounded-full border border-ink/20 px-4 py-2 text-ink transition hover:border-clay hover:text-clay";

  const close = () => setOpen(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`${sticky ? "sticky top-0" : "relative"} ${open ? "z-[90]" : "z-50"} border-b border-ink/10 bg-paper/90 backdrop-blur`}
      role="banner"
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center text-ink no-underline"
          aria-label={`${a11y} — на главную`}
        >
          {showBrand && logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={a11y}
              className="block h-9 w-auto max-w-[200px] object-contain md:h-11 md:max-w-[240px]"
            />
          ) : showBrand && text ? (
            <span className="font-serif text-2xl tracking-[0.35em] md:text-3xl">
              {text}
            </span>
          ) : (
            <span className="font-sans text-[11px] uppercase tracking-[0.26em] text-ink/45">
              На главную
            </span>
          )}
        </Link>

        <nav
          className="hidden items-center gap-8 font-sans text-[12px] uppercase tracking-[0.26em] text-ink/70 md:flex"
          aria-label="Основная навигация"
        >
          <Link href="/#about" className={underlineLink}>
            О кафе
          </Link>
          <Link href="/#visit" className={underlineLink}>
            Контакты
          </Link>
          <a
            href={site.hero.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={underlineLink}
          >
            {site.hero.telegramButtonLabel}
          </a>
          <AccountNav customer={customer} variant="desktop" />
          <Link href="/menu" className={menuLinkClass}>
            {site.hero.menuButtonLabel}
          </Link>
        </nav>

        <button
          type="button"
          className={`relative grid size-11 place-items-center rounded-full border text-ink transition-[border-color,background-color,color] duration-300 md:hidden ${
            open
              ? "border-ink/20 bg-ink text-paper"
              : "border-ink/12 bg-paper/80 hover:border-clay/40 hover:bg-sand/80"
          }`}
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block size-[1.15rem]" aria-hidden="true">
            <span
              className={`absolute top-[3px] left-0 h-[1.5px] w-full origin-center rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                open ? "translate-y-[6.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute top-[9.5px] left-0 h-[1.5px] w-full rounded-full bg-current transition-[opacity,transform] duration-[250ms] ease-out motion-reduce:transition-none ${
                open ? "scale-x-0 opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute top-[16px] left-0 h-[1.5px] w-full origin-center rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                open ? "-translate-y-[6.5px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      <SiteMobileMenu
        open={open}
        onClose={close}
        site={site}
        customer={customer}
        brand={a11y}
        panelId={panelId}
      />

      <PushPromptBanner enabled={Boolean(customer)} />
    </header>
  );
};
