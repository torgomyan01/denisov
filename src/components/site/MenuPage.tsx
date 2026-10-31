"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CompanyRequisites } from "@/components/site/CompanyRequisites";
import { menuCardDelay, revealMenu } from "@/components/site/styles";
import {
  categoryUnavailableMessage,
  isCategoryAvailableNow,
} from "@/lib/delivery-availability";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import type { CustomerPublic } from "@/lib/customer-auth";
import {
  brandLabel,
  brandLabelOrDefault,
  formatPrice,
} from "@/lib/format";
import { isBlyudaCategory } from "@/lib/home-menu-featured";
import { menuItemSlug } from "@/lib/menu-slug";
import { SiteLegalLinks } from "@/components/site/SiteLegalLinks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addToCartQuiet,
  decrementQty,
  incrementQty,
} from "@/store/cartSlice";
import type { MenuCategory, MenuItem, SiteData } from "@/types/site";

const navChipBase =
  "shrink-0 grow-0 rounded-full border px-[1.05rem] py-[0.58rem] text-[11px] tracking-[0.12em] whitespace-nowrap uppercase no-underline transition-[background-color,color,border-color] duration-200 motion-reduce:transition-none";

const navChipClass = (active: boolean, stuck: boolean): string => {
  if (active) return `${navChipBase} border-ink bg-ink text-paper`;
  return stuck
    ? `${navChipBase} border-ink/12 bg-white/45 text-ink/[.62] hover:text-clay`
    : `${navChipBase} border-ink/10 bg-paper/55 text-ink/[.62] hover:border-clay/35 hover:bg-paper/90 hover:text-clay`;
};

const navStuckBg =
  "[background:linear-gradient(180deg,rgba(239,231,216,.42)_0%,transparent_85%),linear-gradient(135deg,rgba(251,248,241,.97)_0%,rgba(244,237,225,.97)_48%,rgba(251,248,241,.97)_100%)]";

interface MenuPageProps {
  site: SiteData;
  customer: CustomerPublic | null;
}

const slugify = (name: string, i: number): string => {
  const base = String(name || `cat-${i}`)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `cat-${i}-${base || "section"}`;
};

