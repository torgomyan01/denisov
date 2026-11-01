"use client";

import {
  btnDark,
  btnLine,
  btnSmDanger,
  btnSmGhost,
} from "@/components/admin/styles";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createStaffTelegramRecipientAction,
  deleteStaffTelegramRecipientAction,
  listStaffTelegramRecipientsAction,
  updateStaffTelegramRecipientAction,
  type StaffTelegramRecipientRow,
} from "@/actions/admin-telegram-recipients";
import { ConfirmModal, Field } from "@/components/admin/ui";

interface StaffTelegramPanelProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  showToast: (msg: string, tone?: "success" | "error") => void;
}

const emptyForm = {
  chatId: "",
  name: "",
  title: "",
};

export const StaffTelegramPanel = ({
  busy,
  setBusy,
  showToast,
}: StaffTelegramPanelProps) => {
  const [rows, setRows] = useState<StaffTelegramRecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<StaffTelegramRecipientRow | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<StaffTelegramRecipientRow | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listStaffTelegramRecipientsAction();
    setLoading(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }
    setRows(result.data);
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (row: StaffTelegramRecipientRow) => {
    setEditing(row);
    setCreating(false);
    setForm({
      chatId: row.chatId,
      name: row.name,
      title: row.title,
    });
  };

  const closeModal = () => {
    if (busy) return;
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const payload = {
      chatId: form.chatId.trim(),
      name: form.name.trim(),
      title: form.title.trim(),
    };
    const result = editing
      ? await updateStaffTelegramRecipientAction({
          id: editing.id,
          ...payload,
          isActive: editing.isActive,
        })
      : await createStaffTelegramRecipientAction(payload);
    setBusy(false);
    if (!result.success) {
      showToast(result.error, "error");
      return;
    }
    showToast(editing ? "Сохранено" : "Добавлено");
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    await load();
  };

  const toggleActive = async (row: StaffTelegramRecipientRow) => {
    setBusy(true);
    const result = await updateStaffTelegramRecipientAction({
      id: row.id,
      chatId: row.chatId,
      name: row.name,
      title: row.title,
      isActive: !row.isActive,
    });
    setBusy(false);
    if (!result.success) {
      showToast(result.error, "error");
      return;
    }
    showToast(row.isActive ? "Выключено" : "Включено");
    await load();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteStaffTelegramRecipientAction(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
    if (!result.success) {
      showToast(result.error, "error");
      return;
    }
    showToast("Удалено");
    if (editing?.id === pendingDelete.id) closeModal();
    await load();
  };

  const modalOpen = creating || Boolean(editing);

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">
            Telegram алерты
          </h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Кому из сотрудников бот{" "}
            <span className="font-[650] text-ink/70">@cafe_denisov_bot</span>{" "}
            присылает новые заказы. Укажите chat id, имя и должность — так
            видно, кому принадлежит каждый id. Сотрудник должен хотя бы раз
            написать боту /start.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnDark}
            disabled={busy || loading}
            onClick={openCreate}
          >
            Добавить
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

      {loading ? (
        <p className="py-6 text-center text-ink/45">Загрузка…</p>
      ) : !rows.length ? (
        <p className="rounded-2xl border border-dashed border-ink/12 px-4 py-8 text-center font-serif text-ink/45 italic">
          Пока никого нет — нажмите «Добавить»
        </p>
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-2xl border border-ink/10">
          <table className="w-full min-w-[36rem] border-collapse text-left text-[0.9rem]">
            <thead>
              <tr className="bg-ink/[0.04] text-[0.72rem] tracking-[0.08em] text-ink/50 uppercase">
                <th className="px-3 py-2.5 font-[650]">Имя</th>
                <th className="px-3 py-2.5 font-[650]">Должность</th>
                <th className="px-3 py-2.5 font-[650]">Chat id</th>
                <th className="px-3 py-2.5 font-[650]">Статус</th>
                <th className="px-3 py-2.5 font-[650]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-ink/8 ${
                    row.isActive ? "bg-white/70" : "bg-ink/[0.02] opacity-70"
                  }`}
                >
                  <td className="px-3 py-3 font-[650] text-ink">{row.name}</td>
                  <td className="px-3 py-3 text-ink/65">
                    {row.title || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-[0.82rem] text-ink/70">
                    {row.chatId}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[0.72rem] font-[650] tracking-[0.06em] uppercase ${
                        row.isActive
                          ? "bg-olive/15 text-olive"
                          : "bg-ink/8 text-ink/45"
                      }`}
                    >
                      {row.isActive ? "Вкл" : "Выкл"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
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
                        className={btnSmGhost}
                        disabled={busy}
                        onClick={() => void toggleActive(row)}
                      >
                        {row.isActive ? "Выкл" : "Вкл"}
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
        </div>
      )}

      {mounted && modalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] grid place-items-center bg-[#16120e]/45 p-5 backdrop-blur-[4px]"
              role="presentation"
              onClick={closeModal}
            >
              <div
                className="max-h-[min(90vh,36rem)] w-[min(100%,34rem)] overflow-auto rounded-[18px] border border-ink/8 bg-paper px-[1.4rem] pt-[1.35rem] pb-5 shadow-[0_24px_60px_rgba(22,18,14,0.22)] [&_h3]:m-0 [&_h3]:text-[1.15rem] [&_h3]:font-[650] [&_h3]:tracking-[-0.02em]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="staff-tg-edit-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="staff-tg-edit-title">
                  {editing ? "Изменить получателя" : "Добавить получателя"}
                </h3>
                <p className="mt-[0.35rem] text-[0.78rem] text-ink/48">
                  Имя, должность и Telegram chat id.
                </p>

                <div className="mt-4 grid gap-3">
                  <Field
                    label="Имя"
                    value={form.name}
                    placeholder="Иван"
                    onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  />
                  <Field
                    label="Должность"
                    value={form.title}
                    placeholder="Админ / Менеджер"
                    onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                  />
                  <Field
                    label="Telegram chat id"
                    value={form.chatId}
                    placeholder="809580214"
                    hint="Узнать id: @userinfobot. Для группы — отрицательное число."
                    onChange={(v) => setForm((f) => ({ ...f, chatId: v }))}
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
                    onClick={() => void save()}
                  >
                    {busy ? "…" : editing ? "Сохранить" : "Добавить"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Удалить получателя?"
        message={
          pendingDelete
            ? `${pendingDelete.name}${pendingDelete.title ? ` (${pendingDelete.title})` : ""} — chat ${pendingDelete.chatId}. Новые заказы этому id больше не уйдут.`
            : ""
        }
        confirmLabel={busy ? "Удаление…" : "Удалить"}
        onCancel={() => {
          if (!busy) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
};
