"use client";

import Link from "next/link";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CompanyRequisites } from "@/components/site/CompanyRequisites";
import { SiteLegalLinks } from "@/components/site/SiteLegalLinks";
import {
  categoryAvailableFromLabel,
  isCategoryAvailableNow,
} from "@/lib/delivery-availability";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import { getRelatedMenuProducts } from "@/lib/cart-suggestions";
import type { CustomerPublic } from "@/lib/customer-auth";
import {
  brandLabel,
  brandLabelOrDefault,
  formatPrice,
} from "@/lib/format";
import { menuItemSlug } from "@/lib/menu-slug";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addToCartQuiet,
  decrementQty,
  incrementQty,
  setQty,
  type CartProduct,
} from "@/store/cartSlice";
import type { MenuCategory, MenuItem, SiteData } from "@/types/site";

type MenuProductPageProps = {
  site: SiteData;
  item: MenuItem;
  category: MenuCategory;
  customer: CustomerPublic | null;
};

const hasKbju = (item: MenuItem): boolean =>
  item.kcal != null ||
  item.protein != null ||
  item.fat != null ||
  item.carbs != null;

const formatNutrient = (value: number | null, unit: string): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
  return `${rounded}${unit}`;
};

export const MenuProductPage = ({
  site,
  item,
  category,
  customer,
}: MenuProductPageProps) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((s) => s.cart.items);
  const lineQty = useAppSelector(
    (s) => s.cart.items.find((row) => row.id === item.id)?.qty ?? 0,
  );

  const [addQty, setAddQty] = useState(1);

  const footerBrand = brandLabel(site);
  const a11y = brandLabelOrDefault(site);
  const ordersEnabled =
    (site.delivery ?? createDefaultDeliverySettings()).ordersEnabled !== false;
  const available = isCategoryAvailableNow(category);
  const fromLabel = categoryAvailableFromLabel(category);
  const soldOut = item.inStock === false;
  const notDeliverable = item.showInDelivery === false;
  const canOrder =
    ordersEnabled && available && !soldOut && !notDeliverable;

  const related = useMemo(
    () =>
      getRelatedMenuProducts(
        site.menu,
        {
          id: item.id,
          name: item.name,
          categoryId: category.id,
          categoryName: category.name,
        },
        8,
      ),
    [site.menu, item.id, item.name, category.id, category.name],
  );

  const unitPrice = (() => {
    const n = Number(String(item.price).replace(",", ".").match(/[\d.]+/)?.[0]);
    return Number.isFinite(n) ? n : 0;
  })();
  const lineLabel = formatPrice(String(Math.round(unitPrice * addQty)));

  const toCartProduct = (row: MenuItem | CartProduct, cat?: MenuCategory): CartProduct => {
    if ("categoryId" in row && row.categoryId) {
      return {
        id: row.id,
        name: row.name,
        price: row.price,
        image: row.image || "",
        categoryId: row.categoryId,
        categoryName: row.categoryName || "",
      };
    }
    return {
      id: row.id,
      name: row.name,
      price: row.price,
      image: row.image || "",
      categoryId: cat?.id ?? category.id,
      categoryName: cat?.name ?? category.name ?? "",
    };
  };

  const addCurrent = () => {
    if (!canOrder) return;
    const product = toCartProduct(item, category);
    if (lineQty <= 0) {
      dispatch(addToCartQuiet(product));
      if (addQty > 1) dispatch(setQty({ id: product.id, qty: addQty }));
    } else {
      dispatch(setQty({ id: product.id, qty: lineQty + addQty }));
    }
    setAddQty(1);
  };

  const blockedLabel = !ordersEnabled
    ? "Заказы временно не принимаем"
    : soldOut
      ? "Закончилось"
      : notDeliverable
        ? "Это блюдо только в кафе — в заказ не добавляется"
        : !available
          ? fromLabel
            ? `Доступно с ${fromLabel}`
            : "Сейчас недоступно"
          : null;

  return (
    <div className="relative isolate min-h-screen overflow-x-clip font-sans text-ink antialiased [background:linear-gradient(180deg,rgba(239,231,216,.55)_0%,transparent_28%),linear-gradient(135deg,#FBF8F1_0%,#F4EDE1_48%,#FBF8F1_100%)]">
      <SiteHeader site={site} customer={customer} />

      <main id="main" className="mx-auto max-w-[1120px] px-5 pt-6 pb-[6.5rem] md:px-8 md:pt-10">
        <Link
          href="/menu"
          className="mb-5 inline-flex min-h-[42px] items-center gap-[0.4rem] rounded-full border border-ink/[.14] bg-paper/90 pr-[0.95rem] pl-[0.7rem] text-[11px] tracking-[0.16em] text-ink uppercase no-underline transition-[background-color,color,border-color] duration-200 hover:border-transparent hover:bg-clay hover:text-paper"
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          К меню
        </Link>
        <div className="grid gap-8 md:grid-cols-2 md:gap-10 md:items-start">
          <div className="relative aspect-square overflow-hidden rounded-[22px] border border-ink/[.07] bg-[linear-gradient(145deg,#efe7d8,#fbf8f1)] md:aspect-[4/5]">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.name}
                className="absolute inset-0 size-full object-cover"
                fetchPriority="high"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[11px] tracking-[0.18em] text-ink/40 uppercase">
                Нет фото
              </div>
            )}
            {soldOut ? (
              <span className="absolute top-3 left-3 rounded-full bg-ink/75 px-3 py-1.5 text-[10px] tracking-[0.1em] text-paper uppercase">
                Закончилось
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            {category.name ? (
              <p className="m-0 text-[10px] font-bold tracking-[0.16em] text-clay uppercase">
                {category.name}
              </p>
            ) : null}
            <h1 className="m-0 font-serif text-[clamp(1.85rem,4vw,2.6rem)] leading-[1.08] font-medium text-ink">
              {item.name}
            </h1>
            <p className="m-0 font-serif text-[1.55rem] text-clay">
              {formatPrice(item.price)}
            </p>

            <dl className="m-0 grid gap-3 rounded-[16px] border border-ink/8 bg-white/60 px-4 py-4">
              <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
                <dt className="m-0 text-[0.72rem] font-[650] tracking-[0.12em] text-ink/42 uppercase">
                  Вес / выход
                </dt>
                <dd className="m-0 text-[0.98rem] font-[650] text-ink">
                  {item.weight.trim() || "Не указан"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
                <dt className="m-0 text-[0.72rem] font-[650] tracking-[0.12em] text-ink/42 uppercase">
                  Наличие
                </dt>
                <dd className="m-0 text-[0.98rem] font-[650] text-ink">
                  {soldOut ? "Закончилось" : "В наличии"}
                </dd>
              </div>
              {category.availableFrom || category.availableTo ? (
                <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
                  <dt className="m-0 text-[0.72rem] font-[650] tracking-[0.12em] text-ink/42 uppercase">
                    Время
                  </dt>
                  <dd className="m-0 text-[0.98rem] font-[650] text-ink">
                    {[category.availableFrom, category.availableTo]
                      .filter(Boolean)
                      .join(" – ") || "Без ограничений"}
                    {!available && fromLabel
                      ? ` · доступно с ${fromLabel}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-start">
                <dt className="m-0 text-[0.72rem] font-[650] tracking-[0.12em] text-ink/42 uppercase">
                  Описание
                </dt>
                <dd className="m-0 whitespace-pre-wrap text-[1.02rem] leading-[1.55] text-ink/75">
                  {item.description.trim() || "Описание пока не добавлено"}
                </dd>
              </div>
            </dl>

            {hasKbju(item) ? (
              <div className="rounded-[16px] border border-ink/8 bg-white/60 px-4 py-4">
                <p className="m-0 mb-3 text-[0.72rem] font-[650] tracking-[0.12em] text-clay uppercase">
                  Пищевая ценность · на 100 г
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["Калории", formatNutrient(item.kcal, " ккал")],
                      ["Белки", formatNutrient(item.protein, " г")],
                      ["Жиры", formatNutrient(item.fat, " г")],
                      ["Углеводы", formatNutrient(item.carbs, " г")],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[12px] border border-ink/6 bg-paper/70 px-3 py-3 text-center"
                    >
                      <p className="m-0 text-[10px] tracking-[0.1em] text-ink/42 uppercase">
                        {label}
                      </p>
                      <p className="m-0 mt-1.5 font-serif text-[1.15rem] text-ink">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {canOrder ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex items-center gap-1 self-start rounded-full border border-ink/10 bg-paper/80 p-[0.15rem]">
                  <button
                    type="button"
                    className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5"
                    aria-label="Меньше"
                    onClick={() => setAddQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus size={16} strokeWidth={2} />
                  </button>
                  <span className="min-w-[1.75rem] text-center text-[1rem] font-[650]">
                    {addQty}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5"
                    aria-label="Больше"
                    onClick={() => setAddQty((q) => Math.min(99, q + 1))}
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-full border-0 bg-ink px-5 text-[12px] font-bold tracking-[0.12em] text-paper uppercase hover:bg-clay"
                  onClick={addCurrent}
                >
                  В корзину · {lineLabel}
                </button>
              </div>
            ) : (
              <p className="m-0 rounded-[14px] border border-ink/10 bg-ink/4 px-4 py-3 text-[0.95rem] text-ink/55">
                {blockedLabel}
              </p>
            )}

            {lineQty > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-clay/25 bg-clay/8 px-4 py-3">
                <span className="text-[0.9rem] text-ink/70">
                  В корзине: <strong>{lineQty}</strong>
                </span>
                <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-paper/90 p-[0.1rem]">
                  <button
                    type="button"
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5"
                    aria-label="Убрать"
                    onClick={() => dispatch(decrementQty(item.id))}
                  >
                    <Minus size={14} strokeWidth={2} />
                  </button>
                  <span className="min-w-[1.25rem] text-center text-[0.9rem] font-[650]">
                    {lineQty}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-40"
                    aria-label="Добавить"
                    disabled={!canOrder}
                    onClick={() => dispatch(incrementQty(item.id))}
                  >
                    <Plus size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {related.length ? (
          <section className="mt-14 md:mt-16" aria-label="Рекомендуем">
            <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-clay uppercase">
              Вам может подойти
            </p>
            <h2 className="m-0 mb-6 font-serif text-[clamp(1.45rem,3vw,1.9rem)] text-ink">
              Другие блюда
            </h2>
            <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4 min-[900px]:gap-5">
              {related.map((product) => {
                const href = `/menu/${menuItemSlug(product)}`;
                const qty =
                  cartItems.find((row) => row.id === product.id)?.qty ?? 0;
                return (
                  <article
                    key={product.id}
                    className="flex min-h-full flex-col overflow-hidden rounded-[18px] border border-ink/[.07] bg-white/58"
                  >
                    <Link
                      href={href}
                      className="relative aspect-square overflow-hidden bg-[linear-gradient(145deg,#efe7d8,#fbf8f1)] no-underline"
                    >
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          className="block size-full object-cover"
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-[10px] tracking-[0.14em] text-ink/40 uppercase">
                          Нет фото
                        </span>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col gap-1 px-3 pt-3 pb-3">
                      <Link href={href} className="no-underline">
                        <h3 className="line-clamp-2 font-serif text-[1.02rem] leading-[1.15] text-ink">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="m-0 font-serif text-[1rem] text-clay">
                        {formatPrice(product.price)}
                      </p>
                      {qty > 0 ? (
                        <div className="mt-auto inline-flex w-full items-center justify-between rounded-full border border-ink/10 p-[0.1rem]">
                          <button
                            type="button"
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5"
                            aria-label="Убрать"
                            onClick={() => dispatch(decrementQty(product.id))}
                          >
                            <Minus size={14} strokeWidth={2} />
                          </button>
                          <span className="text-[0.9rem] font-[650]">{qty}</span>
                          <button
                            type="button"
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-ink/5"
                            aria-label="Добавить"
                            onClick={() => dispatch(incrementQty(product.id))}
                          >
                            <Plus size={14} strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-auto min-h-[34px] w-full cursor-pointer rounded-full border border-clay/40 text-[10px] font-bold tracking-[0.12em] text-clay uppercase hover:border-transparent hover:bg-clay hover:text-paper disabled:opacity-45"
                          disabled={!ordersEnabled}
                          onClick={() =>
                            dispatch(addToCartQuiet(toCartProduct(product)))
                          }
                        >
                          В корзину
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>

      <footer role="contentinfo">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 border-t border-ink/[.08] px-5 pt-6 pb-6 md:px-8">
          <Link
            href="/"
            className="font-serif text-[1.15rem] tracking-[0.3em] text-ink no-underline"
          >
            {footerBrand || a11y}
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] text-ink/45">
            <Link
              href="/menu"
              className="tracking-[0.26em] uppercase no-underline hover:text-clay"
            >
              Меню
            </Link>
            <SiteLegalLinks className="normal-case tracking-normal" />
          </div>
        </div>
        <CompanyRequisites />
      </footer>

    </div>
  );
};
