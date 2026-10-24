"use client";

import { useEffect, useId, useRef, useState } from "react";
import { suggestAddressAction } from "@/actions/dadata";
import type { DadataAddressSuggestion } from "@/lib/dadata";

type AddressSuggestFieldProps = {
  initialQuery?: string;
  onPick: (suggestion: DadataAddressSuggestion) => void;
};

const inputClass =
  "w-full rounded-[14px] border border-ink/12 bg-white/90 px-[0.9rem] py-[0.75rem] text-[0.95rem] leading-[1.3] font-medium text-ink transition-[border-color,box-shadow] duration-200 focus:border-clay/55 focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)] focus:outline-none";

export const AddressSuggestField = ({
  initialQuery = "",
  onPick,
}: AddressSuggestFieldProps) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<DadataAddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setItems([]);
      setBusy(false);
      setError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void (async () => {
        const result = await suggestAddressAction(q);
        if (cancelled) return;
        setBusy(false);
        if (!result.success || !result.data) {
          setItems([]);
          setError(result.success ? "Нет подсказок" : result.error);
          setOpen(true);
          return;
        }
        setError("");
        setItems(result.data);
        setOpen(true);
        setActiveIndex(result.data.length ? 0 : -1);
      })();
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const pick = (item: DadataAddressSuggestion) => {
    setQuery(item.label || item.value);
    setOpen(false);
    setItems([]);
    onPick(item);
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-[0.35rem]">
      <label className="text-[10px] font-bold tracking-[0.14em] text-ink/48 uppercase">
        Улица и дом
      </label>
      <input
        type="text"
        className={inputClass}
        value={query}
        placeholder="Начните вводить адрес…"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && items.length > 0}
        role="combobox"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
            e.preventDefault();
            pick(items[activeIndex]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {busy ? (
        <p className="text-[0.78rem] text-ink/45">Ищем адрес…</p>
      ) : null}
      {error && !busy ? (
        <p className="text-[0.78rem] text-danger">{error}</p>
      ) : null}
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+0.25rem)] right-0 left-0 z-20 m-0 max-h-[14rem] list-none overflow-auto rounded-[14px] border border-ink/10 bg-paper p-[0.35rem] shadow-[0_16px_40px_rgba(33,30,25,0.14)]"
        >
          {items.map((item, index) => (
            <li key={`${item.unrestricted_value}-${index}`} role="option">
              <button
                type="button"
                className={`flex w-full cursor-pointer flex-col items-start gap-[0.15rem] rounded-[10px] border-0 px-3 py-[0.65rem] text-left transition-colors duration-150 ${
                  index === activeIndex
                    ? "bg-clay/12 text-ink"
                    : "bg-transparent text-ink hover:bg-ink/[0.04]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(item)}
              >
                <span className="text-[0.92rem] leading-[1.25] font-[650]">
                  {item.label}
                </span>
                <span className="text-[0.78rem] leading-[1.3] text-ink/48">
                  {item.unrestricted_value}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
