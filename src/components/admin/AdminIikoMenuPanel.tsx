"use client";

import {
  patchIikoCategoryFlagsAction,
  patchIikoMenuFlagsAction,
  reorderIikoCategoriesAction,
  upsertIikoMenuOverrideAction,
  uploadIikoMenuImageAction,
} from "@/actions/iiko-menu";
import { DndProvider, SortableItem } from "@/components/admin/dnd";
import {
  btnDark,
  btnLine,
  btnSmGhost,
  cx,
} from "@/components/admin/styles";
import { Field, ToggleField } from "@/components/admin/ui";
import { compressProductImageForUpload } from "@/lib/compress-image-client";
import {
  formatUploadLimitError,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/lib/upload-limits";
import type { MenuCategory, MenuItem, SiteData } from "@/types/site";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Compact inline switch for product cards — label + tiny track only. */
const MiniSwitch = ({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    title={label}
    className={cx(
      "inline-flex items-center gap-1.5 rounded-md py-0.5 text-left",
      disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
    )}
    onClick={() => onChange(!checked)}
  >
    <span
      className={cx(
        "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
        checked ? "bg-clay" : "bg-ink/20",
      )}
      aria-hidden="true"
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-3" : "translate-x-0",
        )}
      />
    </span>
    <span
      className={cx(
        "font-sans text-[10px] font-semibold tracking-[0.02em]",
        checked ? "text-ink/75" : "text-ink/40",
      )}
    >
      {label}
    </span>
  </button>
);

type Props = {
  site: SiteData;
  busy: boolean;
  setBusy: (v: boolean) => void;
  showToast: (message: string, tone?: "success" | "error") => void;
  patchSite: (updater: (draft: SiteData) => void) => void;
  onSiteReload: (site: SiteData) => void;
};

type EditState = {
  categoryId: string;
  draft: MenuItem;
  clearImage: boolean;
};

const PRODUCT_UPLOAD_HINT = `JPG / PNG / WebP · до ${MAX_UPLOAD_LABEL} · админ-фото важнее iiko`;

