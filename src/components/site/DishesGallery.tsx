"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteDish } from "@/types/site";

interface DishesGalleryProps {
  dishes: SiteDish[];
}

const calcPerView = (): number => {
  if (typeof window === "undefined") return 3;
  const w = window.innerWidth;
  if (w < 640) return 1;
  if (w < 768) return 2;
  return 3;
};

export const DishesGallery = ({ dishes }: DishesGalleryProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dsIndex, setDsIndex] = useState(0);
  const [perView, setPerView] = useState(3);
  const [offset, setOffset] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  const maxDsIndex = Math.max(0, dishes.length - perView);

  const syncOffset = useCallback(() => {
    const track = trackRef.current;
    const slide = track?.querySelector<HTMLElement>(".ds-slide");
    if (!track || !slide) {
      setOffset(0);
      return;
    }
    const gap = window.innerWidth >= 768 ? 24 : 12;
    const step = slide.getBoundingClientRect().width + gap;
    setOffset(dsIndex * step);
  }, [dsIndex]);

  useEffect(() => {
    const onResize = () => {
      setPerView(calcPerView());
      syncOffset();
    };
    setPerView(calcPerView());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncOffset]);

  useEffect(() => {
    setDsIndex((i) => Math.min(i, maxDsIndex));
  }, [maxDsIndex]);

  useEffect(() => {
    const id = requestAnimationFrame(syncOffset);
    return () => cancelAnimationFrame(id);
  }, [syncOffset, dishes.length, perView]);

  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLbOpen(false);
      if (e.key === "ArrowLeft") {
        setLbIndex((i) => (i - 1 + dishes.length) % dishes.length);
      }
      if (e.key === "ArrowRight") {
        setLbIndex((i) => (i + 1) % dishes.length);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lbOpen, dishes.length]);

  useEffect(() => {
    let startX = 0;
    let swiping = false;
    const onStart = (e: TouchEvent) => {
      const viewport = document.querySelector("#dishesSlider .ds-viewport");
      if (!viewport?.contains(e.target as Node)) return;
      startX = e.changedTouches[0].clientX;
      swiping = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 40) return;
      setDsIndex((i) =>
        Math.max(0, Math.min(maxDsIndex, i + (dx < 0 ? 1 : -1))),
      );
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [maxDsIndex]);

  if (!dishes.length) return null;

  const pages = Math.max(1, maxDsIndex + 1);
  const from = dsIndex + 1;
  const to = Math.min(dsIndex + perView, dishes.length);
  const multi = dishes.length > perView;

  return (
    <>
      <div className="dishes-slider reveal in" id="dishesSlider" aria-label="Избранные блюда">
        <div className="ds-viewport">
          <div
            ref={trackRef}
            className="ds-track"
            style={{ transform: `translate3d(-${offset}px, 0, 0)` }}
          >
            {dishes.map((dish, i) => (
              <figure key={`${dish.image}-${i}`} className="dish ds-slide overflow-hidden">
                <button
                  type="button"
                  className="dish-trigger"
                  aria-label={`Открыть: ${dish.caption || "блюдо"}`}
                  onClick={() => {
                    setLbIndex(i);
                    setLbOpen(true);
                  }}
                >
                  <div className="aspect-square overflow-hidden bg-sand md:aspect-[4/5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={dish.image}
                      alt={dish.caption || ""}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </button>
                <figcaption className="mt-3 font-serif text-base italic text-ink/70 md:text-lg">
                  {dish.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="ds-nav ds-prev"
          aria-label="Предыдущие блюда"
          disabled={!multi || dsIndex <= 0}
          hidden={dishes.length <= 1}
          onClick={() => setDsIndex((i) => Math.max(0, i - 1))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="ds-nav ds-next"
          aria-label="Следующие блюда"
          disabled={!multi || dsIndex >= maxDsIndex}
          hidden={dishes.length <= 1}
          onClick={() => setDsIndex((i) => Math.min(maxDsIndex, i + 1))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        <div className="ds-footer">
          <div className="ds-dots" role="tablist" aria-label="Слайды блюд">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`ds-dot${i === dsIndex ? " is-active" : ""}`}
                aria-label={`Страница ${i + 1}`}
                aria-selected={i === dsIndex}
                onClick={() => setDsIndex(i)}
              />
            ))}
          </div>
          <span className="ds-counter">
            {from === to ? `${from} / ${dishes.length}` : `${from}–${to} / ${dishes.length}`}
          </span>
        </div>
      </div>

      <div
        className={`lb${lbOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Галерея блюд"
        hidden={!lbOpen}
        aria-hidden={!lbOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLbOpen(false);
        }}
      >
        <button
          type="button"
          className="lb-close"
          aria-label="Закрыть"
          onClick={() => setLbOpen(false)}
        >
          ×
        </button>
        <div className="lb-inner">
          <div className="lb-stage">
            <div
              className="lb-track"
              style={{ transform: `translate3d(-${lbIndex * 100}%, 0, 0)` }}
            >
              {dishes.map((dish, i) => (
                <div
                  key={`lb-${dish.image}-${i}`}
                  className={`lb-slide${i === lbIndex ? " is-active" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dish.image} alt={dish.caption || ""} draggable={false} />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="lb-btn lb-prev"
              aria-label="Предыдущее"
              onClick={() =>
                setLbIndex((i) => (i - 1 + dishes.length) % dishes.length)
              }
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className="lb-btn lb-next"
              aria-label="Следующее"
              onClick={() => setLbIndex((i) => (i + 1) % dishes.length)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className="lb-meta">
            <p className="lb-caption">{dishes[lbIndex]?.caption || ""}</p>
            <p className="lb-counter">
              {lbIndex + 1} / {dishes.length}
            </p>
          </div>
          <div className="lb-dots" role="tablist" aria-label="Слайды">
            {dishes.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`lb-dot${i === lbIndex ? " is-active" : ""}`}
                role="tab"
                aria-label={`Слайд ${i + 1}`}
                aria-selected={i === lbIndex}
                onClick={() => setLbIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
