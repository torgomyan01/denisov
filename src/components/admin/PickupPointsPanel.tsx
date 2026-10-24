"use client";

import {
  btnDark,
  btnLine,
  btnSmDanger,
  btnSmGhost,
  fieldClass,
  inputClass,
} from "@/components/admin/styles";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createPickupPointAction,
  deletePickupPointAction,
  listPickupPointsAdminAction,
  updatePickupPointAction,
} from "@/actions/pickup-points";
import { ConfirmModal, Field } from "@/components/admin/ui";
import { MapPickerLoading } from "@/components/maps/MapPickerLoading";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { DEFAULT_MAP_CENTER } from "@/lib/pickup-points";
import { formatPhoneDisplay, maskRuPhone } from "@/lib/phone";
import type { PickupPointAdmin } from "@/lib/pickup-points";

const MapPicker = dynamic(
  () =>
    import("@/components/admin/MapPicker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <MapPickerLoading>Загрузка карты…</MapPickerLoading>
    ),
  },
);

type FormState = {
  name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  phone: "",
  address: "",
  lat: DEFAULT_MAP_CENTER.lat,
  lng: DEFAULT_MAP_CENTER.lng,
  isActive: true,
});

const fromRow = (row: PickupPointAdmin): FormState => ({
  name: row.name,
  phone: maskRuPhone(row.phone),
  address: row.address,
  lat: row.lat,
  lng: row.lng,
  isActive: row.isActive,
});

interface PickupPointsPanelProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  showToast: (msg: string, tone?: "success" | "error") => void;
}

