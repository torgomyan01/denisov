"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listIikoOrdersAdminAction } from "@/actions/iiko-orders";
import { btnLine, fieldClass, orderBadgeClass } from "@/components/admin/styles";
import { Field } from "@/components/admin/ui";
import type { IikoDeliveryListItem } from "@/lib/iiko/list-deliveries";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/orders";

const todayYmd = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatWhen = (iso: string | null): string => {
  if (!iso) return "—";
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

const statusLabel = (status: string): string => {
  if ((ORDER_STATUSES as readonly string[]).includes(status)) {
    return ORDER_STATUS_LABELS[status as OrderStatus];
  }
  return status || "—";
};

const serviceTypeLabel = (value: string): string => {
  switch (value) {
    case "DeliveryByCourier":
      return "Доставка";
    case "DeliveryByClient":
      return "Самовывоз";
    default:
      return value || "—";
  }
};

const badgeFor = (status: string): string => {
  if ((ORDER_STATUSES as readonly string[]).includes(status)) {
    return orderBadgeClass(status as OrderStatus);
  }
  return "inline-flex items-center whitespace-nowrap rounded-full bg-ink/8 px-2 py-[0.2rem] text-[0.72rem] uppercase tracking-[0.04em] text-ink";
};

interface IikoOrdersPanelProps {
  busy: boolean;
  showToast: (msg: string, tone?: "success" | "error") => void;
}

export const IikoOrdersPanel = ({
  busy,
  showToast,
}: IikoOrdersPanelProps) => {
  const [orders, setOrders] = useState<IikoDeliveryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayYmd);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listIikoOrdersAdminAction({ date });
    setLoading(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      setOrders([]);
      return;
    }
    setOrders(result.data);
  }, [date, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!q) return true;
      return (
        order.number.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.phone.includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.sourceKey.toLowerCase().includes(q) ||
        order.items.some((item) => item.name.toLowerCase().includes(q))
      );
    });
  }, [orders, query, statusFilter]);

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">
            Заказы iiko
          </h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Прямая выгрузка доставок из iiko Cloud за выбранный день — все
            источники, не только сайт
          </p>
        </div>
        <button
          type="button"
          className={btnLine}
          disabled={loading || busy}
          onClick={() => void load()}
        >
          Обновить
        </button>
      </div>

      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,12rem)_1fr_minmax(0,14rem)] md:items-end">
        <div className={fieldClass}>
          <label className="flex items-baseline justify-between gap-3">
            <span>Дата</span>
          </label>
          <input
            type="date"
            className="min-h-[42px] w-full rounded-[10px] border border-ink/14 bg-white px-3 py-[0.55rem] text-ink"
            value={date}
            onChange={(e) => setDate(e.target.value || todayYmd())}
          />
        </div>
        <Field
          label="Поиск"
          value={query}
          onChange={setQuery}
          placeholder="Номер, телефон, имя, блюдо, sourceKey…"
        />
        <div className={fieldClass}>
          <label className="flex items-baseline justify-between gap-3">
            <span>Статус</span>
          </label>
          <select
            className="min-h-[42px] w-full rounded-[10px] border border-ink/14 bg-white px-3 py-[0.55rem] text-ink"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as OrderStatus | "all")
            }
          >
            <option value="all">Все статусы</option>
            {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((key) => (
              <option key={key} value={key}>
                {ORDER_STATUS_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-ink/48">Загрузка заказов из iiko…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-5 text-sm text-ink/48">
          За выбранный день заказов в iiko нет
        </p>
      ) : (
        <ul className="mt-5! m-0 grid list-none grid-cols-1 gap-3 p-0">
          {filtered.map((order) => {
            const open = expandedId === order.id;
            const qty = order.items.reduce((sum, item) => sum + item.amount, 0);
            return (
              <li key={order.id}>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-xl border border-ink/10 bg-white px-[0.95rem] py-[0.85rem] text-left text-ink hover:border-clay/55 hover:shadow-[0_8px_22px_rgba(33,30,25,0.06)]"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === order.id ? null : order.id,
                    )
                  }
                >
                  <div className="mb-[0.35rem] flex flex-wrap items-center justify-between gap-2">
                    <strong>№ {order.number || "—"}</strong>
                    <span className={badgeFor(order.status)}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-[0.15rem] text-[0.86rem]">
                    {order.customerName || "Клиент"}
                    {order.phone ? ` · ${order.phone}` : ""} ·{" "}
                    {serviceTypeLabel(order.orderServiceType)}
                    {qty > 0 ? ` · ${qty} шт.` : ""}
                  </p>
                  <p className="mt-[0.15rem] text-[0.86rem] text-ink/55">
                    {formatWhen(order.whenCreated || order.completeBefore)}
                    {order.sum != null ? ` · ${Math.round(order.sum)} ₽` : ""}
                    {order.sourceKey ? ` · ${order.sourceKey}` : ""}
                  </p>
                  {order.creationStatus === "Error" || order.error ? (
                    <p className="mt-[0.35rem] text-[0.82rem] text-[#8a2f22]">
                      {order.error || `Создание: ${order.creationStatus}`}
                    </p>
                  ) : null}
                  {order.problem ? (
                    <p className="mt-[0.35rem] text-[0.82rem] text-[#7a4e32]">
                      Проблема: {order.problem}
                    </p>
                  ) : null}
                </button>

                {open ? (
                  <div className="mt-2 rounded-xl border border-ink/8 bg-sand/40 px-4 py-3 text-[0.86rem] text-ink/80">
                    <dl className="m-0 grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-[0.72rem] uppercase tracking-[0.06em] text-ink/45">
                          iiko id
                        </dt>
                        <dd className="m-0 break-all font-mono text-[0.78rem]">
                          {order.id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.72rem] uppercase tracking-[0.06em] text-ink/45">
                          Создание
                        </dt>
                        <dd className="m-0">{order.creationStatus || "—"}</dd>
                      </div>
                      {order.address ? (
                        <div className="sm:col-span-2">
                          <dt className="text-[0.72rem] uppercase tracking-[0.06em] text-ink/45">
                            Адрес
                          </dt>
                          <dd className="m-0">{order.address}</dd>
                        </div>
                      ) : null}
                      {order.comment ? (
                        <div className="sm:col-span-2">
                          <dt className="text-[0.72rem] uppercase tracking-[0.06em] text-ink/45">
                            Комментарий
                          </dt>
                          <dd className="m-0">{order.comment}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {order.items.length > 0 ? (
                      <ul className="mt-3 m-0 list-none space-y-1.5 border-t border-ink/8 p-0 pt-3">
                        {order.items.map((item, index) => (
                          <li
                            key={`${order.id}-${index}-${item.name}`}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {item.name}
                              {item.amount > 1 ? ` × ${item.amount}` : ""}
                            </span>
                            <span className="shrink-0 text-ink/55">
                              {item.sum != null
                                ? `${Math.round(item.sum)} ₽`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 border-t border-ink/8 pt-3 text-ink/48">
                        Состав не пришёл из iiko
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
