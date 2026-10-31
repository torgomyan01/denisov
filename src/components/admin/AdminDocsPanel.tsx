"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ADMIN_DOC_CATEGORIES,
  type AdminDocBlock,
  type AdminDocSection,
} from "@/lib/admin-docs";

const blockText = (block: AdminDocBlock): string => {
  switch (block.type) {
    case "p":
    case "note":
      return block.text;
    case "ol":
    case "ul":
      return block.items.join(" ");
    case "table":
      return `${block.headers.join(" ")} ${block.rows.flat().join(" ")}`;
    default:
      return "";
  }
};

const sectionMatches = (section: AdminDocSection, q: string): boolean => {
  if (!q) return true;
  const hay = [
    section.title,
    section.summary,
    ...section.blocks.map(blockText),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
};

const DocBlocks = ({ blocks }: { blocks: AdminDocBlock[] }) => (
  <div className="flex flex-col gap-3 border-t border-ink/8 px-[1.05rem] pt-3 pb-[1.05rem] text-[0.92rem] leading-[1.55] text-ink/78">
    {blocks.map((block, i) => {
      if (block.type === "p") {
        return (
          <p key={i} className="m-0">
            {block.text}
          </p>
        );
      }
      if (block.type === "note") {
        return (
          <p
            key={i}
            className="m-0 rounded-xl border border-clay/25 bg-clay/8 px-3 py-2.5 text-[0.88rem] text-ink/75"
          >
            {block.text}
          </p>
        );
      }
      if (block.type === "ol") {
        return (
          <ol
            key={i}
            className="m-0 list-decimal space-y-1.5 pl-5 marker:font-[650] marker:text-clay"
          >
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ol>
        );
      }
      if (block.type === "ul") {
        return (
          <ul key={i} className="m-0 list-disc space-y-1.5 pl-5 marker:text-clay">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        );
      }
      return (
        <div key={i} className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full min-w-[28rem] border-collapse text-left text-[0.85rem]">
            <thead>
              <tr className="bg-ink/[0.04]">
                {block.headers.map((h) => (
                  <th
                    key={h}
                    className="border-b border-ink/10 px-3 py-2 font-[650] tracking-[0.02em] text-ink"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="odd:bg-white/40">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-ink/6 px-3 py-2 align-top text-ink/75"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    })}
  </div>
);

export const AdminDocsPanel = () => {
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ADMIN_DOC_CATEGORIES.map((c) => [c.id, false])),
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return ADMIN_DOC_CATEGORIES;
    return ADMIN_DOC_CATEGORIES.map((cat) => {
      const catHit =
        cat.title.toLowerCase().includes(normalizedQuery) ||
        cat.summary.toLowerCase().includes(normalizedQuery);
      const sections = catHit
        ? cat.sections
        : cat.sections.filter((s) => sectionMatches(s, normalizedQuery));
      return { ...cat, sections };
    }).filter((cat) => cat.sections.length > 0);
  }, [normalizedQuery]);

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllMatches = () => {
    if (!normalizedQuery) return;
    const cats: Record<string, boolean> = {};
    const secs: Record<string, boolean> = {};
    for (const cat of filtered) {
      cats[cat.id] = true;
      for (const s of cat.sections) secs[s.id] = true;
    }
    setOpenCategories((prev) => ({ ...prev, ...cats }));
    setOpenSections((prev) => ({ ...prev, ...secs }));
  };

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">
            Инструкции
          </h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Полная документация по работе с сайтом и админкой. Откройте нужный
            раздел — или найдите по слову.
          </p>
        </div>
      </div>
      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[min(100%,20rem)] flex-1">
          <Search
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink/35"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") expandAllMatches();
            }}
            placeholder="Поиск: заказ, QR, Telegram, сохранить…"
            className="w-full rounded-full border border-ink/12 bg-paper/80 py-2.5 pr-4 pl-10 text-[0.92rem] text-ink outline-none placeholder:text-ink/35 focus:border-clay/45 focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
          />
        </label>
        {normalizedQuery ? (
          <button
            type="button"
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-ink/12 bg-transparent px-4 text-[11px] font-[650] tracking-[0.1em] text-ink/70 uppercase hover:border-clay/30 hover:bg-clay/6"
            onClick={expandAllMatches}
          >
            Открыть найденное
          </button>
        ) : null}
      </div>

      {!filtered.length ? (
        <p className="py-8 text-center font-serif text-ink/45 italic">
          Ничего не найдено — попробуйте другое слово
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((cat) => {
            const catOpen =
              Boolean(openCategories[cat.id]) || Boolean(normalizedQuery);
            return (
              <div
                key={cat.id}
                className="overflow-hidden rounded-2xl border border-ink/10 bg-paper/55"
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-3 px-[1.05rem] py-[0.95rem] text-left transition-colors hover:bg-clay/[0.04]"
                  aria-expanded={catOpen}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[1.2rem] leading-[1.2] tracking-[0.02em] text-ink">
                      {cat.title}
                    </span>
                    <span className="mt-1 block text-[0.82rem] text-ink/48">
                      {cat.summary}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    className={`mt-1 shrink-0 text-clay transition-transform duration-200 ${
                      catOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>

                {catOpen ? (
                  <div className="flex flex-col gap-2 border-t border-ink/8 bg-white/50 px-3 py-3">
                    {cat.sections.map((section) => {
                      const secOpen = Boolean(openSections[section.id]);
                      return (
                        <div
                          key={section.id}
                          className="overflow-hidden rounded-xl border border-ink/8 bg-white/80"
                        >
                          <button
                            type="button"
                            className="flex w-full cursor-pointer items-start gap-2 px-[1.05rem] py-3 text-left hover:bg-sand/40"
                            aria-expanded={secOpen}
                            onClick={() => toggleSection(section.id)}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-[0.95rem] font-[650] text-ink">
                                {section.title}
                              </span>
                              <span className="mt-0.5 block text-[0.8rem] text-ink/45">
                                {section.summary}
                              </span>
                            </span>
                            <ChevronDown
                              size={16}
                              strokeWidth={2}
                              className={`mt-0.5 shrink-0 text-ink/35 transition-transform duration-200 ${
                                secOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden
                            />
                          </button>
                          {secOpen ? (
                            <DocBlocks blocks={section.blocks} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
