"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteData } from "@/types/site";
import { brandLabel } from "@/lib/format";

interface SiteHeaderProps {
  site: SiteData;
}

export const SiteHeader = ({ site }: SiteHeaderProps) => {
  const [open, setOpen] = useState(false);
  const brand = brandLabel(site);

  return (
    <header
      className="sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur"
      role="banner"
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="#top"
          className="site-logo shrink-0 font-serif text-2xl tracking-[0.35em] md:text-3xl"
          aria-label={`${brand} — на главную`}
        >
          {brand}
        </Link>

        <nav
          className="hidden items-center gap-8 font-sans text-[12px] uppercase tracking-[0.26em] text-ink/70 md:flex"
          aria-label="Основная навигация"
        >
          <a href="#about" className="u">
            О кафе
          </a>
          <a href="#visit" className="u">
            Контакты
          </a>
          <a
            href={site.hero.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="u"
          >
            {site.hero.telegramButtonLabel}
          </a>
          <Link
            href="/menu"
            className="rounded-full border border-ink/20 px-4 py-2 text-ink transition hover:border-clay hover:text-clay"
          >
            {site.hero.menuButtonLabel}
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden"
          aria-label="Открыть меню"
          aria-expanded={open}
          aria-controls="mNav"
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden="true"
          >
            <line x1="3" y1="8" x2="21" y2="8" />
            <line x1="3" y1="16" x2="21" y2="16" />
          </svg>
        </button>
      </div>

      <nav
        id="mNav"
        className={`${open ? "flex" : "hidden"} flex-col gap-4 border-t border-ink/10 px-6 py-6 font-serif text-2xl md:!hidden`}
        aria-label="Мобильная навигация"
      >
        <a href="#about" onClick={() => setOpen(false)}>
          О кафе
        </a>
        <a href="#visit" onClick={() => setOpen(false)}>
          Контакты
        </a>
        <a
          href={site.hero.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
        >
          {site.hero.telegramButtonLabel}
        </a>
        <Link href="/menu" onClick={() => setOpen(false)}>
          {site.hero.menuButtonLabel}
        </Link>
      </nav>
    </header>
  );
};
