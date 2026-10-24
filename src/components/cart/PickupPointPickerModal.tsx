"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  cartCloseButton,
  cartIcon,
  cartKicker,
} from "@/components/cart/cart-styles";
import { formatPhoneDisplay } from "@/lib/phone";
import type { PickupPointPublic } from "@/lib/pickup-points";

const footButton =
  "min-h-11 cursor-pointer rounded-full px-[1.15rem] text-[11px] leading-none font-bold tracking-[0.12em] uppercase disabled:cursor-not-allowed disabled:opacity-45";

type PickupPointPickerModalProps = {
  open: boolean;
  points: PickupPointPublic[];
  selectedId: string | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

export const PickupPointPickerModal = ({
  open,
  points,
  selectedId,
  onClose,
  onConfirm,
}: PickupPointPickerModalProps) => {
  const [draftId, setDraftId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (!open) return;
    setDraftId(
      selectedId && points.some((p) => p.id === selectedId)
        ? selectedId
        : (points[0]?.id ?? null),
    );
  }, [open, selectedId, points]);

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

  if (!open || typeof document === "undefined") return null;

  const canConfirm = Boolean(draftId && points.some((p) => p.id === draftId));

  return createPortal(
    <div
      className="fixed inset-0 z-200 grid place-items-center bg-[rgba(24,22,18,0.55)] p-4 backdrop-blur-[8px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,640px)] w-[min(100%,480px)] flex-col overflow-hidden rounded-[20px] border border-ink/8 bg-paper bg-[image:linear-gradient(180deg,rgba(239,231,216,0.45)_0%,transparent_22%)] shadow-[0_28px_70px_rgba(24,22,18,0.28)] max-[640px]:max-h-[96vh] max-[640px]:w-full max-[640px]:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink/8 px-[1.15rem] pt-[1.1rem] pb-[0.85rem]">
          <div>
            <p className={cartKicker}>Самовывоз</p>
            <h3
              id="pickup-picker-title"
              className="font-serif text-[1.45rem] leading-[1.15] font-medium text-ink"
            >
              Выберите точку
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

        <div className="flex min-h-0 flex-auto flex-col gap-[0.45rem] overflow-auto px-[1.15rem] py-[0.9rem]">
          {points.length ? (
            points.map((point) => {
              const active = draftId === point.id;
              return (
                <button
                  key={point.id}
                  type="button"
                  className={`flex flex-col items-start gap-[0.2rem] rounded-[14px] border px-[0.95rem] py-[0.85rem] text-left transition-colors duration-180 ${
                    active
                      ? "border-clay/45 bg-clay/10"
                      : "border-ink/10 bg-paper/65 hover:border-clay/25"
                  }`}
                  onClick={() => setDraftId(point.id)}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-[0.7rem] font-[650] tracking-[0.12em] text-clay uppercase">
                      {point.name}
                    </span>
                    {active ? (
                      <Check
                        size={16}
                        strokeWidth={2.5}
                        className="shrink-0 text-clay"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <strong className="font-sans text-[0.92rem] leading-[1.3] font-[650] text-ink">
                    {point.address}
                  </strong>
                  {point.phone ? (
                    <span className="text-[0.82rem] text-ink/48">
                      {formatPhoneDisplay(point.phone)}
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="m-0 text-[0.9rem] text-ink/55">
              Точки самовывоза пока не добавлены.
            </p>
          )}
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
            disabled={!canConfirm}
            onClick={() => {
              if (!draftId) return;
              onConfirm(draftId);
            }}
          >
            Выбрать
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
