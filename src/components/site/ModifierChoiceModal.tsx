"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  areModifierSelectionsComplete,
  cartModifiersFromSelection,
  requiredModifierGroups,
} from "@/lib/menu-modifiers";
import { formatPrice } from "@/lib/format";
import type { CartModifier } from "@/store/cartSlice";
import type { MenuItem } from "@/types/site";

type ModifierChoiceModalProps = {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
  onConfirm: (modifiers: CartModifier[]) => void;
};

export const ModifierChoiceModal = ({
  item,
  open,
  onClose,
  onConfirm,
}: ModifierChoiceModalProps) => {
  const groups = useMemo(() => requiredModifierGroups(item), [item]);
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string[]> = {};
    for (const group of groups) {
      // Preselect first option for single-choice required groups.
      if (group.minQuantity === 1 && group.maxQuantity === 1 && group.options[0]) {
        initial[group.id] = [group.options[0].productId];
      } else {
        initial[group.id] = [];
      }
    }
    setSelectedByGroup(initial);
  }, [open, groups]);

  if (!open) return null;

  const complete = areModifierSelectionsComplete(groups, selectedByGroup);

  const toggleOption = (groupId: string, productId: string, maxQuantity: number) => {
    setSelectedByGroup((prev) => {
      const current = prev[groupId] || [];
      if (maxQuantity <= 1) {
        return { ...prev, [groupId]: [productId] };
      }
      if (current.includes(productId)) {
        return {
          ...prev,
          [groupId]: current.filter((id) => id !== productId),
        };
      }
      if (current.length >= maxQuantity) {
        return prev;
      }
      return { ...prev, [groupId]: [...current, productId] };
    });
  };

  const confirm = () => {
    if (!complete) return;
    onConfirm(cartModifiersFromSelection(groups, selectedByGroup));
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modifier-choice-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full max-w-[420px] overflow-y-auto rounded-t-[1.35rem] border border-ink/10 bg-paper px-[1.15rem] pt-[1.15rem] pb-[1.35rem] shadow-[0_24px_60px_rgba(33,30,25,0.28)] sm:rounded-[1.35rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full border-0 bg-ink/[0.05] text-ink/70"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <p className="m-0 pr-10 text-[0.72rem] uppercase tracking-[0.12em] text-ink/50">
          Выберите вариант
        </p>
        <h2
          id="modifier-choice-title"
          className="mt-[0.35rem] font-serif text-[1.55rem] leading-[1.15]"
        >
          {item.name}
        </h2>
        {item.price ? (
          <p className="mt-[0.35rem] text-[0.95rem] text-ink/55">
            {formatPrice(item.price)}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-5">
          {groups.map((group) => {
            const picked = selectedByGroup[group.id] || [];
            const single = group.maxQuantity <= 1;
            return (
              <fieldset key={group.id} className="m-0 border-0 p-0">
                <legend className="mb-2 px-0 text-[0.78rem] font-[650] uppercase tracking-[0.1em] text-ink/55">
                  {group.name.replace(/:\s*$/, "")}
                  {group.minQuantity >= 1 ? (
                    <span className="ml-1 normal-case tracking-normal text-clay">
                      · обязательно
                    </span>
                  ) : null}
                </legend>
                <div className="flex flex-col gap-2">
                  {group.options.map((option) => {
                    const checked = picked.includes(option.productId);
                    const label = option.name.replace(/^[-–—\s]+/, "").trim() || option.name;
                    return (
                      <label
                        key={option.productId}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${
                          checked
                            ? "border-clay/55 bg-clay/[0.08]"
                            : "border-ink/10 bg-white hover:border-ink/20"
                        }`}
                      >
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`mod-${group.id}`}
                          className="size-4 accent-clay"
                          checked={checked}
                          onChange={() =>
                            toggleOption(
                              group.id,
                              option.productId,
                              group.maxQuantity || 1,
                            )
                          }
                        />
                        <span className="flex-1 text-[0.98rem] font-[550] text-ink">
                          {label}
                        </span>
                        {option.price > 0 ? (
                          <span className="text-sm text-ink/50">
                            +{formatPrice(String(option.price))}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        <button
          type="button"
          className="mt-6 w-full rounded-full border-0 bg-ink px-5 py-3.5 font-sans text-[0.92rem] font-[650] tracking-[0.04em] text-paper disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!complete}
          onClick={confirm}
        >
          Подтвердить и в корзину
        </button>
      </div>
    </div>
  );
};
