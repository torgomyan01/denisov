"use client";

import { Check, MapPin, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  cartCloseButton,
  cartDeliveryAddress,
  cartIcon,
  cartKicker,
} from "@/components/cart/cart-styles";
import type { MapPickerChange } from "@/components/maps/MapPicker";
import { MapPickerLoading } from "@/components/maps/MapPickerLoading";
import {
  findDeliveryZoneForPoint,
  isPointInDeliveryZone,
} from "@/lib/delivery-pricing";
import { formatPrice } from "@/lib/format";
import type { DeliverySettings } from "@/types/site";

const MODAL_MAP_HEIGHT = "h-[min(52vh,420px)] max-[640px]:h-[min(48vh,340px)]";

const MapPicker = dynamic(
  () => import("@/components/maps/MapPicker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <MapPickerLoading heightClassName={MODAL_MAP_HEIGHT}>
        Загрузка Яндекс.Карты…
      </MapPickerLoading>
    ),
  },
);

const footButton =
  "min-h-11 cursor-pointer rounded-full px-[1.15rem] text-[11px] leading-none font-bold tracking-[0.12em] uppercase disabled:cursor-not-allowed disabled:opacity-45";

type DeliveryMapModalProps = {
  open: boolean;
  initialLat: number | null;
  initialLng: number | null;
  delivery: DeliverySettings;
  onClose: () => void;
  onSave: (data: {
    lat: number;
    lng: number;
    address?: string;
  }) => void;
};

export const DeliveryMapModal = ({
  open,
  initialLat,
  initialLng,
  delivery,
  onClose,
  onSave,
}: DeliveryMapModalProps) => {
  const [draft, setDraft] = useState<MapPickerChange | null>(null);
  const [outside, setOutside] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (
      typeof initialLat === "number" &&
      typeof initialLng === "number" &&
      Number.isFinite(initialLat) &&
      Number.isFinite(initialLng)
    ) {
      setDraft({ lat: initialLat, lng: initialLng });
      setOutside(!isPointInDeliveryZone(delivery, initialLat, initialLng));
    } else {
      setDraft(null);
      setOutside(false);
    }
  }, [open, initialLat, initialLng, delivery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const matchedZone = useMemo(() => {
    if (!draft) return null;
    return findDeliveryZoneForPoint(delivery.zones, draft.lat, draft.lng);
  }, [delivery.zones, draft]);

  if (!open || typeof document === "undefined") return null;

  const canSave =
    draft != null &&
    Number.isFinite(draft.lat) &&
    Number.isFinite(draft.lng) &&
    !outside &&
    isPointInDeliveryZone(delivery, draft.lat, draft.lng);

  return createPortal(
    <div
      className="fixed inset-0 z-200 grid place-items-center bg-[rgba(24,22,18,0.55)] p-4 backdrop-blur-[8px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,820px)] w-[min(100%,720px)] flex-col overflow-hidden rounded-[20px] border border-ink/8 bg-paper bg-[image:linear-gradient(180deg,rgba(239,231,216,0.45)_0%,transparent_22%)] shadow-[0_28px_70px_rgba(24,22,18,0.28)] max-[640px]:max-h-[96vh] max-[640px]:w-full max-[640px]:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-map-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink/8 px-[1.15rem] pt-[1.1rem] pb-[0.85rem]">
          <div>
            <p className={cartKicker}>Доставка</p>
            <h3
              id="cart-map-modal-title"
              className="font-serif text-[1.45rem] leading-[1.15] font-medium text-ink"
            >
              Выберите точку на карте
            </h3>
          </div>
          <button
            type="button"
            className={cartCloseButton}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X
              size={18}
              strokeWidth={2}
              className={cartIcon}
              aria-hidden="true"
            />
          </button>
        </header>

        <div className="flex min-h-0 flex-auto flex-col gap-[0.65rem] overflow-auto px-[1.15rem] py-[0.9rem]">
          <MapPicker
            key={`${open}-${initialLat}-${initialLng}`}
            lat={draft?.lat ?? null}
            lng={draft?.lng ?? null}
            heightClassName={MODAL_MAP_HEIGHT}
            reverseGeocode
            delivery={delivery}
            hint="Отметьте адрес внутри цветной зоны доставки."
            onOutsideZone={() => setOutside(true)}
            onInsideZone={() => setOutside(false)}
            onChange={(next) => {
              setDraft(next);
              setOutside(false);
            }}
          />
          <p className={cartDeliveryAddress(canSave)}>
            {canSave ? (
              <>
                <Check
                  size={14}
                  strokeWidth={2.5}
                  className={cartIcon}
                  aria-hidden="true"
                />
                {draft?.address?.trim() || "Место отмечено на карте"}
              </>
            ) : outside ? (
              <>
                <MapPin
                  size={14}
                  strokeWidth={2}
                  className={cartIcon}
                  aria-hidden="true"
                />
                Вне зоны доставки — выберите точку внутри контура
              </>
            ) : (
              <>
                <MapPin
                  size={14}
                  strokeWidth={2}
                  className={cartIcon}
                  aria-hidden="true"
                />
                Отметьте место получения на карте
              </>
            )}
          </p>
          {matchedZone ? (
            <p className="rounded-xl bg-olive-soft/12 px-3 py-[0.55rem] text-[0.82rem] leading-[1.35] text-ink/72">
              Зона «{matchedZone.name}» · доставка{" "}
              {matchedZone.deliveryFee > 0
                ? formatPrice(String(matchedZone.deliveryFee))
                : "бесплатно"}
              {matchedZone.freeDeliveryFrom > 0
                ? ` (бесплатно от ${formatPrice(String(matchedZone.freeDeliveryFrom))})`
                : ""}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-[0.55rem] border-t border-ink/8 bg-paper/95 px-[1.15rem] pt-[0.85rem] pb-[1.1rem]">
          <button
            type="button"
            className={`${footButton} border border-ink/14 bg-transparent text-ink hover:border-clay/40 hover:text-clay`}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className={`${footButton} border-0 bg-ink text-paper enabled:hover:bg-clay`}
            disabled={!canSave}
            onClick={() => {
              if (!draft || !canSave) return;
              onSave({
                lat: draft.lat,
                lng: draft.lng,
                address: draft.address || draft.fullAddress,
              });
            }}
          >
            Сохранить
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
