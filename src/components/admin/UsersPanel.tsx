"use client";

import {
  btnDark,
  btnLine,
  btnSmDanger,
  btnSmGhost,
  fieldClass,
  inputClass,
} from "@/components/admin/styles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createCustomerAction,
  deleteCustomerAction,
  listCustomersAction,
  updateCustomerAction,
  type AdminAccountInfo,
  type AdminCustomerRow,
} from "@/actions/admin-customers";
import { ConfirmModal, Field } from "@/components/admin/ui";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { formatPhoneDisplay } from "@/lib/phone";

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

interface UsersPanelProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  showToast: (msg: string, tone?: "success" | "error") => void;
}

export const UsersPanel = ({ busy, setBusy, showToast }: UsersPanelProps) => {
  const [admin, setAdmin] = useState<AdminAccountInfo | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createAsCourier, setCreateAsCourier] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const [editing, setEditing] = useState<AdminCustomerRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [editAsCourier, setEditAsCourier] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminCustomerRow | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listCustomersAction();
    setLoading(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }
    setAdmin(result.data.admin);
    setCustomers(result.data.customers);
  }, [showToast]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const hay = [c.name, c.phone ?? "", c.email ?? "", c.id]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [customers, query]);

  const openCreate = () => {
    setCreating(true);
    setCreateName("");
    setCreatePhone("");
    setCreatePassword("");
    setCreateAsCourier(false);
    setShowCreatePassword(false);
  };

  const closeCreate = () => {
    if (busy) return;
    setCreating(false);
    setCreateName("");
    setCreatePhone("");
    setCreatePassword("");
    setCreateAsCourier(false);
    setShowCreatePassword(false);
  };

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createCustomerAction({
        name: createName,
        phone: createPhone,
        password: createPassword,
        role: createAsCourier ? "courier" : "customer",
      });
      if (!result.success || !result.data) {
        showToast(result.success ? "Ошибка" : result.error, "error");
        return;
      }
      setCustomers((prev) => [result.data!, ...prev]);
      setCreating(false);
      setCreateName("");
      setCreatePhone("");
      setCreatePassword("");
      setCreateAsCourier(false);
      setShowCreatePassword(false);
      showToast(
        createAsCourier ? "Курьер создан" : "Пользователь создан",
      );
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: AdminCustomerRow) => {
    setEditing(row);
    setName(row.name);
    setPhone(row.phone ? formatPhoneDisplay(row.phone) : "");
    setPassword("");
    setEditAsCourier(row.role === "courier");
    setShowPassword(false);
  };

  const closeEdit = () => {
    setEditing(null);
    setPassword("");
  };

  const saveEdit = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const result = await updateCustomerAction({
        id: editing.id,
        name,
        phone,
        password: password.trim() || undefined,
        role: editAsCourier ? "courier" : "customer",
      });
      if (!result.success || !result.data) {
        showToast(result.success ? "Ошибка" : result.error, "error");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) => (c.id === result.data!.id ? result.data! : c)),
      );
      showToast("Пользователь сохранён");
      closeEdit();
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    const id = pendingDelete.id;
    setBusy(true);
    try {
      const result = await deleteCustomerAction({ id });
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (editing?.id === id) closeEdit();
      setPendingDelete(null);
      showToast("Пользователь удалён");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">Пользователи</h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Клиенты и курьеры. Курьер входит в личный кабинет и выдаёт заказы по
            QR.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnDark}
            disabled={busy || loading}
            onClick={openCreate}
          >
            Новый пользователь
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

      {admin ? (
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-[14px] border border-clay/18 bg-paper/55 bg-[linear-gradient(135deg,rgba(156,107,74,0.08),transparent_55%)] px-[1.15rem] py-4 [&_h3]:mt-[0.45rem] [&_h3]:mb-[0.2rem] [&_h3]:text-[1.05rem] [&_h3]:font-[650] [&_h3]:tracking-[-0.01em] [&_p]:max-w-[36rem] [&_p]:text-[0.86rem] [&_p]:leading-[1.45] [&_p]:text-ink/48">
          <div>
            <span className="inline-flex items-center rounded-full bg-clay/16 px-[0.55rem] py-[0.2rem] text-[10px] font-bold uppercase tracking-[0.08em] text-[#5c3d28]">Админ</span>
            <h3>{admin.label}</h3>
            <p>{admin.note}</p>
          </div>
          <p className="text-[0.78rem]! font-semibold uppercase tracking-[0.04em] text-clay!">Вы вошли в панель как администратор</p>
        </div>
      ) : null}

      <div className="grid gap-4 mt-5">
        <Field
          label="Поиск"
          value={query}
          placeholder="Имя, телефон, email…"
          onChange={setQuery}
        />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-ink/8 bg-white/45 mt-5">
        {loading ? (
          <p className="text-sm text-ink/48">Загрузка…</p>
        ) : !filtered.length ? (
          <p className="text-sm text-ink/48">
            {customers.length
              ? "Ничего не найдено."
              : "Пока нет зарегистрированных клиентов."}
          </p>
        ) : (
          <table className="w-full border-collapse text-[0.9rem] [&_:is(th,td)]:border-b [&_:is(th,td)]:border-ink/6 [&_:is(th,td)]:px-[0.9rem] [&_:is(th,td)]:py-3 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-middle [&_:is(th,td)]:whitespace-nowrap [&_th]:bg-paper/70 [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-ink/48 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-clay/4">
            <thead>
              <tr>
                <th>Роль</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>ДР</th>
                <th>Вход</th>
                <th>Регистрация</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.role === "courier" ? (
                      <span className="inline-flex items-center rounded-full bg-clay/16 px-[0.55rem] py-[0.2rem] text-[10px] font-bold uppercase tracking-[0.08em] text-[#5c3d28]">
                        Курьер
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#5a7a60]/14 px-[0.55rem] py-[0.2rem] text-[10px] font-bold uppercase tracking-[0.08em] text-[#3d4a3a]">
                        Клиент
                      </span>
                    )}
                  </td>
                  <td>{row.name || "—"}</td>
                  <td>{row.phone ? formatPhoneDisplay(row.phone) : "—"}</td>
                  <td>{row.email || "—"}</td>
                  <td>{row.birthday || "—"}</td>
                  <td>
                    <span className="inline-flex flex-wrap gap-[0.35rem] [&_em]:rounded-full [&_em]:bg-ink/6 [&_em]:px-[0.45rem] [&_em]:py-[0.15rem] [&_em]:text-[11px] [&_em]:font-semibold [&_em]:not-italic [&_em]:tracking-[0.04em] [&_em]:text-ink">
                      {row.hasPassword ? <em>пароль</em> : null}
                      {row.hasYandex ? <em>Яндекс</em> : null}
                      {!row.hasPassword && !row.hasYandex ? "—" : null}
                    </span>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
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

      {mounted && creating
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] grid place-items-center bg-[#16120e]/45 p-5 backdrop-blur-[4px]"
              role="presentation"
              onClick={closeCreate}
            >
              <div
                className="max-h-[min(90vh,40rem)] w-[min(100%,34rem)] overflow-auto rounded-[18px] border border-ink/8 bg-paper px-[1.4rem] pt-[1.35rem] pb-5 shadow-[0_24px_60px_rgba(22,18,14,0.22)] [&_h3]:m-0 [&_h3]:text-[1.15rem] [&_h3]:font-[650] [&_h3]:tracking-[-0.02em]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="users-create-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="users-create-title">Новый пользователь</h3>
                <p className="mt-[0.35rem] break-all text-[0.78rem] text-ink/48">
                  Имя, телефон и пароль. Можно сразу назначить курьером.
                </p>

                <div className="grid gap-4 mt-4">
                  <Field
                    label="Имя"
                    value={createName}
                    placeholder="Александр"
                    onChange={setCreateName}
                  />
                  <div className={fieldClass}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor="users-create-phone">Телефон</label>
                    </div>
                    <PhoneInput
                      className={inputClass()}
                      id="users-create-phone"
                      value={createPhone}
                      onChange={setCreatePhone}
                      placeholder="+7 900 000-00-00"
                    />
                  </div>
                  <div className={`${fieldClass} col-span-full`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor="users-create-password">Пароль</label>
                    </div>
                    <div className="relative [&_input]:pr-[3.25rem]">
                      <input
                        className={inputClass()}
                        id="users-create-password"
                        type={showCreatePassword ? "text" : "password"}
                        value={createPassword}
                        placeholder="Не короче 6 символов"
                        autoComplete="new-password"
                        onChange={(e) => setCreatePassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute top-1/2 right-[0.55rem] -translate-y-1/2 cursor-pointer rounded-full bg-transparent px-[0.55rem] py-[0.4rem] text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/48 hover:bg-clay/8 hover:text-clay"
                        onClick={() => setShowCreatePassword((v) => !v)}
                      >
                        {showCreatePassword ? "Скрыть" : "Показать"}
                      </button>
                    </div>
                    <p className="text-xs leading-[1.4] text-ink/48">Сохраняется как scrypt hash.</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-ink/10 bg-white/70 px-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-[0.2rem] size-4 accent-clay"
                      checked={createAsCourier}
                      onChange={(e) => setCreateAsCourier(e.target.checked)}
                    />
                    <span>
                      <strong className="block text-[0.95rem]">Курьер</strong>
                      <span className="mt-[0.15rem] block text-[0.82rem] text-ink/55">
                        Доступ к разделу «Доставка» в личном кабинете — сканер QR
                        и выдача заказа клиенту.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-[0.65rem] border-t border-ink/8 pt-[0.85rem]">
                  <button
                    type="button"
                    className={btnLine}
                    disabled={busy}
                    onClick={closeCreate}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={btnDark}
                    disabled={busy}
                    onClick={() => void onCreate()}
                  >
                    {busy ? "Создание…" : "Создать"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {editing ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#16120e]/45 p-5 backdrop-blur-[4px]" role="presentation" onClick={closeEdit}>
          <div
            className="max-h-[min(90vh,40rem)] w-[min(100%,34rem)] overflow-auto rounded-[18px] border border-ink/8 bg-paper px-[1.4rem] pt-[1.35rem] pb-5 shadow-[0_24px_60px_rgba(22,18,14,0.22)] [&_h3]:m-0 [&_h3]:text-[1.15rem] [&_h3]:font-[650] [&_h3]:tracking-[-0.02em]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="users-edit-title">Редактировать пользователя</h3>
            <p className="mt-[0.35rem] break-all text-[0.78rem] text-ink/48">ID: {editing.id}</p>

            <div className="grid gap-4 mt-4">
              <Field label="Имя" value={name} onChange={setName} />
              <div className={fieldClass}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="users-edit-phone">Телефон</label>
                </div>
                <PhoneInput
                  className={inputClass()}
                  id="users-edit-phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+7 900 000-00-00"
                />
              </div>
              <div className={`${fieldClass} col-span-full`}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="users-edit-password">Новый пароль</label>
                </div>
                <div className="relative [&_input]:pr-[3.25rem]">
                  <input
                    className={inputClass()}
                    id="users-edit-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="Оставьте пустым, чтобы не менять"
                    autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-[0.55rem] -translate-y-1/2 cursor-pointer rounded-full bg-transparent px-[0.55rem] py-[0.4rem] text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/48 hover:bg-clay/8 hover:text-clay"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                <p className="text-xs leading-[1.4] text-ink/48">
                  Хранится как scrypt hash. Пустое поле — пароль не трогаем.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-ink/10 bg-white/70 px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-[0.2rem] size-4 accent-clay"
                  checked={editAsCourier}
                  onChange={(e) => setEditAsCourier(e.target.checked)}
                />
                <span>
                  <strong className="block text-[0.95rem]">Курьер</strong>
                  <span className="mt-[0.15rem] block text-[0.82rem] text-ink/55">
                    Может сканировать QR и подтверждать выдачу заказа клиенту.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-[0.65rem] border-t border-ink/8 pt-[0.85rem]">
              <button type="button" className={btnLine} onClick={closeEdit}>
                Отмена
              </button>
              <button
                type="button"
                className={btnDark}
                disabled={busy}
                onClick={() => void saveEdit()}
              >
                {busy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Удалить пользователя?"
        message={
          pendingDelete
            ? `Клиент «${pendingDelete.name || "без имени"}» будет удалён безвозвратно вместе с сессиями входа.`
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
