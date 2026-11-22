"use client";

import { LoaderCircle, MapPinned, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { suggestAddressAction } from "@/actions/dadata";
import type { DadataAddressSuggestion } from "@/lib/dadata";

type AddressSuggestFieldProps = {
  initialQuery?: string;
  onPick: (suggestion: DadataAddressSuggestion) => void;
};

const highlightMatch = (text: string, query: string): ReactNode => {
  const q = query.trim();
  if (!q || q.length < 2) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-clay/18 px-[0.1em] text-ink not-italic">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
};

export const AddressSuggestField = ({
  initialQuery = "",
  onPick,
}: AddressSuggestFieldProps) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const focusedRef = useRef(false);
  const skipNextSuggestRef = useRef(false);
  const requestSeqRef = useRef(0);

  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<DadataAddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [picked, setPicked] = useState(Boolean(initialQuery.trim()));

  // Sync from parent only when field is idle (not focused) — avoids reopen loops.
  useEffect(() => {
    if (focusedRef.current) return;
    setQuery(initialQuery);
    setPicked(Boolean(initialQuery.trim()));
    setItems([]);
    setOpen(false);
    setError("");
  }, [initialQuery]);

  useEffect(() => {
    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false;
      setBusy(false);
      return;
    }

    const q = query.trim();
    if (q.length < 3 || picked) {
      if (q.length < 3) {
        setItems([]);
        setError("");
        setOpen(false);
      }
      setBusy(false);
      return;
    }

    let cancelled = false;
    const seq = ++requestSeqRef.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void (async () => {
        const result = await suggestAddressAction(q);
        if (cancelled || seq !== requestSeqRef.current) return;
        setBusy(false);
        if (!result.success || !result.data) {
          setItems([]);
          setError(result.success ? "Адрес не найден" : result.error);
          setOpen(focusedRef.current);
          setActiveIndex(-1);
          return;
        }
        setError("");
        setItems(result.data);
        setOpen(focusedRef.current && result.data.length > 0);
        setActiveIndex(result.data.length ? 0 : -1);
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, picked]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        focusedRef.current = false;
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const pick = (item: DadataAddressSuggestion) => {
    skipNextSuggestRef.current = true;
    requestSeqRef.current += 1;
    const label = item.label || item.value;
    setQuery(label);
    setPicked(true);
    setOpen(false);
    setItems([]);
    setError("");
    setBusy(false);
    setActiveIndex(-1);
    focusedRef.current = false;
    inputRef.current?.blur();
    onPick(item);
  };

  const clear = () => {
    skipNextSuggestRef.current = true;
    requestSeqRef.current += 1;
    setQuery("");
    setPicked(false);
    setItems([]);
    setOpen(false);
    setError("");
    setBusy(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
    focusedRef.current = true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, Math.max(0, i) + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault();
      pick(items[activeIndex]!);
    }
  };

  const showList = open && (items.length > 0 || Boolean(error) || busy);

  return (
    <div ref={rootRef} className="relative z-30 flex flex-col gap-[0.45rem]">
      <div className="flex items-end justify-between gap-2">
        <label
          htmlFor={`${listId}-input`}
          className="text-[10px] font-bold tracking-[0.14em] text-ink/48 uppercase"
        >
          Улица и дом
        </label>
        {busy ? (
          <span className="inline-flex items-center gap-[0.3rem] text-[0.72rem] tracking-[0.04em] text-ink/42">
            <LoaderCircle
              size={12}
              strokeWidth={2.2}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Поиск
          </span>
        ) : null}
      </div>

      <div
        className={[
          "group relative flex items-center gap-2 rounded-[16px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(251,248,241,0.88))] px-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] transition-[border-color,box-shadow] duration-200",
          open
            ? "border-clay/50 shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
            : "border-ink/12 focus-within:border-clay/50 focus-within:shadow-[0_0_0_3px_rgba(156,107,74,0.12)]",
        ].join(" ")}
      >
        <Search
          size={17}
          strokeWidth={2}
          className="shrink-0 text-clay/75"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          className="min-w-0 flex-1 border-0 bg-transparent py-[0.82rem] text-[0.95rem] leading-[1.3] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink/38"
          value={query}
          placeholder="Например: Московский пр., 71"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showList}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          role="combobox"
          onChange={(e) => {
            setPicked(false);
            setQuery(e.target.value);
          }}
          onFocus={() => {
            focusedRef.current = true;
            if (items.length > 0 && !picked) setOpen(true);
          }}
          onBlur={() => {
            // Delay so option click can fire before close.
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                focusedRef.current = false;
                setOpen(false);
              }
            }, 120);
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-ink/[0.05] text-ink/55 transition-colors hover:bg-ink/10 hover:text-ink"
            aria-label="Очистить адрес"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
          >
            <X size={15} strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
      </div>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-40 overflow-hidden rounded-[18px] border border-ink/10 bg-paper/98 shadow-[0_18px_48px_rgba(33,30,25,0.16)] backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
        >
          {busy && !items.length ? (
            <div className="flex items-center gap-3 px-4 py-4 text-[0.88rem] text-ink/50">
              <LoaderCircle
                size={16}
                strokeWidth={2}
                className="animate-spin text-clay motion-reduce:animate-none"
                aria-hidden
              />
              Ищем улицу и дом…
            </div>
          ) : null}

          {error && !busy ? (
            <div className="px-4 py-4">
              <p className="m-0 text-[0.9rem] font-[650] text-ink">{error}</p>
              <p className="mt-[0.35rem] m-0 text-[0.8rem] leading-[1.4] text-ink/50">
                Уточните номер дома или выберите точку на карте.
              </p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul className="m-0 max-h-[min(16rem,42vh)] list-none overflow-auto p-[0.4rem]">
              {items.map((item, index) => {
                const hasCoords = item.lat != null && item.lng != null;
                const active = index === activeIndex;
                return (
                  <li key={`${item.unrestricted_value}-${index}`} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                      className={[
                        "flex w-full cursor-pointer items-start gap-3 rounded-[14px] border-0 px-3 py-[0.7rem] text-left transition-[background-color,transform] duration-150",
                        active
                          ? "bg-clay/[0.11] text-ink"
                          : "bg-transparent text-ink hover:bg-ink/[0.035]",
                      ].join(" ")}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(item)}
                    >
                      <span
                        className={[
                          "mt-[0.1rem] inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                          active ? "bg-clay/18 text-clay" : "bg-ink/[0.05] text-ink/45",
                        ].join(" ")}
                        aria-hidden
                      >
                        <MapPinned size={15} strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.92rem] leading-[1.25] font-[650]">
                          {highlightMatch(item.label, query)}
                        </span>
                        <span className="mt-[0.2rem] block truncate text-[0.76rem] leading-[1.35] text-ink/48">
                          {item.unrestricted_value}
                        </span>
                        {!hasCoords ? (
                          <span className="mt-[0.25rem] block text-[0.72rem] font-[650] tracking-[0.04em] text-clay">
                            Уточните дом или карту
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
