"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { SiteData } from "@/types/site";
import { brandLabel, formatPrice } from "@/lib/format";

interface MenuPageProps {
  site: SiteData;
}

const slugify = (name: string, i: number): string => {
  const base = String(name || `cat-${i}`)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `cat-${i}-${base || "section"}`;
};

export const MenuPageView = ({ site }: MenuPageProps) => {
  const brand = brandLabel(site);
  const menu = site.menu;
  const categories = (menu.categories || []).filter(
    (c) => c && (c.name || (c.items && c.items.length)),
  );

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    document.querySelectorAll(".mp-cat.reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [categories.length]);

  return (
    <div className="menu-page font-sans text-ink antialiased">
      <header className="mp-top" role="banner">
        <div className="mp-top-inner">
          <Link href="/" className="mp-back">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span>На главную</span>
          </Link>
          <Link href="/" className="mp-brand font-serif">
            {brand}
          </Link>
          <span className="mp-top-spacer" aria-hidden="true" />
        </div>
      </header>

      <main id="main" className="mp-main">
        <div className="mp-hero">
          <p className="mp-eyebrow">Кафе · Пекарня</p>
          <h1 className="mp-title">{menu.title || "Меню"}</h1>
          <div className="hairline mx-auto mt-6 max-w-[120px]" aria-hidden="true" />
        </div>

        <div className="mp-content">
          {!categories.length ? (
            <p className="mp-empty">Меню скоро появится</p>
          ) : (
            categories.map((category, i) => {
              const items = (category.items || []).filter(
                (it) => it && (it.name || it.price),
              );
              return (
                <section
                  key={slugify(category.name, i)}
                  className="mp-cat reveal"
                  id={slugify(category.name, i)}
                >
                  <header className="mp-cat-head">
                    <p className="mp-cat-label">Категория</p>
                    <h2 className="mp-cat-title">
                      {category.name || `Раздел ${i + 1}`}
                    </h2>
                  </header>
                  <div className="mp-cat-list">
                    {!items.length ? (
                      <p className="mp-empty">Позиции пока не добавлены</p>
                    ) : (
                      items.map((item, ii) => (
                        <article key={`${item.name}-${ii}`} className="mp-item">
                          <div className="mp-item-top">
                            <h3 className="mp-item-name">{item.name}</h3>
                            <span className="mp-item-dots" aria-hidden="true" />
                            <p className="mp-item-price">{formatPrice(item.price)}</p>
                          </div>
                          {item.description ? (
                            <p className="mp-item-desc">{item.description}</p>
                          ) : null}
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {menu.note ? <p className="mp-note">{menu.note}</p> : null}
      </main>

      <footer className="mp-foot" role="contentinfo">
        <Link href="/" className="mp-foot-brand font-serif">
          {brand}
        </Link>
        <Link
          href="/#visit"
          className="u text-[11px] uppercase tracking-[0.26em] text-ink/45 hover:text-clay"
        >
          Контакты
        </Link>
      </footer>
    </div>
  );
};
