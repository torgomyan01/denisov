"use client";

import { btnDark, btnLine, btnSmGhost } from "@/components/admin/styles";
import { Check, Copy, ExternalLink, Navigation, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatCoordsLabel,
  yandexMapsPointUrl,
  yandexMapsRouteUrl,
  yandexNaviPointUrl,
} from "@/lib/delivery-maps";
import { loadYandexMaps, type YMapsMap } from "@/lib/yandex-maps";

type OrderDeliveryMapModalProps = {
  open: boolean;
  lat: number;
  lng: number;
  customerName?: string;
  onClose: () => void;
};

export const OrderDeliveryMapModal = ({
  open,
  lat,
  lng,
  customerName,
  onClose,
}: OrderDeliveryMapModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapsMap | null>(null);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const coordsLabel = formatCoordsLabel(lat, lng);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setMapReady(false);
      setMapError("");
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const boot = async () => {
      try {
        const ymaps = await loadYandexMaps();
        if (cancelled || !containerRef.current) return;

        if (mapRef.current) {
          mapRef.current.destroy();
          mapRef.current = null;
        }

        const map = new ymaps.Map(containerRef.current, {
          center: [lat, lng],
          zoom: 16,
          controls: ["zoomControl", "geolocationControl"],
        });
        const placemark = new ymaps.Placemark(
          [lat, lng],
          {
            balloonContentHeader: customerName?.trim() || "Адрес доставки",
            balloonContentBody: coordsLabel,
            hintContent: "Точка клиента",
          },
          { preset: "islands#redDotIcon", draggable: false },
        );
        map.geoObjects.add(placemark);
        mapRef.current = map;
        setMapReady(true);
        setMapError("");
      } catch (error) {
        if (cancelled) return;
        setMapError(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить карту",
        );
      }
    };

    void boot();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [open, lat, lng, customerName, coordsLabel]);

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(coordsLabel);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 m-0 cursor-pointer bg-[#181612]/52 p-0 backdrop-blur-[5px]"
        aria-label="Закрыть карту"
        onClick={onClose}
      />
      <div
        className="relative z-[1] max-h-[min(92vh,860px)] w-[min(720px,100%)] overflow-auto rounded-[18px] bg-white px-[1.05rem] pt-4 pb-[1.15rem] shadow-[0_24px_60px_rgba(33,30,25,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-map-title"
      >
        <header className="mb-3 flex items-start justify-between gap-3 [&_h3]:mt-[0.15rem] [&_h3]:font-serif [&_h3]:text-[1.45rem] [&_h3]:leading-[1.1]">
          <div>
            <p >Доставка</p>
            <h3 id="order-map-title">Адрес клиента на карте</h3>
            {customerName ? (
              <p className="mt-1 text-[0.9rem] text-ink/55">{customerName}</p>
            ) : null}
          </div>
          <button
            type="button"
            className={btnSmGhost}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="relative min-h-[280px] overflow-hidden rounded-[14px] border border-ink/10 bg-[#f3efe7]">
          {!mapReady && !mapError ? (
            <p className="absolute inset-0 z-[2] m-0 grid place-items-center bg-[#f3efe7]/92 p-4 text-center text-[0.9rem]">Загрузка карты…</p>
          ) : null}
          {mapError ? <p className="absolute inset-0 z-[2] m-0 grid place-items-center bg-[#f3efe7]/92 p-4 text-center text-[0.9rem] text-danger">{mapError}</p> : null}
          <div ref={containerRef} className="h-[min(48vh,380px)] min-h-[260px] w-full" />
        </div>

        <div className="mt-[0.85rem] flex items-center justify-between gap-3 rounded-xl bg-ink/4 px-[0.85rem] py-3 max-[560px]:flex-col max-[560px]:items-stretch [&_span]:block [&_span]:text-[0.72rem] [&_span]:uppercase [&_span]:tracking-[0.1em] [&_span]:text-ink/55 [&_strong]:mt-[0.2rem] [&_strong]:block [&_strong]:text-[0.95rem] [&_strong]:tabular-nums [&_button]:shrink-0">
          <div>
            <span>Координаты</span>
            <strong>{coordsLabel}</strong>
          </div>
          <button
            type="button"
            className={btnLine}
            onClick={() => void copyCoords()}
          >
            {copied ? (
              <>
                <Check size={15} strokeWidth={2} aria-hidden="true" />
                Скопировано
              </>
            ) : (
              <>
                <Copy size={15} strokeWidth={2} aria-hidden="true" />
                Копировать
              </>
            )}
          </button>
        </div>

        <div className="mt-[0.85rem] flex flex-wrap gap-2 max-[560px]:[&>a]:w-full max-[560px]:[&>a]:justify-center">
          <a
            className={btnDark}
            href={yandexMapsRouteUrl(lat, lng)}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={15} strokeWidth={2} aria-hidden="true" />
            Маршрут в Яндекс.Картах
          </a>
          <a
            className={btnLine}
            href={yandexMapsPointUrl(lat, lng)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
            Открыть точку
          </a>
          <a
            className={btnLine}
            href={yandexNaviPointUrl(lat, lng)}
            target="_blank"
            rel="noreferrer"
          >
            Яндекс Навигатор
          </a>
        </div>

        <p className="mt-3 text-[0.8rem] leading-[1.4] text-ink/55">
          Скопируйте координаты и вставьте в приложение Яндекс.Карт / Навигатора,
          либо сразу постройте маршрут кнопкой выше.
        </p>
      </div>
    </div>,
    document.body,
  );
};