export const PickupPointsPanel = ({
  busy,
  setBusy,
  showToast,
}: PickupPointsPanelProps) => {
  const [points, setPoints] = useState<PickupPointAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PickupPointAdmin | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<PickupPointAdmin | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPickupPointsAdminAction();
    setLoading(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }
    setPoints(result.data);
  }, [showToast]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    return points.filter((p) => {
      const hay = [p.name, p.address, p.phone, p.id].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [points, query]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm());
  };

  const openEdit = (row: PickupPointAdmin) => {
    setEditing(row);
    setCreating(false);
    setForm(fromRow(row));
  };

  const closeModal = () => {
    if (busy) return;
    setCreating(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const patchForm = (partial: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const onSave = async () => {
    if (busy) return;
    if (form.lat == null || form.lng == null) {
      showToast("Отметьте точку на карте", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        isActive: form.isActive,
      };
      const result = editing
        ? await updatePickupPointAction({ id: editing.id, ...payload })
        : await createPickupPointAction(payload);

      if (!result.success || !result.data) {
        showToast(result.success ? "Ошибка" : result.error, "error");
        return;
      }

      setPoints((prev) => {
        if (editing) {
          return prev.map((p) => (p.id === result.data!.id ? result.data! : p));
        }
        return [...prev, result.data!].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
      });
      closeModal();
      showToast(editing ? "Точка сохранена" : "Точка создана");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    try {
      const result = await deletePickupPointAction(pendingDelete.id);
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      setPoints((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      if (editing?.id === pendingDelete.id) closeModal();
      setPendingDelete(null);
      showToast("Точка удалена");
    } finally {
      setBusy(false);
    }
  };

  const modalOpen = creating || Boolean(editing);

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">Точки самовывоза</h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Кафе / пункты выдачи. Гости выбирают их в корзине при самовывозе.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnDark}
            disabled={busy || loading}
            onClick={openCreate}
          >
            Новая точка
          </button>
          <button
            type="button"
            className={btnLine}
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Обновить
          </button>
        </div>
      </div>
      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      <div className="grid gap-4 mt-5">
        <Field
          label="Поиск"
          value={query}
          placeholder="Название, адрес, телефон…"
          onChange={setQuery}
        />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-ink/8 bg-white/45 mt-5">
        {loading ? (
          <p className="text-sm text-ink/48">Загрузка…</p>
        ) : !filtered.length ? (
          <p className="text-sm text-ink/48">
            {points.length
              ? "Ничего не найдено."
              : "Пока нет точек. Создайте первую — например, текущее кафе."}
          </p>
        ) : (
          <table className="w-full border-collapse text-[0.9rem] [&_:is(th,td)]:border-b [&_:is(th,td)]:border-ink/6 [&_:is(th,td)]:px-[0.9rem] [&_:is(th,td)]:py-3 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-middle [&_:is(th,td)]:whitespace-nowrap [&_th]:bg-paper/70 [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-ink/48 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-clay/4">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Название</th>
                <th>Адрес</th>
                <th>Телефон</th>
                <th>Координаты</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span
                      className={
                        row.isActive
                          ? "inline-flex items-center rounded-full bg-[#5a7a60]/14 px-[0.55rem] py-[0.2rem] text-[10px] font-bold uppercase tracking-[0.08em] text-[#3d4a3a]"
                          : "inline-flex items-center rounded-full bg-clay/16 px-[0.55rem] py-[0.2rem] text-[10px] font-bold uppercase tracking-[0.08em] text-[#5c3d28]"
                      }
                    >
                      {row.isActive ? "Активна" : "Скрыта"}
                    </span>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.address}</td>
                  <td>{row.phone ? formatPhoneDisplay(row.phone) : "—"}</td>
                  <td className="text-[0.82rem] tabular-nums whitespace-nowrap">
                    {row.lat.toFixed(5)}, {row.lng.toFixed(5)}
                  </td>
                  <td>
                    <div className="inline-flex flex-wrap items-center gap-[0.4rem]">
                      <button
                        type="button"
                        className={btnSmGhost}
                        disabled={busy}
                        onClick={() => openEdit(row)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className={btnSmDanger}
                        disabled={busy}
                        onClick={() => setPendingDelete(row)}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mounted && modalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] grid place-items-center bg-[#16120e]/45 p-5 backdrop-blur-[4px]"
              role="presentation"
              onClick={closeModal}
            >
              <div
                className="max-h-[min(92vh,52rem)] w-[min(100%,42rem)] overflow-auto rounded-[18px] border border-ink/8 bg-paper px-[1.4rem] pt-[1.35rem] pb-5 shadow-[0_24px_60px_rgba(22,18,14,0.22)] [&_h3]:m-0 [&_h3]:text-[1.15rem] [&_h3]:font-[650] [&_h3]:tracking-[-0.02em]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pickup-edit-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="pickup-edit-title">
                  {editing ? "Редактировать точку" : "Новая точка самовывоза"}
                </h3>
                <p className="mt-[0.35rem] break-all text-[0.78rem] text-ink/48">
                  Название, телефон, адрес и метка на карте.
                </p>

                <div className="grid gap-4 mt-4">
                  <Field
                    label="Название"
                    value={form.name}
                    placeholder="Денисов на Московском"
                    onChange={(v) => patchForm({ name: v })}
                  />
                  <label className={fieldClass}>
                    <span >Телефон</span>
                    <PhoneInput
                      className={inputClass()}
                      value={form.phone}
                      onChange={(v) => patchForm({ phone: v })}
                    />
                  </label>
                  <Field
                    label="Адрес"
                    value={form.address}
                    placeholder="Санкт-Петербург, Московский пр., 71/3"
                    onChange={(v) => patchForm({ address: v })}
                  />
                  <label className="flex items-center gap-[0.55rem] mt-[0.35rem] cursor-pointer text-[0.92rem] text-ink [&_input]:size-[1.05rem] [&_input]:accent-clay">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        patchForm({ isActive: e.target.checked })
                      }
                    />
                    <span>Показывать гостям в корзине</span>
                  </label>
                </div>

                <div className="grid gap-4 grid-cols-2 max-[640px]:grid-cols-1 mt-4">
                  <Field
                    label="Широта (lat)"
                    value={form.lat == null ? "" : String(form.lat)}
                    placeholder="59.89135"
                    onChange={(v) => {
                      const n = Number(v.replace(",", "."));
                      patchForm({
                        lat: v.trim() === "" || Number.isNaN(n) ? null : n,
                      });
                    }}
                  />
                  <Field
                    label="Долгота (lng)"
                    value={form.lng == null ? "" : String(form.lng)}
                    placeholder="30.31985"
                    onChange={(v) => {
                      const n = Number(v.replace(",", "."));
                      patchForm({
                        lng: v.trim() === "" || Number.isNaN(n) ? null : n,
                      });
                    }}
                  />
                </div>

                <div className="mt-4">
                  <MapPicker
                    lat={form.lat}
                    lng={form.lng}
                    onChange={({ lat, lng }) => patchForm({ lat, lng })}
                  />
                </div>

                <div className="mt-5 flex justify-end gap-[0.65rem] border-t border-ink/8 pt-[0.85rem]">
                  <button
                    type="button"
                    className={btnLine}
                    disabled={busy}
                    onClick={closeModal}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={btnDark}
                    disabled={busy}
                    onClick={() => void onSave()}
                  >
                    {editing ? "Сохранить" : "Создать"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Удалить точку?"
        message={
          pendingDelete
            ? `«${pendingDelete.name}» больше не будет доступна для самовывоза.`
            : ""
        }
        confirmLabel={busy ? "Удаление…" : "Удалить"}
        onCancel={() => {
          if (!busy) setPendingDelete(null);
        }}
        onConfirm={() => void onDelete()}
      />
    </section>
  );
};