export const AdminIikoMenuPanel = ({
  site,
  busy,
  setBusy,
  showToast,
  patchSite,
  onSiteReload,
}: Props) => {
  const [filter, setFilter] = useState("");
  /** Explicitly opened category ids. Closed by default (accordion). */
  const [openCatIds, setOpenCatIds] = useState<string[]>([]);
  const [edit, setEdit] = useState<EditState | null>(null);

  const categories = site.menu.categories || [];
  const itemCount = categories.reduce((n, c) => n + (c.items?.length || 0), 0);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        items: (cat.items || []).filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            it.description.toLowerCase().includes(q) ||
            it.iikoProductId.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0 || cat.name.toLowerCase().includes(q));
  }, [categories, filter]);

  const filterActive = filter.trim().length > 0;

  useEffect(() => {
    if (!filterActive) return;
    setOpenCatIds(filtered.map((c) => c.id));
  }, [filter, filterActive, filtered]);

  const toggleCat = (id: string) => {
    setOpenCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isCatOpen = (id: string) => openCatIds.includes(id);

  const openEdit = (categoryId: string, item: MenuItem) => {
    setEdit({
      categoryId,
      draft: { ...item },
      clearImage: false,
    });
  };

  const patchDraft = (updater: (row: MenuItem) => void) => {
    setEdit((prev) => {
      if (!prev) return prev;
      const draft = { ...prev.draft };
      updater(draft);
      return { ...prev, draft };
    });
  };

  const saveOverride = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const result = await upsertIikoMenuOverrideAction({
        iikoProductId: edit.draft.id,
        name: edit.draft.name,
        description: edit.draft.description,
        price: edit.draft.price,
        weight: edit.draft.weight,
        kcal: edit.draft.kcal,
        protein: edit.draft.protein,
        fat: edit.draft.fat,
        carbs: edit.draft.carbs,
        showInDelivery: edit.draft.showInDelivery,
        inStock: edit.draft.inStock,
        showInUpsell: edit.draft.showInUpsell,
        upsellSortOrder: edit.draft.upsellSortOrder,
        clearImage: edit.clearImage,
        image: edit.clearImage ? undefined : edit.draft.image || undefined,
      });
      if (!result.success || !result.data) {
        showToast(
          !result.success ? result.error : "Не сохранено",
          "error",
        );
        return;
      }
      onSiteReload(result.data);
      setEdit(null);
      showToast("Позиция сохранена");
    } finally {
      setBusy(false);
    }
  };

  const quickToggle = async (
    item: MenuItem,
    patch: Partial<Pick<MenuItem, "inStock" | "showInDelivery" | "showInUpsell">>,
  ) => {
    setBusy(true);
    try {
      const result = await patchIikoMenuFlagsAction({
        iikoProductId: item.id,
        showInDelivery:
          patch.showInDelivery ?? item.showInDelivery !== false,
        inStock: patch.inStock ?? item.inStock !== false,
        showInUpsell: patch.showInUpsell ?? Boolean(item.showInUpsell),
      });
      if (!result.success || !result.data) {
        showToast(
          !result.success ? result.error : "Не обновлено",
          "error",
        );
        return;
      }
      onSiteReload(result.data);
      showToast("Обновлено");
    } finally {
      setBusy(false);
    }
  };

  const toggleCategoryOnSite = async (
    cat: MenuCategory,
    index: number,
    nextShowOnSite: boolean,
  ) => {
    patchSite((draft) => {
      const row = draft.menu.categories.find((c) => c.id === cat.id);
      if (row) row.showOnSite = nextShowOnSite;
    });
    setBusy(true);
    try {
      const result = await patchIikoCategoryFlagsAction({
        iikoCategoryId: cat.id,
        showOnSite: nextShowOnSite,
        sortHint: index,
      });
      if (!result.success || !result.data) {
        patchSite((draft) => {
          const row = draft.menu.categories.find((c) => c.id === cat.id);
          if (row) row.showOnSite = cat.showOnSite !== false;
        });
        showToast(
          !result.success ? result.error : "Не обновлено",
          "error",
        );
        return;
      }
      onSiteReload(result.data);
      showToast(
        nextShowOnSite
          ? "Категория снова на сайте"
          : "Категория скрыта с сайта",
      );
    } finally {
      setBusy(false);
    }
  };

  const reorderCategories = async (from: number, to: number) => {
    if (filterActive || from === to) return;
    const next = [...categories];
    const [row] = next.splice(from, 1);
    if (!row) return;
    next.splice(to, 0, row);
    patchSite((d) => {
      d.menu.categories = next;
    });
    setBusy(true);
    try {
      const result = await reorderIikoCategoriesAction({
        orderedIds: next.map((c) => c.id),
      });
      if (!result.success || !result.data) {
        showToast(
          !result.success ? result.error : "Не удалось сохранить порядок",
          "error",
        );
        return;
      }
      onSiteReload(result.data);
    } finally {
      setBusy(false);
    }
  };

  const renderCategoryProducts = (cat: MenuCategory) => (
    <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cat.items.map((item) => {
        const onSite = item.showInDelivery !== false;
        const inStock = item.inStock !== false;
        return (
          <li
            key={item.id}
            className={cx(
              "group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_8px_24px_rgba(33,30,25,0.04)] transition",
              !onSite || !inStock ? "opacity-55" : "opacity-100",
            )}
          >
            <button
              type="button"
              className="relative aspect-[4/5] w-full bg-sand text-left"
              disabled={busy}
              onClick={() => openEdit(cat.id, item)}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex size-full items-center justify-center px-3 text-center font-sans text-[9px] uppercase tracking-[0.18em] text-ink/30">
                  нет фото
                </div>
              )}
              <span className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.12em] text-paper opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                Изменить
              </span>
            </button>

            <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2.5 pt-2">
              <div className="min-w-0">
                <p className="line-clamp-2 font-serif text-[14px] leading-snug tracking-tight">
                  {item.name}
                </p>
                <p className="mt-1 font-sans text-[12px] text-ink/65">
                  {item.price ? `${item.price} ₽` : "—"}
                  {item.weight ? (
                    <span className="text-ink/35"> · {item.weight}</span>
                  ) : null}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/6 pt-2">
                <MiniSwitch
                  label="В наличии"
                  checked={inStock}
                  disabled={busy}
                  onChange={(next) =>
                    void quickToggle(item, { inStock: next })
                  }
                />
                <MiniSwitch
                  label="На сайте"
                  checked={onSite}
                  disabled={busy}
                  onChange={(next) =>
                    void quickToggle(item, { showInDelivery: next })
                  }
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const uploadImage = async (productId: string, file: File) => {
    if (!file || file.size <= 0) {
      showToast("Файл пустой. Выберите другое фото.", "error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(formatUploadLimitError(file.size), "error");
      return;
    }

    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
    if (!looksLikeImage) {
      showToast(
        "Нужен файл изображения (JPG, PNG или WebP). Выберите другое фото.",
        "error",
      );
      return;
    }

    setBusy(true);
    try {
      let uploadFile = file;
      try {
        uploadFile = await compressProductImageForUpload(file);
      } catch {
        showToast(
          "Не удалось обработать фото. Выберите другое изображение.",
          "error",
        );
        return;
      }

      if (uploadFile.size > MAX_UPLOAD_BYTES) {
        showToast(
          `После обработки файл всё ещё больше ${MAX_UPLOAD_LABEL}. Выберите другое фото.`,
          "error",
        );
        return;
      }

      const fd = new FormData();
      fd.append("iikoProductId", productId);
      fd.append("file", uploadFile, uploadFile.name || file.name);
      const result = await uploadIikoMenuImageAction(fd);
      if (!result.success || !result.data) {
        showToast(
          !result.success ? result.error : "Ошибка загрузки",
          "error",
        );
        return;
      }
      onSiteReload(result.data.site);
      setEdit((prev) =>
        prev && prev.draft.id === productId
          ? {
              ...prev,
              clearImage: false,
              draft: { ...prev.draft, image: result.data!.url },
            }
          : prev,
      );
      showToast("Фото загружено");
    } catch {
      showToast("Не удалось загрузить фото. Выберите другое изображение.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
        <div className="mb-[1.1rem]">
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">
            Меню (iiko)
          </h2>
          <p className="mt-[0.4rem] max-w-[46rem] text-[0.92rem] leading-normal text-ink/48">
            {categories.length} категорий · {itemCount} позиций из iiko.
            Пустые поля в карточке = значение из iiko. Заполненные в админке —
            приоритетнее. Фото: своё или из iiko.
          </p>
        </div>
        <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Заголовок меню"
            value={site.menu.title}
            placeholder="Меню"
            onChange={(v) =>
              patchSite((d) => {
                d.menu.title = v;
              })
            }
          />
          <Field
            label="Подпись внизу"
            value={site.menu.note}
            placeholder="Цены указаны в рублях"
            onChange={(v) =>
              patchSite((d) => {
                d.menu.note = v;
              })
            }
          />
          <div className="col-span-full">
            <Field
              label="Поиск"
              value={filter}
              placeholder="Название или productId"
              onChange={setFilter}
            />
          </div>
        </div>

        {!categories.length ? (
          <p className="mt-8 text-sm text-ink/55">
            Нет позиций из iiko. Проверьте API-ключи и внешнее меню «Сайт».
          </p>
        ) : (
          <>
          <p className="mt-6 font-sans text-[11px] text-ink/45">
            {filterActive
              ? "При поиске порядок категорий временно нельзя менять."
              : "Тяните ⋮⋮ чтобы изменить порядок категорий на сайте."}
          </p>
          <DndProvider>
            <div className="mt-3 space-y-2">
              {filtered.map((cat) => {
                const fullIndex = categories.findIndex((c) => c.id === cat.id);
                const open = isCatOpen(cat.id);
                const panelId = `iiko-cat-panel-${cat.id}`;
                const onSite = cat.showOnSite !== false;
                const header = (
                  <div
                    className={cx(
                      "flex w-full items-center gap-2 px-3 py-3 transition-colors sm:gap-3 sm:px-4",
                      open ? "bg-sand/50" : "bg-transparent",
                      !onSite && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      id={`iiko-cat-trigger-${cat.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => toggleCat(cat.id)}
                    >
                      <ChevronDown
                        className={cx(
                          "size-4 shrink-0 text-clay transition-transform duration-200",
                          open ? "rotate-0" : "-rotate-90",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 font-serif text-[1.15rem] leading-none tracking-tight sm:text-[1.2rem]">
                        {cat.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-ink/6 px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
                        {cat.items.length}
                      </span>
                    </button>
                    <div
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <MiniSwitch
                        label="На сайте"
                        checked={onSite}
                        disabled={busy}
                        onChange={(next) =>
                          void toggleCategoryOnSite(
                            cat,
                            fullIndex >= 0 ? fullIndex : 0,
                            next,
                          )
                        }
                      />
                    </div>
                  </div>
                );

                const body = (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={`iiko-cat-trigger-${cat.id}`}
                    hidden={!open}
                    className={cx(
                      "border-t border-ink/8",
                      open ? "block" : "hidden",
                    )}
                  >
                    {renderCategoryProducts(cat)}
                  </div>
                );

                if (filterActive) {
                  return (
                    <div
                      key={cat.id}
                      className="overflow-hidden rounded-2xl border border-ink/10 bg-white/85"
                    >
                      {header}
                      {body}
                    </div>
                  );
                }

                return (
                  <SortableItem
                    key={cat.id}
                    group="iiko-categories"
                    index={fullIndex}
                    onReorder={(from, to) => void reorderCategories(from, to)}
                    bodyClassName="overflow-hidden rounded-2xl border border-ink/10 bg-white/85"
                  >
                    <>
                      {header}
                      {body}
                    </>
                  </SortableItem>
                );
              })}
            </div>
          </DndProvider>
          </>
        )}
      </section>

      {edit ? (
        <div
          className="fixed inset-0 z-[68] grid animate-fade-in place-items-center bg-[#181612]/55 p-4 backdrop-blur-[6px]"
          role="presentation"
          onClick={() => setEdit(null)}
        >
          <div
            className="max-h-[min(92vh,44rem)] w-[min(720px,100%)] animate-panel-in overflow-auto rounded-[20px] border border-ink/12 bg-paper px-[1.3rem] pt-5 pb-[1.15rem] shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-clay">
                  iiko · карточка
                </p>
                <h3 className="mt-1 font-serif text-2xl leading-tight">
                  {edit.draft.name || "Позиция"}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-ink/35">
                  {edit.draft.id}
                </p>
              </div>
              <button type="button" className={btnLine} onClick={() => setEdit(null)}>
                Закрыть
              </button>
            </div>

            <div className="mb-4 overflow-hidden rounded-xl bg-sand">
              <div className="aspect-[4/3] sm:aspect-[16/9]">
                {edit.draft.image && !edit.clearImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={edit.draft.image}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center font-sans text-xs uppercase tracking-[0.16em] text-ink/35">
                    нет фото
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-ink/8 p-3">
                <label className={cx(btnSmGhost, "cursor-pointer")}>
                  Загрузить фото
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadImage(edit.draft.id, file);
                    }}
                  />
                </label>
                {edit.draft.image ? (
                  <button
                    type="button"
                    className={btnSmGhost}
                    disabled={busy}
                    onClick={() =>
                      setEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              clearImage: true,
                              draft: { ...prev.draft, image: "" },
                            }
                          : prev,
                      )
                    }
                  >
                    Убрать фото админа
                  </button>
                ) : null}
                <p className="w-full text-[11px] text-ink/45">{PRODUCT_UPLOAD_HINT}</p>
              </div>
            </div>

            <div className="grid gap-3">
              <Field
                label="Название (пусто = из iiko)"
                value={edit.draft.name}
                onChange={(v) => patchDraft((row) => { row.name = v; })}
              />
              <Field
                label="Описание (пусто = из iiko)"
                value={edit.draft.description}
                multiline
                onChange={(v) => patchDraft((row) => { row.description = v; })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Цена (пусто = из iiko)"
                  value={edit.draft.price}
                  onChange={(v) => patchDraft((row) => { row.price = v; })}
                />
                <Field
                  label="Вес (пусто = из iiko)"
                  value={edit.draft.weight}
                  onChange={(v) => patchDraft((row) => { row.weight = v; })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Показывать на сайте / в доставке"
                  checked={edit.draft.showInDelivery !== false}
                  onChange={(v) =>
                    patchDraft((row) => {
                      row.showInDelivery = v;
                    })
                  }
                />
                <ToggleField
                  label="В наличии"
                  checked={edit.draft.inStock !== false}
                  onChange={(v) =>
                    patchDraft((row) => {
                      row.inStock = v;
                    })
                  }
                />
                <ToggleField
                  label="Допродажа"
                  checked={Boolean(edit.draft.showInUpsell)}
                  onChange={(v) =>
                    patchDraft((row) => {
                      row.showInUpsell = v;
                    })
                  }
                />
                <Field
                  label="Порядок в допродаже"
                  type="number"
                  value={String(edit.draft.upsellSortOrder || 0)}
                  onChange={(v) =>
                    patchDraft((row) => {
                      const n = Number(v);
                      row.upsellSortOrder =
                        Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
                    })
                  }
                />
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-clay">
                КБЖУ (пустое = из iiko, если есть)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["kcal", "Ккал"],
                    ["protein", "Белки"],
                    ["fat", "Жиры"],
                    ["carbs", "Углеводы"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    type="number"
                    value={
                      edit.draft[key] != null ? String(edit.draft[key]) : ""
                    }
                    onChange={(v) =>
                      patchDraft((row) => {
                        if (!v.trim()) {
                          row[key] = null;
                          return;
                        }
                        const n = Number(v.replace(",", "."));
                        row[key] = Number.isFinite(n) ? n : null;
                      })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnLine}
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={btnDark}
                disabled={busy}
                onClick={() => void saveOverride()}
              >
                {busy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
