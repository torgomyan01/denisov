"use client";

import { Home, LoaderCircle, MapPinned, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { suggestHouseAction, suggestStreetAction } from "@/actions/dadata";
import type { DadataAddressSuggestion } from "@/lib/dadata";

type AddressSuggestFieldProps = {
  initialQuery?: string;
  onPick: (suggestion: DadataAddressSuggestion) => void;
  /** Fired when user clears street/house so stale map coordinates are cleared too. */
  onClear?: () => void;
};

const highlightMatch = (text: string, query: string): ReactNode => {
  const q = query.trim();
  if (!q) return text;
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

const splitInitialAddress = (raw: string): { street: string; house: string } => {
  const cleaned = raw
    .trim()
    .replace(/^(?:россия\s*,\s*)?/i, "")
    .replace(/^(?:г\.?\s*)?санкт-петербург\s*,\s*/i, "")
    .trim();

  if (!cleaned) return { street: "", house: "" };

  const parts = cleaned
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (/^(?:д(?:ом)?\.?\s*)?\d+/i.test(last)) {
      const house = last.replace(/^д(?:ом)?\.?\s*/i, "").trim();
      const street = parts.slice(0, -1).join(", ");
      return { street, house };
    }
  }

  return { street: cleaned, house: "" };
};

export const AddressSuggestField = ({
  initialQuery = "",
  onPick,
  onClear,
}: AddressSuggestFieldProps) => {
  const streetListId = useId();
  const houseListId = useId();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const houseInputRef = useRef<HTMLInputElement | null>(null);

  const streetFocusedRef = useRef(false);
  const houseFocusedRef = useRef(false);
  const skipNextStreetRef = useRef(false);
  const skipNextHouseRef = useRef(false);
  const streetReqSeqRef = useRef(0);
  const houseReqSeqRef = useRef(0);

  const initialParts = splitInitialAddress(initialQuery);

  const [streetQuery, setStreetQuery] = useState(initialParts.street);
  const [streetFiasId, setStreetFiasId] = useState<string | null>(null);
  const [streetPicked, setStreetPicked] = useState(Boolean(initialParts.street));
  const [streetItems, setStreetItems] = useState<DadataAddressSuggestion[]>([]);
  const [streetOpen, setStreetOpen] = useState(false);
  const [streetBusy, setStreetBusy] = useState(false);
  const [streetError, setStreetError] = useState("");
  const [streetActiveIdx, setStreetActiveIdx] = useState(-1);

  const [houseQuery, setHouseQuery] = useState(initialParts.house);
  const [housePicked, setHousePicked] = useState(Boolean(initialParts.house));
  const [houseItems, setHouseItems] = useState<DadataAddressSuggestion[]>([]);
  const [houseOpen, setHouseOpen] = useState(false);
  const [houseBusy, setHouseBusy] = useState(false);
  const [houseError, setHouseError] = useState("");
  const [houseActiveIdx, setHouseActiveIdx] = useState(-1);

  // Sync from parent only when neither field is focused.
  useEffect(() => {
    if (streetFocusedRef.current || houseFocusedRef.current) return;
    const parts = splitInitialAddress(initialQuery);
    setStreetQuery(parts.street);
    setStreetPicked(Boolean(parts.street));
    setStreetItems([]);
    setStreetOpen(false);
    setStreetError("");
    setHouseQuery(parts.house);
    setHousePicked(Boolean(parts.house));
    setHouseItems([]);
    setHouseOpen(false);
    setHouseError("");
  }, [initialQuery]);

  // Street suggestions
  useEffect(() => {
    if (skipNextStreetRef.current) {
      skipNextStreetRef.current = false;
      setStreetBusy(false);
      return;
    }

    const q = streetQuery.trim();
    if (q.length < 2 || streetPicked) {
      if (q.length < 2) {
        setStreetItems([]);
        setStreetError("");
        setStreetOpen(false);
      }
      setStreetBusy(false);
      return;
    }

    let cancelled = false;
    const seq = ++streetReqSeqRef.current;
    const timer = window.setTimeout(() => {
      setStreetBusy(true);
      void (async () => {
        const result = await suggestStreetAction(q);
        if (cancelled || seq !== streetReqSeqRef.current) return;
        setStreetBusy(false);
        if (!result.success || !result.data) {
          setStreetItems([]);
          setStreetError(result.success ? "Улица не найдена" : result.error);
          setStreetOpen(streetFocusedRef.current);
          setStreetActiveIdx(-1);
          return;
        }
        setStreetError("");
        setStreetItems(result.data);
        setStreetOpen(streetFocusedRef.current && result.data.length > 0);
        setStreetActiveIdx(result.data.length ? 0 : -1);
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [streetQuery, streetPicked]);

  // House suggestions restricted to selected street
  useEffect(() => {
    if (skipNextHouseRef.current) {
      skipNextHouseRef.current = false;
      setHouseBusy(false);
      return;
    }

    const q = houseQuery.trim();
    const street = streetQuery.trim();
    if (!q || !street || housePicked) {
      if (!q) {
        setHouseItems([]);
        setHouseError("");
        setHouseOpen(false);
      }
      setHouseBusy(false);
      return;
    }

    let cancelled = false;
    const seq = ++houseReqSeqRef.current;
    const timer = window.setTimeout(() => {
      setHouseBusy(true);
      void (async () => {
        const result = await suggestHouseAction({
          streetFiasId,
          street,
          query: q,
        });
        if (cancelled || seq !== houseReqSeqRef.current) return;
        setHouseBusy(false);
        if (!result.success || !result.data) {
          setHouseItems([]);
          setHouseError(result.success ? "Дом не найден" : result.error);
          setHouseOpen(houseFocusedRef.current);
          setHouseActiveIdx(-1);
          return;
        }
        setHouseError("");
        setHouseItems(result.data);
        setHouseOpen(houseFocusedRef.current && result.data.length > 0);
        setHouseActiveIdx(result.data.length ? 0 : -1);
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [houseQuery, housePicked, streetFiasId, streetQuery]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setStreetOpen(false);
        setHouseOpen(false);
        streetFocusedRef.current = false;
        houseFocusedRef.current = false;
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const pickStreet = (item: DadataAddressSuggestion) => {
    skipNextStreetRef.current = true;
    streetReqSeqRef.current += 1;
    const streetLabel = item.street || item.label || item.value;
    setStreetQuery(streetLabel);
    setStreetFiasId(item.streetFiasId ?? null);
    setStreetPicked(true);
    setStreetOpen(false);
    setStreetItems([]);
    setStreetError("");
    setStreetBusy(false);
    setStreetActiveIdx(-1);
    streetFocusedRef.current = false;

    // Reset house and move focus to House field
    skipNextHouseRef.current = true;
    houseReqSeqRef.current += 1;
    setHouseQuery("");
    setHousePicked(false);
    setHouseItems([]);
    setHouseError("");
    setHouseOpen(false);
    setHouseBusy(false);
    setHouseActiveIdx(-1);
    onClear?.();

    window.setTimeout(() => {
      houseInputRef.current?.focus();
    }, 20);
  };

  const pickHouse = (item: DadataAddressSuggestion) => {
    skipNextHouseRef.current = true;
    houseReqSeqRef.current += 1;
    const houseLabel = item.house || item.label || item.value;
    setHouseQuery(houseLabel);
    setHousePicked(true);
    setHouseOpen(false);
    setHouseItems([]);
    setHouseError("");
    setHouseBusy(false);
    setHouseActiveIdx(-1);
    houseFocusedRef.current = false;
    houseInputRef.current?.blur();

    onPick(item);
  };

  const clearStreet = () => {
    skipNextStreetRef.current = true;
    skipNextHouseRef.current = true;
    streetReqSeqRef.current += 1;
    houseReqSeqRef.current += 1;
    setStreetQuery("");
    setStreetFiasId(null);
    setStreetPicked(false);
    setStreetItems([]);
    setStreetOpen(false);
    setStreetError("");
    setStreetBusy(false);
    setStreetActiveIdx(-1);

    setHouseQuery("");
    setHousePicked(false);
    setHouseItems([]);
    setHouseOpen(false);
    setHouseError("");
    setHouseBusy(false);
    setHouseActiveIdx(-1);

    streetInputRef.current?.focus();
    streetFocusedRef.current = true;
    onClear?.();
  };

  const clearHouse = () => {
    skipNextHouseRef.current = true;
    houseReqSeqRef.current += 1;
    setHouseQuery("");
    setHousePicked(false);
    setHouseItems([]);
    setHouseOpen(false);
    setHouseError("");
    setHouseBusy(false);
    setHouseActiveIdx(-1);
    houseInputRef.current?.focus();
    houseFocusedRef.current = true;
    onClear?.();
  };

  const onStreetKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setStreetOpen(false);
      return;
    }
    if (!streetOpen || !streetItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setStreetActiveIdx((i) =>
        Math.min(streetItems.length - 1, Math.max(0, i) + 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setStreetActiveIdx((i) => Math.max(0, i - 1));
    } else if (
      e.key === "Enter" &&
      streetActiveIdx >= 0 &&
      streetItems[streetActiveIdx]
    ) {
      e.preventDefault();
      pickStreet(streetItems[streetActiveIdx]!);
    }
  };

  const onHouseKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setHouseOpen(false);
      return;
    }
    if (!houseOpen || !houseItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHouseActiveIdx((i) =>
        Math.min(houseItems.length - 1, Math.max(0, i) + 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHouseActiveIdx((i) => Math.max(0, i - 1));
    } else if (
      e.key === "Enter" &&
      houseActiveIdx >= 0 &&
      houseItems[houseActiveIdx]
    ) {
      e.preventDefault();
      pickHouse(houseItems[houseActiveIdx]!);
    }
  };

  const showStreetList =
    streetOpen && (streetItems.length > 0 || Boolean(streetError) || streetBusy);
  const showHouseList =
    houseOpen && (houseItems.length > 0 || Boolean(houseError) || houseBusy);
  const houseDisabled = !streetQuery.trim();

  return (
    <div
      ref={rootRef}
      className="relative z-30 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_8.75rem]"
    >
      {/* Street field */}
      <div className="relative flex flex-col gap-[0.45rem]">
        <div className="flex items-end justify-between gap-2">
          <label
            htmlFor={`${streetListId}-input`}
            className="text-[10px] font-bold tracking-[0.14em] text-ink/48 uppercase"
          >
            Улица
          </label>
          {streetBusy ? (
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
            streetOpen
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
            ref={streetInputRef}
            id={`${streetListId}-input`}
            type="text"
            className="min-w-0 flex-1 border-0 bg-transparent py-[0.82rem] text-[0.95rem] leading-[1.3] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink/38"
            value={streetQuery}
            placeholder="Например: Московский пр."
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls={streetListId}
            aria-expanded={showStreetList}
            aria-activedescendant={
              streetActiveIdx >= 0
                ? `${streetListId}-opt-${streetActiveIdx}`
                : undefined
            }
            role="combobox"
            onChange={(e) => {
              setStreetPicked(false);
              setStreetFiasId(null);
              setStreetQuery(e.target.value);
            }}
            onFocus={() => {
              streetFocusedRef.current = true;
              setHouseOpen(false);
              if (streetItems.length > 0 && !streetPicked) setStreetOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                if (!rootRef.current?.contains(document.activeElement)) {
                  streetFocusedRef.current = false;
                  setStreetOpen(false);
                }
              }, 120);
            }}
            onKeyDown={onStreetKeyDown}
          />
          {streetQuery ? (
            <button
              type="button"
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-ink/[0.05] text-ink/55 transition-colors hover:bg-ink/10 hover:text-ink"
              aria-label="Очистить улицу"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearStreet}
            >
              <X size={15} strokeWidth={2.2} aria-hidden />
            </button>
          ) : null}
        </div>

        {showStreetList ? (
          <div
            id={streetListId}
            role="listbox"
            className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-40 overflow-hidden rounded-[18px] border border-ink/10 bg-paper/98 shadow-[0_18px_48px_rgba(33,30,25,0.16)] backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
          >
            {streetBusy && !streetItems.length ? (
              <div className="flex items-center gap-3 px-4 py-4 text-[0.88rem] text-ink/50">
                <LoaderCircle
                  size={16}
                  strokeWidth={2}
                  className="animate-spin text-clay motion-reduce:animate-none"
                  aria-hidden
                />
                Ищем улицу…
              </div>
            ) : null}

            {streetError && !streetBusy ? (
              <div className="px-4 py-4">
                <p className="m-0 text-[0.9rem] font-[650] text-ink">
                  {streetError}
                </p>
                <p className="mt-[0.35rem] m-0 text-[0.8rem] leading-[1.4] text-ink/50">
                  Уточните название улицы или выберите точку на карте.
                </p>
              </div>
            ) : null}

            {streetItems.length > 0 ? (
              <ul className="m-0 max-h-[min(16rem,42vh)] list-none overflow-auto p-[0.4rem]">
                {streetItems.map((item, index) => {
                  const active = index === streetActiveIdx;
                  const title = item.street || item.label || item.value;
                  return (
                    <li
                      key={`${item.unrestricted_value}-${index}`}
                      id={`${streetListId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                    >
                      <button
                        type="button"
                        className={[
                          "flex w-full cursor-pointer items-start gap-[0.65rem] rounded-[12px] border-0 px-[0.72rem] py-[0.65rem] text-left transition-colors duration-120",
                          active
                            ? "bg-clay/11"
                            : "bg-transparent hover:bg-clay/11",
                        ].join(" ")}
                        onMouseEnter={() => setStreetActiveIdx(index)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickStreet(item);
                        }}
                      >
                        <MapPinned
                          size={15}
                          strokeWidth={1.9}
                          className="mt-[0.12rem] shrink-0 text-clay"
                          aria-hidden
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-[0.14rem]">
                          <span className="text-[0.9rem] leading-[1.28] font-[650] text-ink">
                            {highlightMatch(title, streetQuery)}
                          </span>
                          {item.value && item.value !== title ? (
                            <span className="overflow-hidden text-[0.76rem] leading-[1.3] text-ellipsis whitespace-nowrap text-ink/46">
                              {item.value}
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

      {/* House field (filtered by selected street) */}
      <div className="relative flex flex-col gap-[0.45rem]">
        <div className="flex items-end justify-between gap-2">
          <label
            htmlFor={`${houseListId}-input`}
            className="text-[10px] font-bold tracking-[0.14em] text-ink/48 uppercase"
          >
            Дом
          </label>
          {houseBusy ? (
            <LoaderCircle
              size={12}
              strokeWidth={2.2}
              className="animate-spin text-ink/42 motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
        </div>

        <div
          className={[
            "group relative flex items-center gap-1.5 rounded-[16px] border px-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] transition-[border-color,box-shadow] duration-200",
            houseDisabled
              ? "border-ink/8 bg-sand/50 opacity-65"
              : houseOpen
                ? "border-clay/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(251,248,241,0.88))] shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
                : "border-ink/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(251,248,241,0.88))] focus-within:border-clay/50 focus-within:shadow-[0_0_0_3px_rgba(156,107,74,0.12)]",
          ].join(" ")}
        >
          <Home
            size={15}
            strokeWidth={2}
            className="shrink-0 text-clay/70"
            aria-hidden
          />
          <input
            ref={houseInputRef}
            id={`${houseListId}-input`}
            type="text"
            disabled={houseDisabled}
            className="min-w-0 flex-1 border-0 bg-transparent py-[0.82rem] text-[0.95rem] leading-[1.3] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink/38 disabled:cursor-not-allowed"
            value={houseQuery}
            placeholder={houseDisabled ? "Улица" : "71"}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls={houseListId}
            aria-expanded={showHouseList}
            aria-activedescendant={
              houseActiveIdx >= 0
                ? `${houseListId}-opt-${houseActiveIdx}`
                : undefined
            }
            role="combobox"
            onChange={(e) => {
              setHousePicked(false);
              setHouseQuery(e.target.value);
            }}
            onFocus={() => {
              houseFocusedRef.current = true;
              setStreetOpen(false);
              if (houseItems.length > 0 && !housePicked) setHouseOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                if (!rootRef.current?.contains(document.activeElement)) {
                  houseFocusedRef.current = false;
                  setHouseOpen(false);
                }
              }, 120);
            }}
            onKeyDown={onHouseKeyDown}
          />
          {houseQuery && !houseDisabled ? (
            <button
              type="button"
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-ink/[0.05] text-ink/55 transition-colors hover:bg-ink/10 hover:text-ink"
              aria-label="Очистить дом"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearHouse}
            >
              <X size={14} strokeWidth={2.2} aria-hidden />
            </button>
          ) : null}
        </div>

        {showHouseList ? (
          <div
            id={houseListId}
            role="listbox"
            className="absolute top-[calc(100%+0.4rem)] right-0 z-40 min-w-[13rem] overflow-hidden rounded-[18px] border border-ink/10 bg-paper/98 shadow-[0_18px_48px_rgba(33,30,25,0.16)] backdrop-blur-sm animate-fade-in motion-reduce:animate-none sm:left-auto"
          >
            {houseBusy && !houseItems.length ? (
              <div className="flex items-center gap-2.5 px-3.5 py-3 text-[0.84rem] text-ink/50">
                <LoaderCircle
                  size={15}
                  strokeWidth={2}
                  className="animate-spin text-clay motion-reduce:animate-none"
                  aria-hidden
                />
                Ищем дом…
              </div>
            ) : null}

            {houseError && !houseBusy ? (
              <div className="px-3.5 py-3">
                <p className="m-0 text-[0.85rem] font-[650] text-ink">
                  {houseError}
                </p>
              </div>
            ) : null}

            {houseItems.length > 0 ? (
              <ul className="m-0 max-h-[min(15rem,40vh)] list-none overflow-auto p-[0.35rem]">
                {houseItems.map((item, index) => {
                  const active = index === houseActiveIdx;
                  const houseLabel = item.house || item.label || item.value;
                  return (
                    <li
                      key={`${item.unrestricted_value}-${index}`}
                      id={`${houseListId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                    >
                      <button
                        type="button"
                        className={[
                          "flex w-full cursor-pointer items-center gap-2 rounded-[11px] border-0 px-[0.65rem] py-[0.55rem] text-left transition-colors duration-120",
                          active
                            ? "bg-clay/11"
                            : "bg-transparent hover:bg-clay/11",
                        ].join(" ")}
                        onMouseEnter={() => setHouseActiveIdx(index)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickHouse(item);
                        }}
                      >
                        <Home
                          size={14}
                          strokeWidth={1.9}
                          className="shrink-0 text-clay"
                          aria-hidden
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[0.9rem] leading-[1.25] font-[650] text-ink">
                            {highlightMatch(houseLabel, houseQuery)}
                          </span>
                          {item.street ? (
                            <span className="overflow-hidden text-[0.72rem] leading-[1.25] text-ellipsis whitespace-nowrap text-ink/46">
                              {item.street}
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
    </div>
  );
};
