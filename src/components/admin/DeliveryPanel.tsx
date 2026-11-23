"use client";

import {
  btnDark,
  btnLine,
  btnSmDanger,
  btnSmGhost,
  cx,
  fieldClass,
} from "@/components/admin/styles";
import {
  createDeliveryZoneAction,
  deleteDeliveryZoneAction,
  getDeliverySettingsAdminAction,
  listDeliveryZonesAdminAction,
  updateDeliverySettingsAction,
  updateDeliveryZoneAction,
} from "@/actions/delivery-zones";
import { ConfirmModal, Field } from "@/components/admin/ui";
import { MapPickerLoading } from "@/components/maps/MapPickerLoading";
import {
  nextZoneColor,
  ZONE_COLOR_PALETTE,
  type DeliveryZoneAdmin,
} from "@/lib/delivery-zones";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import { formatPrice } from "@/lib/format";
import {
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const DeliveryZoneMap = dynamic(
  () =>
    import("@/components/admin/DeliveryZoneMap").then((m) => m.DeliveryZoneMap),
  {
    ssr: false,
    loading: () => (
      <MapPickerLoading heightClassName="h-[min(58vh,520px)]">
        Загрузка карты…
      </MapPickerLoading>
    ),
  },
);

type ZoneForm = {
  name: string;
  color: string;
  deliveryFee: string;
  freeDeliveryFrom: string;
  minOrderAmount: string;
  isActive: boolean;
  polygon: Array<[number, number]>;
};

type GlobalForm = {
  ordersEnabled: boolean;
  deliveryPayOnReceiptEnabled: boolean;
  title: string;
  subtitle: string;
  minOrderAmount: string;
  deliveryFee: string;
  freeDeliveryFrom: string;
};

const emptyZoneForm = (color: string): ZoneForm => ({
  name: "",
  color,
  deliveryFee: "0",
  freeDeliveryFrom: "0",
  minOrderAmount: "0",
  isActive: true,
  polygon: [],
});

const fromZone = (zone: DeliveryZoneAdmin): ZoneForm => ({
  name: zone.name,
  color: zone.color,
  deliveryFee: String(zone.deliveryFee),
  freeDeliveryFrom: String(zone.freeDeliveryFrom),
  minOrderAmount: String(zone.minOrderAmount),
  isActive: zone.isActive,
  polygon: zone.polygon,
});

const parseMoney = (raw: string): number => {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

const shellClass =
  "animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.25rem] pt-[1.25rem] pb-5 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.75rem] md:pt-7 md:pb-6";

const railClass =
  "flex flex-col rounded-[22px] border border-ink/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(251,248,241,0.72))] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";

const mapShellClass =
  "relative overflow-hidden rounded-[22px] border border-ink/10 bg-[#1a1713]/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

const ToggleRow = ({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3.5 py-3.5 transition-[border-color,background-color] duration-200 hover:border-ink/18">
    <span
      className={cx(
        "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-clay" : "bg-ink/18",
      )}
      aria-hidden
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200",
          checked && "translate-x-5",
        )}
      />
    </span>
    <span className="min-w-0">
      <strong className="block text-[0.92rem] font-[650] text-ink">{title}</strong>
      <span className="mt-[0.25rem] block text-[0.78rem] leading-[1.4] text-ink/52">
        {description}
      </span>
    </span>
    <input
      type="checkbox"
      className="sr-only"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

interface DeliveryPanelProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  showToast: (msg: string, tone?: "success" | "error") => void;
}

export const DeliveryPanel = ({
  busy,
  setBusy,
  showToast,
}: DeliveryPanelProps) => {
  const [zones, setZones] = useState<DeliveryZoneAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<GlobalForm | null>(null);
  const [form, setForm] = useState<ZoneForm>(() =>
    emptyZoneForm(ZONE_COLOR_PALETTE[0]),
  );
  const [globalForm, setGlobalForm] = useState<GlobalForm>({
    ordersEnabled: true,
    deliveryPayOnReceiptEnabled: false,
    title: createDefaultDeliverySettings().title,
    subtitle: createDefaultDeliverySettings().subtitle,
    minOrderAmount: "0",
    deliveryFee: "0",
    freeDeliveryFrom: "0",
  });
  const [pendingDelete, setPendingDelete] = useState<DeliveryZoneAdmin | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [zonesResult, settingsResult] = await Promise.all([
      listDeliveryZonesAdminAction(),
      getDeliverySettingsAdminAction(),
    ]);
    setLoading(false);

    if (!zonesResult.success || !zonesResult.data) {
      showToast(zonesResult.success ? "Ошибка" : zonesResult.error, "error");
      return;
    }
    setZones(zonesResult.data);

    if (settingsResult.success && settingsResult.data) {
      const d = settingsResult.data;
      setGlobalForm({
        ordersEnabled: d.ordersEnabled !== false,
        deliveryPayOnReceiptEnabled: d.deliveryPayOnReceiptEnabled === true,
        title: d.title,
        subtitle: d.subtitle,
        minOrderAmount: String(d.minOrderAmount ?? 0),
        deliveryFee: String(d.deliveryFee ?? 0),
        freeDeliveryFrom: String(d.freeDeliveryFrom ?? 0),
      });
    }
  }, [showToast]);

  useEffect(() => {
    // Initial fetch for zones + global delivery settings.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount load
    void load();
  }, [load]);

  const selected = useMemo(
    () => zones.find((z) => z.id === selectedId) ?? null,
    [zones, selectedId],
  );

  const activeCount = zones.filter(
    (z) => z.isActive && z.polygon.length >= 3,
  ).length;

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyZoneForm(nextZoneColor(zones.map((z) => z.color))));
    setDrawing(true);
  };

  const selectZone = (zone: DeliveryZoneAdmin) => {
    setCreating(false);
    setDrawing(false);
    setSelectedId(zone.id);
    setForm(fromZone(zone));
  };

  const cancelEdit = () => {
    setCreating(false);
    setDrawing(false);
    setSelectedId(null);
    setForm(emptyZoneForm(ZONE_COLOR_PALETTE[0]));
  };

  const openSettings = () => {
    setSettingsDraft({ ...globalForm });
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    if (busy) return;
    setSettingsOpen(false);
    setSettingsDraft(null);
  };

  const patchSettingsDraft = (patch: Partial<GlobalForm>) => {
    setSettingsDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const saveGlobal = async () => {
    if (busy || !settingsDraft) return;
    setBusy(true);
    const result = await updateDeliverySettingsAction({
      ordersEnabled: settingsDraft.ordersEnabled,
      deliveryPayOnReceiptEnabled: settingsDraft.deliveryPayOnReceiptEnabled,
      title: settingsDraft.title,
      subtitle: settingsDraft.subtitle,
      minOrderAmount: parseMoney(settingsDraft.minOrderAmount),
      deliveryFee: parseMoney(settingsDraft.deliveryFee),
      freeDeliveryFrom: parseMoney(settingsDraft.freeDeliveryFrom),
    });
    setBusy(false);
    if (!result.success) {
      showToast(result.error, "error");
      return;
    }
    setGlobalForm(settingsDraft);
    setSettingsOpen(false);
    setSettingsDraft(null);
    showToast("Настройки доставки сохранены", "success");
  };

  const saveZone = async () => {
    if (busy) return;
    if (form.polygon.length < 3) {
      showToast("Нарисуйте зону на карте (минимум 3 точки)", "error");
      return;
    }
    if (!form.name.trim()) {
      showToast("Укажите название зоны", "error");
      return;
    }

    setBusy(true);
    const payload = {
      name: form.name.trim(),
      color: form.color,
      polygon: form.polygon,
      deliveryFee: parseMoney(form.deliveryFee),
      freeDeliveryFrom: parseMoney(form.freeDeliveryFrom),
      minOrderAmount: parseMoney(form.minOrderAmount),
      isActive: form.isActive,
    };

    const result = creating
      ? await createDeliveryZoneAction(payload)
      : selected
        ? await updateDeliveryZoneAction({ id: selected.id, ...payload })
        : { success: false as const, error: "Зона не выбрана" };

    setBusy(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }

    showToast(creating ? "Зона создана" : "Зона сохранена", "success");
    setCreating(false);
    setDrawing(false);
    await load();
    setSelectedId(result.data.id);
    setForm(fromZone(result.data));
  };

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    const result = await deleteDeliveryZoneAction(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
    if (!result.success) {
      showToast(result.error, "error");
      return;
    }
    showToast("Зона удалена", "success");
    if (selectedId === pendingDelete.id) cancelEdit();
    await load();
  };

  const showEditor = creating || selected != null;
  const polygonReady = form.polygon.length >= 3;

  return (
    <section className={shellClass}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-semibold tracking-[0.22em] text-clay uppercase">
            Логистика
          </p>
          <h2 className="mt-1 mb-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.12] tracking-[0.02em] text-ink">
            Зоны доставки
          </h2>
          <p className="mt-[0.45rem] mb-0 max-w-[40rem] text-[0.92rem] leading-[1.45] text-ink/48">
            Обведите районы на карте — у каждой зоны своя цена. Клиент выбирает
            адрес только внутри контура.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-[0.4rem] rounded-full px-[0.75rem] py-[0.4rem] text-[10px] font-bold tracking-[0.1em] uppercase",
              globalForm.ordersEnabled
                ? "bg-[#5a7a60]/14 text-[#3d4a3a]"
                : "bg-danger/12 text-danger",
            )}
          >
            <span
              className={cx(
                "size-1.5 rounded-full",
                globalForm.ordersEnabled ? "bg-[#5a7a60]" : "bg-danger",
              )}
              aria-hidden
            />
            {globalForm.ordersEnabled ? "Заказы открыты" : "Заказы закрыты"}
          </span>
          <span className="inline-flex items-center rounded-full border border-ink/10 bg-white/70 px-[0.75rem] py-[0.4rem] text-[10px] font-bold tracking-[0.1em] text-ink/55 uppercase">
            {activeCount} активн.
          </span>
          <button
            type="button"
            className={btnLine}
            disabled={busy || loading}
            onClick={openSettings}
          >
            <Settings2 size={14} strokeWidth={2} aria-hidden />
            Настройки
          </button>
          <button
            type="button"
            className={btnLine}
            disabled={busy || loading}
            onClick={() => void load()}
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden />
            Обновить
          </button>
          <button
            type="button"
            className={btnDark}
            disabled={busy || drawing}
            onClick={startCreate}
          >
            <Plus size={15} strokeWidth={2.25} aria-hidden />
            Новая зона
          </button>
        </div>
      </header>

      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:items-start">
        <aside className={`${railClass} min-h-[28rem] px-[0.9rem] py-[0.95rem]`}>
          <div className="mb-3 flex items-center justify-between gap-2 px-[0.15rem]">
            <div className="flex items-center gap-2">
              <MapPinned size={16} strokeWidth={2} className="text-clay" />
              <h3 className="m-0 font-serif text-[1.2rem] font-medium text-ink">
                Список зон
              </h3>
            </div>
            <span className="text-[11px] font-semibold tracking-[0.08em] text-ink/40 uppercase">
              {zones.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto pr-[0.1rem]">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-ink/12 px-3 py-8 text-center text-[0.88rem] text-ink/45">
                Загрузка зон…
              </div>
            ) : zones.length === 0 && !creating ? (
              <div className="rounded-2xl border border-dashed border-ink/14 bg-sand/50 px-4 py-8 text-center">
                <p className="m-0 text-[0.95rem] font-[650] text-ink">
                  Пока нет зон
                </p>
                <p className="mt-2 mb-4 text-[0.8rem] leading-[1.4] text-ink/50">
                  Нажмите «Новая зона» и обведите район на карте справа.
                </p>
                <button
                  type="button"
                  className={btnDark}
                  disabled={busy}
                  onClick={startCreate}
                >
                  Нарисовать первую
                </button>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {zones.map((zone) => {
                  const active = zone.id === selectedId && !creating;
                  return (
                    <li key={zone.id}>
                      <button
                        type="button"
                        className={cx(
                          "group flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3 py-[0.8rem] text-left transition duration-200",
                          active
                            ? "border-clay/45 bg-clay/[0.09] shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
                            : "border-ink/8 bg-white/75 hover:border-ink/18 hover:bg-white",
                        )}
                        onClick={() => selectZone(zone)}
                      >
                        <span
                          className="mt-1 size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                          style={{ background: zone.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <strong className="block truncate text-[0.92rem] text-ink">
                              {zone.name}
                            </strong>
                            <Pencil
                              size={13}
                              strokeWidth={2}
                              className={cx(
                                "mt-0.5 shrink-0 text-ink/25 transition",
                                active
                                  ? "text-clay"
                                  : "opacity-0 group-hover:opacity-100",
                              )}
                              aria-hidden
                            />
                          </span>
                          <span className="mt-[0.3rem] flex flex-wrap items-center gap-[0.35rem]">
                            <span className="rounded-full bg-ink/[0.05] px-2 py-[0.15rem] text-[0.72rem] font-[650] tabular-nums text-ink/65">
                              {formatPrice(String(zone.deliveryFee))}
                            </span>
                            {!zone.isActive ? (
                              <span className="rounded-full bg-clay/14 px-2 py-[0.15rem] text-[0.68rem] font-bold tracking-[0.06em] text-[#5c3d28] uppercase">
                                выкл
                              </span>
                            ) : null}
                            {zone.polygon.length < 3 ? (
                              <span className="rounded-full bg-danger/10 px-2 py-[0.15rem] text-[0.68rem] font-bold tracking-[0.06em] text-danger uppercase">
                                нет контура
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {showEditor ? (
            <div className="mt-3 animate-panel-in rounded-2xl border border-ink/10 bg-white/90 px-3 py-3 shadow-[0_10px_28px_rgba(33,30,25,0.05)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="m-0 text-[10px] font-bold tracking-[0.16em] text-ink/42 uppercase">
                  {creating ? "Новая зона" : "Редактирование"}
                </p>
                <span
                  className={cx(
                    "rounded-full px-2 py-[0.2rem] text-[10px] font-bold tracking-[0.08em] uppercase",
                    polygonReady
                      ? "bg-[#5a7a60]/14 text-[#3d4a3a]"
                      : "bg-clay/14 text-[#5c3d28]",
                  )}
                >
                  {polygonReady
                    ? `${form.polygon.length} вершин`
                    : `контур · ${form.polygon.length}/3`}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <Field
                  label="Название"
                  value={form.name}
                  onChange={(v) => setForm((s) => ({ ...s, name: v }))}
                  placeholder="Центр / Купчино…"
                  compact
                />

                <div className={fieldClass}>
                  <label>Цвет на карте</label>
                  <div className="flex flex-wrap gap-[0.4rem]">
                    {ZONE_COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={color}
                        className={cx(
                          "size-7 cursor-pointer rounded-full border-2 transition duration-150",
                          form.color === color
                            ? "scale-110 border-ink shadow-[0_0_0_3px_rgba(33,30,25,0.08)]"
                            : "border-white/40 opacity-80 hover:scale-105 hover:opacity-100",
                        )}
                        style={{ background: color }}
                        onClick={() => setForm((s) => ({ ...s, color }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Доставка, ₽"
                    type="number"
                    value={form.deliveryFee}
                    onChange={(v) =>
                      setForm((s) => ({ ...s, deliveryFee: v }))
                    }
                    compact
                  />
                  <Field
                    label="Бесплатно от"
                    type="number"
                    value={form.freeDeliveryFrom}
                    onChange={(v) =>
                      setForm((s) => ({ ...s, freeDeliveryFrom: v }))
                    }
                    compact
                  />
                </div>

                <Field
                  label="Мин. сумма заказа, ₽"
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(v) =>
                    setForm((s) => ({ ...s, minOrderAmount: v }))
                  }
                  hint="0 — общая мин. сумма"
                  compact
                />

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-ink/8 bg-sand/40 px-3 py-2.5">
                  <span className="text-[0.85rem] font-[650] text-ink">
                    Зона активна
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-clay"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, isActive: e.target.checked }))
                    }
                  />
                </label>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className={btnDark}
                    disabled={busy}
                    onClick={() => void saveZone()}
                  >
                    {creating ? "Создать зону" : "Сохранить"}
                  </button>
                  <button
                    type="button"
                    className={btnLine}
                    disabled={busy}
                    onClick={cancelEdit}
                  >
                    Отмена
                  </button>
                  {creating && !drawing ? (
                    <button
                      type="button"
                      className={btnSmGhost}
                      disabled={busy}
                      onClick={() => setDrawing(true)}
                    >
                      Перерисовать
                    </button>
                  ) : null}
                  {selected && !creating ? (
                    <button
                      type="button"
                      className={`${btnSmDanger} inline-flex items-center gap-1`}
                      disabled={busy}
                      onClick={() => setPendingDelete(selected)}
                    >
                      <Trash2 size={12} strokeWidth={2} aria-hidden />
                      Удалить
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <section className={mapShellClass}>
          {drawing ? (
            <div className="absolute top-3 right-3 left-3 z-10 rounded-2xl border border-clay/30 bg-paper/92 px-3 py-2.5 text-[0.84rem] leading-[1.4] text-ink/75 shadow-[0_10px_28px_rgba(33,30,25,0.12)] backdrop-blur-md">
              <strong className="font-[650] text-ink">Режим рисования.</strong>{" "}
              Кликайте по карте — ставятся вершины. Кнопка «Готово» или двойной
              клик завершают контур (нужно ≥ 3 точки).
            </div>
          ) : null}
          <div className="p-[0.65rem] md:p-[0.85rem]">
            <DeliveryZoneMap
              zones={zones}
              selectedId={creating ? null : selectedId}
              drawing={drawing}
              draftColor={form.color}
              heightClassName="h-[min(58vh,520px)]"
              onPolygonChange={(polygon) =>
                setForm((s) => ({ ...s, polygon }))
              }
              onDrawingFinished={(polygon) => {
                setForm((s) => ({ ...s, polygon }));
                setDrawing(false);
              }}
            />
          </div>
        </section>
      </div>

      {typeof document !== "undefined" && settingsOpen && settingsDraft
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] grid animate-fade-in place-items-center bg-[#16120e]/45 p-4 backdrop-blur-[4px] sm:p-5"
              role="presentation"
              onClick={closeSettings}
            >
              <div
                className="max-h-[min(92vh,40rem)] w-[min(100%,32rem)] overflow-auto rounded-[20px] border border-ink/8 bg-paper px-[1.25rem] pt-[1.2rem] pb-5 shadow-[0_24px_60px_rgba(22,18,14,0.22)] sm:px-[1.45rem] sm:pt-[1.35rem]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delivery-settings-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[10px] font-semibold tracking-[0.18em] text-clay uppercase">
                      Доставка
                    </p>
                    <h3
                      id="delivery-settings-title"
                      className="mt-1 mb-0 font-serif text-[1.45rem] leading-[1.15] font-semibold tracking-[-0.02em] text-ink"
                    >
                      Общие настройки
                    </h3>
                    <p className="mt-[0.35rem] mb-0 text-[0.82rem] leading-[1.4] text-ink/48">
                      Приём заказов, оплата курьеру и запасные цены без зон.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-white/80 text-ink/55 transition-[background-color,color] duration-200 hover:bg-clay/10 hover:text-clay"
                    aria-label="Закрыть"
                    disabled={busy}
                    onClick={closeSettings}
                  >
                    <X size={16} strokeWidth={2} aria-hidden />
                  </button>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <p className="m-0 text-[10px] font-semibold tracking-[0.16em] text-ink/40 uppercase">
                    Режим работы
                  </p>
                  <ToggleRow
                    checked={settingsDraft.ordersEnabled}
                    onChange={(next) =>
                      patchSettingsDraft({ ordersEnabled: next })
                    }
                    title="Приём заказов"
                    description="Выключите, чтобы временно закрыть корзину на сайте — новые заказы не принимаются."
                  />
                  <ToggleRow
                    checked={settingsDraft.deliveryPayOnReceiptEnabled}
                    onChange={(next) =>
                      patchSettingsDraft({
                        deliveryPayOnReceiptEnabled: next,
                      })
                    }
                    title="Оплата курьеру при доставке"
                    description="Если выключено — доставка только онлайн (Sber). Включите, когда курьеры снова смогут принимать наличные или карту."
                  />
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <p className="m-0 text-[10px] font-semibold tracking-[0.16em] text-ink/40 uppercase">
                    Цены без зон
                  </p>
                  <p className="m-0 -mt-1 text-[0.78rem] leading-[1.4] text-ink/48">
                    Используются, если активных зон ещё нет, или как запасной
                    тариф. У зоны «мин. сумма = 0» берётся общая мин. сумма
                    ниже.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      label="Мин. сумма, ₽"
                      type="number"
                      value={settingsDraft.minOrderAmount}
                      onChange={(v) =>
                        patchSettingsDraft({ minOrderAmount: v })
                      }
                      compact
                    />
                    <Field
                      label="Доставка, ₽"
                      type="number"
                      value={settingsDraft.deliveryFee}
                      onChange={(v) => patchSettingsDraft({ deliveryFee: v })}
                      compact
                    />
                    <Field
                      label="Бесплатно от, ₽"
                      type="number"
                      value={settingsDraft.freeDeliveryFrom}
                      onChange={(v) =>
                        patchSettingsDraft({ freeDeliveryFrom: v })
                      }
                      compact
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-[0.65rem] border-t border-ink/8 pt-[0.9rem]">
                  <button
                    type="button"
                    className={btnLine}
                    disabled={busy}
                    onClick={closeSettings}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={btnDark}
                    disabled={busy}
                    onClick={() => void saveGlobal()}
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmModal
        open={pendingDelete != null}
        title="Удалить зону?"
        message={
          pendingDelete
            ? `Зона «${pendingDelete.name}» будет удалена. Клиенты больше не смогут выбрать адрес в этом контуре.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
};