export const MenuPageView = ({ site, customer }: MenuPageProps) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((s) => s.cart.items);
  const qtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cartItems) map.set(line.id, line.qty);
    return map;
  }, [cartItems]);

  const footerBrand = brandLabel(site);
  const a11y = brandLabelOrDefault(site);
  const menu = site.menu;
  const ordersEnabled =
    (site.delivery ?? createDefaultDeliverySettings()).ordersEnabled !== false;

  const categories = useMemo(
    () =>
      (menu.categories || []).filter(
        (c) =>
          c &&
          (c.name || (c.items && c.items.length)) &&
          !isBlyudaCategory(c.name || ""),
      ),
    [menu.categories],
  );

  const [navStuck, setNavStuck] = useState(false);
  const navSentinelRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const chipScrollRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const sectionIds = useMemo(
    () => categories.map((c, i) => slugify(c.name, i)),
    [categories],
  );
  const [activeCat, setActiveCat] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    if (sectionIds[0] && !sectionIds.includes(activeCat)) {
      setActiveCat(sectionIds[0]);
    }
  }, [sectionIds, activeCat]);

  useEffect(() => {
    const scroller = chipScrollRef.current;
    const chip = chipRefs.current.get(activeCat);
    if (!scroller || !chip) return;
    if (scroller.scrollWidth <= scroller.clientWidth + 2) return;
    const left =
      chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2;
    scroller.scrollTo({
      left: Math.max(0, left),
      behavior: "smooth",
    });
  }, [activeCat]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    document
      .querySelectorAll("[data-mp-reveal]")
      .forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [categories.length]);

  useEffect(() => {
    if (!sectionIds.length) return;

    const resolveActive = () => {
      const stickyOffset = (topRef.current?.offsetHeight ?? 120) + 12;

      let current = sectionIds[0] ?? "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - stickyOffset <= 0) {
          current = id;
        }
      }

      const doc = document.documentElement;
      const nearBottom =
        window.innerHeight + window.scrollY >= doc.scrollHeight - 48;
      if (nearBottom && sectionIds.length) {
        current = sectionIds[sectionIds.length - 1] ?? current;
      }

      setActiveCat((prev) => (prev === current ? prev : current));
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        resolveActive();
        ticking = false;
      });
    };

    resolveActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sectionIds]);

  useEffect(() => {
    const sentinel = navSentinelRef.current;
    if (!sentinel || categories.length <= 1) {
      setNavStuck(false);
      return;
    }
    const syncMargin = () => {
      const h = topRef.current?.offsetHeight ?? 120;
      return `-${h}px 0px 0px 0px`;
    };
    let io = new IntersectionObserver(
      ([entry]) => {
        setNavStuck(!entry?.isIntersecting);
      },
      { rootMargin: syncMargin(), threshold: [0, 1] },
    );
    io.observe(sentinel);
    const onResize = () => {
      io.disconnect();
      io = new IntersectionObserver(
        ([entry]) => {
          setNavStuck(!entry?.isIntersecting);
        },
        { rootMargin: syncMargin(), threshold: [0, 1] },
      );
      io.observe(sentinel);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      io.disconnect();
    };
  }, [categories.length]);

  const toCartProduct = (item: MenuItem, category: MenuCategory) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    image: item.image || "",
    categoryId: category.id,
    categoryName: category.name || "",
  });

  const addOne = (item: MenuItem, category: MenuCategory) => {
    if (!ordersEnabled || item.inStock === false) return;
    if (item.showInDelivery === false) return;
    if (!isCategoryAvailableNow(category)) return;
    dispatch(addToCartQuiet(toCartProduct(item, category)));
  };

  return (
    <div className="relative isolate min-h-screen overflow-x-clip font-sans text-ink antialiased [background:linear-gradient(180deg,rgba(239,231,216,.55)_0%,transparent_28%),linear-gradient(135deg,#FBF8F1_0%,#F4EDE1_48%,#FBF8F1_100%)]">
      <div
        className="pointer-events-none absolute inset-0 z-[-1] [background:radial-gradient(ellipse_55%_35%_at_8%_12%,rgba(156,107,74,.1),transparent_60%),radial-gradient(ellipse_45%_30%_at_92%_18%,rgba(91,98,72,.08),transparent_55%),radial-gradient(ellipse_40%_25%_at_50%_100%,rgba(156,107,74,.06),transparent_50%)]"
        aria-hidden="true"
      />

      <div
        ref={topRef}
        className="sticky top-0 z-50 bg-paper/90 backdrop-blur-[14px]"
      >
        <SiteHeader site={site} customer={customer} sticky={false} />
        {categories.length > 1 ? (
          <nav
            className={`w-full max-w-full border-b py-[0.55rem] transition-[background,border-color,box-shadow] duration-[280ms] motion-reduce:transition-none ${
              navStuck
                ? `border-b-ink/[.08] shadow-[0_12px_30px_rgba(33,30,25,.05)] ${navStuckBg}`
                : "border-b-ink/10 bg-transparent"
            }`}
            aria-label="Разделы меню"
          >
            <div
              ref={chipScrollRef}
              className="mx-auto flex max-w-[1120px] gap-x-[0.6rem] px-[1.35rem] pt-1 pb-[0.45rem] max-md:snap-x max-md:snap-mandatory max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:overscroll-x-contain max-md:scroll-px-5 max-md:[scrollbar-width:none] max-md:[-ms-overflow-style:none] max-md:[&::-webkit-scrollbar]:hidden max-md:[mask-image:linear-gradient(90deg,transparent,black_1rem,black_calc(100%-1rem),transparent)] md:flex-wrap md:justify-center md:gap-x-[0.7rem] md:gap-y-[0.55rem] md:px-9"
            >
              {categories.map((category, i) => {
                const id = slugify(category.name, i);
                return (
                  <a
                    key={id}
                    ref={(node) => {
                      if (node) chipRefs.current.set(id, node);
                      else chipRefs.current.delete(id);
                    }}
                    href={`#${id}`}
                    className={`${navChipClass(activeCat === id, navStuck)} max-md:snap-start`}
                    aria-current={activeCat === id ? "true" : undefined}
                    onClick={() => setActiveCat(id)}
                  >
                    {category.name || `Раздел ${i + 1}`}
                  </a>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>

      <main id="main">
        <div
          ref={navSentinelRef}
          className="pointer-events-none h-px w-full"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1120px] px-5 pt-8 pb-4 md:px-8 md:pt-11">
          <section className="mb-7 animate-mp-hero text-center motion-reduce:animate-none">
            <p className="text-[10px] tracking-[0.34em] text-clay uppercase">
              Кафе · Санкт-Петербург
            </p>
            <p className="mt-[0.85rem] font-serif text-[clamp(2.4rem,7vw,3.6rem)] leading-[0.95] tracking-[0.28em] text-ink">
              {a11y}
            </p>
            <h1 className="mt-[0.55rem] font-serif text-[clamp(1.55rem,3.8vw,2.1rem)] font-medium tracking-[0.04em] text-ink/[.72] italic">
              {menu.title || "Меню"}
            </h1>
            <p className="mx-auto mt-4 max-w-[34rem] text-[0.98rem] leading-[1.55] text-ink/[.52]">
              Выберите блюда и оформите заказ — самовывоз или доставка.
            </p>
          </section>
        </div>

        {!ordersEnabled ? (
          <p className="mx-auto mb-4 max-w-[1120px] rounded-[14px] border border-clay/30 bg-clay/10 px-4 py-3 text-center text-[0.92rem] text-ink">
            Приём заказов временно приостановлен. Меню можно смотреть — оформить
            заказ пока нельзя.
          </p>
        ) : null}

        <div className="mx-auto max-w-[1120px] px-5 pt-4 pb-[6.5rem] md:px-8 md:pb-[5.5rem]">
          <div className="flex flex-col gap-11">
            {!categories.length ? (
              <p className="px-4 py-10 text-center font-serif text-ink/45 italic">
                Меню скоро появится
              </p>
            ) : (
              categories.map((category, i) => {
                const items = (category.items || []).filter(
                  (it) => it && (it.name || it.price),
                );
                const sectionId = slugify(category.name, i);
                const available = isCategoryAvailableNow(category);
                return (
                  <section
                    key={sectionId}
                    data-mp-reveal
                    className={`scroll-mt-[9.5rem] ${revealMenu}`}
                    id={sectionId}
                  >
                    <header className="mb-5 grid grid-cols-[auto_1fr_auto] items-end gap-x-4 gap-y-[0.85rem]">
                      <div
                        className="h-[2.6rem] w-0.5 rounded-full bg-[linear-gradient(180deg,#9C6B4A,rgba(156,107,74,.15))]"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="mb-[0.3rem] text-[10px] tracking-[0.28em] text-clay uppercase">
                          Категория
                          {category.availableFrom && category.availableTo
                            ? ` · ${category.availableFrom}–${category.availableTo}`
                            : ""}
                        </p>
                        <h2 className="font-serif text-[clamp(1.7rem,4vw,2.25rem)] leading-[1.05] tracking-[0.03em] text-ink">
                          {category.name || `Раздел ${i + 1}`}
                        </h2>
                      </div>
                      <p className="mb-[0.2rem] text-[10px] tracking-[0.16em] text-ink/40 uppercase">
                        {items.length
                          ? `${items.length} ${items.length === 1 ? "позиция" : items.length < 5 ? "позиции" : "позиций"}`
                          : "Пусто"}
                      </p>
                    </header>

                    {!items.length ? (
                      <p className="px-4 py-10 text-center font-serif text-ink/45 italic">
                        Позиции пока не добавлены
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:gap-[1.15rem] min-[980px]:grid-cols-3 min-[980px]:gap-5">
                        {items.map((item, ii) => {
                          const qty = qtyById.get(item.id) ?? 0;
                          const soldOut = item.inStock === false;
                          const notDeliverable = item.showInDelivery === false;
                          const canAdd =
                            ordersEnabled &&
                            available &&
                            !soldOut &&
                            !notDeliverable;
                          const href = `/menu/${menuItemSlug(item)}`;
                          return (
                            <article
                              key={item.id || `${item.name}-${ii}`}
                              data-mp-reveal
                              className={`group/card flex min-h-full flex-col overflow-hidden rounded-[22px] border border-ink/[.07] bg-white/[.58] shadow-[0_10px_28px_rgba(33,30,25,.04)] hover:border-clay/[.22] hover:shadow-[0_18px_40px_rgba(33,30,25,.08)] ${revealMenu} ${menuCardDelay[ii % 4]} ${
                                soldOut
                                  ? "opacity-55 grayscale"
                                  : ""
                              }`}
                            >
                              <Link
                                href={href}
                                className="relative aspect-[4/3] w-full overflow-hidden bg-[linear-gradient(145deg,rgba(239,231,216,.9),rgba(251,248,241,.98))] no-underline"
                                aria-label={item.name || "Блюдо"}
                              >
                                {item.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.image}
                                    alt={item.name || ""}
                                    loading="lazy"
                                    className="block h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover/card:scale-[1.045] motion-reduce:transition-none"
                                  />
                                ) : (
                                  <span className="grid size-full place-items-center text-[11px] tracking-[0.18em] text-ink/[.38] uppercase">
                                    Нет фото
                                  </span>
                                )}
                                {soldOut ? (
                                  <span className="absolute top-2 left-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] tracking-[0.1em] text-paper uppercase">
                                    Закончилось
                                  </span>
                                ) : notDeliverable ? (
                                  <span className="absolute top-2 left-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] tracking-[0.1em] text-paper uppercase">
                                    Только в кафе
                                  </span>
                                ) : null}
                              </Link>

                              <div className="flex flex-1 flex-col gap-[0.35rem] px-[0.7rem] pt-[0.7rem] pb-[0.85rem] sm:gap-[0.45rem] sm:px-[1.05rem] sm:pt-4 sm:pb-[1.15rem]">
                                <Link
                                  href={href}
                                  className="flex w-full items-baseline justify-between gap-[0.45rem] no-underline"
                                >
                                  <h3 className="line-clamp-2 font-serif text-[1.05rem] leading-[1.15] text-ink sm:text-[1.28rem]">
                                    {item.name}
                                  </h3>
                                  <p className="shrink-0 grow-0 font-serif text-base whitespace-nowrap text-clay sm:text-[1.18rem]">
                                    {formatPrice(item.price)}
                                  </p>
                                </Link>
                                {item.description ? (
                                  <p className="line-clamp-2 text-[0.78rem] leading-[1.4] text-ink/50 italic sm:line-clamp-3 sm:text-[0.9rem] sm:leading-[1.45]">
                                    {item.description}
                                  </p>
                                ) : null}
                                {item.weight ? (
                                  <p className="text-[0.75rem] text-ink/42">
                                    {item.weight}
                                  </p>
                                ) : null}

                                {soldOut ? (
                                  <p className="mt-auto pt-2 text-center text-[11px] tracking-[0.1em] text-ink/45 uppercase">
                                    Закончилось
                                  </p>
                                ) : notDeliverable ? (
                                  <p className="mt-auto pt-2 text-center text-[11px] tracking-[0.1em] text-ink/45 uppercase">
                                    Не доставляется
                                  </p>
                                ) : !canAdd && !available ? (
                                  <p className="mt-auto pt-2 text-center text-[11px] text-ink/50">
                                    {categoryUnavailableMessage(category)}
                                  </p>
                                ) : qty > 0 ? (
                                  <div className="mt-auto inline-flex w-full items-center justify-between rounded-full border border-ink/10 bg-paper/80 p-[0.15rem]">
                                    <button
                                      type="button"
                                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5"
                                      aria-label="Убрать"
                                      onClick={() =>
                                        dispatch(decrementQty(item.id))
                                      }
                                    >
                                      <Minus size={15} strokeWidth={2} />
                                    </button>
                                    <span className="text-[0.95rem] font-[650]">
                                      {qty}
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-40"
                                      aria-label="Добавить"
                                      disabled={!canAdd}
                                      onClick={() =>
                                        dispatch(incrementQty(item.id))
                                      }
                                    >
                                      <Plus size={15} strokeWidth={2} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="mt-auto min-h-[34px] w-full cursor-pointer rounded-full border border-clay/40 bg-transparent font-sans text-[10px] leading-none font-bold tracking-[0.12em] text-clay uppercase transition-[background-color,color,border-color] duration-200 hover:border-transparent hover:bg-clay hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[38px] sm:text-[11px] motion-reduce:transition-none"
                                    disabled={!canAdd}
                                    onClick={() => addOne(item, category)}
                                  >
                                    В корзину
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>

          {menu.note ? (
            <p className="mt-11 text-center text-[10px] tracking-[0.18em] text-ink/40 uppercase">
              {menu.note}
            </p>
          ) : null}
        </div>
      </main>

      <footer role="contentinfo">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 border-t border-ink/[.08] px-5 pt-6 pb-6 md:px-8">
          <Link
            href="/"
            className="font-serif text-[1.15rem] tracking-[0.3em] text-ink no-underline"
            aria-label={a11y}
          >
            {footerBrand || a11y}
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] tracking-[0.08em] text-ink/45">
            <Link
              href="/#visit"
              className="uppercase tracking-[0.26em] no-underline transition-colors duration-200 hover:text-clay"
            >
              Контакты
            </Link>
            <SiteLegalLinks className="normal-case tracking-normal" />
          </div>
        </div>
        <CompanyRequisites />
      </footer>

    </div>
  );
};
