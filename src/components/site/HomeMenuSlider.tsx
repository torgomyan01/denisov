"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeFeaturedDish } from "@/lib/home-menu-featured";
import { isCategoryAvailableNow } from "@/lib/delivery-availability";
import { formatPrice } from "@/lib/format";
import { menuItemSlug } from "@/lib/menu-slug";
import { useAppDispatch } from "@/store/hooks";
import { addToCartQuiet } from "@/store/cartSlice";

type HomeMenuSliderProps = {
  items: HomeFeaturedDish[];
  ordersEnabled?: boolean;
};

const navBtn =
  "absolute top-[42%] z-[2] flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-ink/12 bg-paper/95 text-ink shadow-[0_10px_28px_rgba(33,30,25,.1)] transition-[background-color,border-color,color,transform] duration-200 hover:border-transparent hover:bg-clay hover:text-paper disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none";

export const HomeMenuSlider = ({
  items,
  ordersEnabled = true,
}: HomeMenuSliderProps) => {
  const dispatch = useAppDispatch();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const syncNav = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < max - 8);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncNav();
    el.addEventListener("scroll", syncNav, { passive: true });
    window.addEventListener("resize", syncNav);
    return () => {
      el.removeEventListener("scroll", syncNav);
      window.removeEventListener("resize", syncNav);
    };
  }, [syncNav, items.length]);

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-home-dish]");
    const gap = 20;
    const step = (card?.offsetWidth ?? 280) + gap;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const addOne = (item: HomeFeaturedDish) => {
    if (!ordersEnabled || item.inStock === false) return;
    if (item.showInDelivery === false) return;
    if (
      !isCategoryAvailableNow({
        availableFrom: item.availableFrom,
        availableTo: item.availableTo,
      })
    ) {
      return;
    }
    dispatch(
      addToCartQuiet({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || "",
        categoryId: item.categoryId,
        categoryName: item.categoryName,
      }),
    );
  };

  if (!items.length) return null;

  return (
    <section
      className="relative mt-16 md:mt-24"
      aria-label="Блюда из меню"
    >
      <div className="mb-7 flex items-end justify-between gap-4 md:mb-9">
        <div>
          <p className="font-sans text-[10px] tracking-[0.34em] text-clay uppercase">
            Из меню
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.75rem,4vw,2.35rem)] leading-[1.1] tracking-[0.02em] text-ink">
            Блюда, которые стоит попробовать
          </h2>
        </div>
        <Link
          href="/menu"
          className="hidden shrink-0 font-sans text-[11px] tracking-[0.22em] text-ink/50 uppercase no-underline transition-colors hover:text-clay sm:inline-flex"
        >
          Всё меню →
        </Link>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:gap-5"
        >
          {items.map((item) => {
            const href = `/menu/${menuItemSlug(item)}`;
            const canAdd =
              ordersEnabled &&
              item.inStock !== false &&
              item.showInDelivery !== false &&
              isCategoryAvailableNow({
                availableFrom: item.availableFrom,
                availableTo: item.availableTo,
              });

            return (
              <article
                key={item.id}
                data-home-dish
                className="group/card relative flex w-[min(78vw,19.5rem)] shrink-0 snap-start flex-col overflow-hidden rounded-[22px] border border-ink/[.07] bg-white/55 shadow-[0_12px_32px_rgba(33,30,25,.05)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-clay/25 hover:shadow-[0_22px_48px_rgba(33,30,25,.1)] motion-reduce:transition-none sm:w-[17.5rem] md:w-[18.75rem]"
              >
                <Link
                  href={href}
                  className="relative block aspect-[4/5] overflow-hidden bg-[linear-gradient(145deg,#efe7d8,#fbf8f1)] no-underline"
                  aria-label={item.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover/card:scale-[1.05] motion-reduce:transition-none"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/35 to-transparent opacity-80" />
                  {item.categoryName ? (
                    <span className="absolute top-3 left-3 rounded-full border border-paper/25 bg-ink/55 px-2.5 py-1 font-sans text-[9px] tracking-[0.14em] text-paper uppercase backdrop-blur-[6px]">
                      {item.categoryName}
                    </span>
                  ) : null}
                </Link>

                <div className="flex min-h-[7.25rem] flex-1 flex-col gap-2 px-4 pt-3.5 pb-4">
                  <Link href={href} className="no-underline">
                    <h3 className="line-clamp-2 min-h-[calc(1.15em*2)] font-serif text-[1.2rem] leading-[1.15] text-ink transition-colors group-hover/card:text-clay md:min-h-[calc(1.15em*2)] md:text-[1.28rem]">
                      {item.name}
                    </h3>
                  </Link>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <p className="font-serif text-[1.15rem] text-clay md:text-[1.2rem]">
                      {formatPrice(item.price)}
                    </p>
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={() => addOne(item)}
                      className="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full border border-ink/12 bg-paper/80 px-3.5 font-sans text-[10px] tracking-[0.16em] text-ink uppercase transition-[background-color,border-color,color] duration-200 hover:enabled:border-transparent hover:enabled:bg-ink hover:enabled:text-paper disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      В корзину
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className={`${navBtn} -left-1 md:-left-3`}
          aria-label="Предыдущие блюда"
          disabled={!canPrev}
          onClick={() => scrollByCard(-1)}
        >
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${navBtn} -right-1 md:-right-3`}
          aria-label="Следующие блюда"
          disabled={!canNext}
          onClick={() => scrollByCard(1)}
        >
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-6 sm:hidden">
        <Link
          href="/menu"
          className="inline-flex font-sans text-[11px] tracking-[0.22em] text-ink/50 uppercase no-underline transition-colors hover:text-clay"
        >
          Всё меню →
        </Link>
      </div>
    </section>
  );
};
