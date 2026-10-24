"use client";

import { ChevronRight, Clock3, Package } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listMyOrdersAction } from "@/actions/orders";
import {
  profileBadge,
  profileEditBtn,
  profileLead,
  profileOrderEta,
  profileOrderProgress,
  profileOrderProgressBar,
  profileOrderStatus,
  profileOrdersError,
  profileOrdersMuted,
  profilePanelCard,
  profilePanelHead,
  profileTitle,
} from "@/components/profile/profile-styles";
import { getCustomerOrderStatusView } from "@/lib/order-customer";
import type { OrderPublic, OrderStatus } from "@/lib/orders";

type OrdersFilter = "new" | "old" | "completed";

const FILTERS: { id: OrdersFilter; label: string }[] = [
  { id: "new", label: "Новые" },
  { id: "old", label: "Старые" },
  { id: "completed", label: "Выполненные" },
];

const ACTIVE_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "delivering",
];

const matchesFilter = (order: OrderPublic, filter: OrdersFilter): boolean => {
  if (filter === "new") return ACTIVE_STATUSES.includes(order.status);
  if (filter === "completed") return order.status === "completed";
  return order.status === "cancelled";
};

/** In-transit first, then other active, then by newest created. */
const sortOrders = (list: OrderPublic[]): OrderPublic[] =>
  [...list].sort((a, b) => {
    const aTransit = a.status === "delivering" ? 0 : 1;
    const bTransit = b.status === "delivering" ? 0 : 1;
    if (aTransit !== bTransit) return aTransit - bTransit;

    const aActive = ACTIVE_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_STATUSES.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

const formatWhen = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const filterChipClass = (active: boolean): string =>
  `inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 font-sans text-[11px] leading-none font-[650] tracking-[0.1em] uppercase transition-[background-color,border-color,color] duration-200 ${
    active
      ? "border-ink bg-ink text-paper"
      : "border-ink/12 bg-paper/70 text-ink/55 hover:border-clay/30 hover:text-clay"
  }`;

export const ProfileOrdersPage = () => {
  const [orders, setOrders] = useState<OrderPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<OrdersFilter>("new");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listMyOrdersAction();
    setLoading(false);
    if (!result.success || !result.data) {
      setError(result.success ? "Ошибка" : result.error);
      setOrders([]);
      return;
    }
    setError("");
    setOrders(result.data);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 25000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => {
    const next = { new: 0, old: 0, completed: 0 };
    for (const order of orders) {
      if (ACTIVE_STATUSES.includes(order.status)) next.new += 1;
      else if (order.status === "completed") next.completed += 1;
      else if (order.status === "cancelled") next.old += 1;
    }
    return next;
  }, [orders]);

  const visibleOrders = useMemo(
    () => sortOrders(orders.filter((order) => matchesFilter(order, filter))),
    [orders, filter],
  );

  return (
    <div className={profilePanelCard}>
      <header className={profilePanelHead}>
        <div>
          <p className={profileBadge}>Заказы</p>
          <h2 className={profileTitle}>Мои заказы</h2>
          <p className={profileLead}>
            Статус, что происходит сейчас и ориентировочное время.
          </p>
        </div>
        <button
          type="button"
          className={profileEditBtn}
          disabled={loading}
          onClick={() => void load()}
        >
          Обновить
        </button>
      </header>

      {orders.length > 0 ? (
        <div
          className="mb-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Фильтр заказов"
        >
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filterChipClass(filter === item.id)}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span className="ml-1.5 opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className={profileOrdersMuted}>Загрузка заказов…</p>
      ) : error ? (
        <p className={profileOrdersError}>{error}</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-start gap-[0.4rem] pt-2 pb-1">
          <Package
            className="mb-[0.2rem] text-clay"
            size={28}
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <strong>Пока нет заказов</strong>
          <p className="max-w-[32ch] text-[0.92rem] text-ink/48">
            Когда оформите заказ, он появится здесь со статусом.
          </p>
          <Link
            href="/menu"
            className="mt-[0.55rem] inline-flex min-h-[42px] items-center rounded-full bg-ink px-4 font-sans text-[12px] leading-none font-[650] tracking-[0.1em] text-paper uppercase no-underline"
          >
            Перейти в меню
          </Link>
        </div>
      ) : visibleOrders.length === 0 ? (
        <p className={profileOrdersMuted}>
          {filter === "new"
            ? "Нет новых заказов в работе."
            : filter === "completed"
              ? "Пока нет выполненных заказов."
              : "Нет отменённых заказов."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleOrders.map((order) => {
            const view = getCustomerOrderStatusView(order);
            const active =
              order.status !== "completed" && order.status !== "cancelled";
            const inTransit = order.status === "delivering";
            return (
              <li key={order.id}>
                <Link
                  href={`/profile/orders/${order.id}`}
                  className={`block rounded-2xl border px-[1.05rem] py-4 text-inherit no-underline transition-[border-color,translate,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(33,30,25,0.06)] motion-reduce:transition-none ${
                    inTransit
                      ? "border-clay/45 bg-[image:linear-gradient(145deg,rgba(156,107,74,0.14),rgba(255,255,255,0.7))] shadow-[0_10px_24px_rgba(156,107,74,0.08)]"
                      : active
                        ? "border-clay/35 bg-[image:linear-gradient(145deg,rgba(156,107,74,0.08),rgba(255,255,255,0.65))]"
                        : "border-ink/10 bg-paper/55 hover:border-clay/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong>{order.number}</strong>
                    <span className={profileOrderStatus(order.status)}>
                      {view.title}
                    </span>
                  </div>
                  <p className="mt-[0.45rem] text-[0.9rem] leading-[1.4] text-ink/72">
                    {view.detail}
                  </p>
                  <div className={profileOrderEta(false)}>
                    <Clock3 size={14} strokeWidth={2} aria-hidden="true" />
                    <span>{view.eta}</span>
                  </div>
                  {active ? (
                    <div
                      className={profileOrderProgress(false)}
                      aria-hidden="true"
                    >
                      <span
                        className={profileOrderProgressBar}
                        style={{ width: `${view.progress}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink/6 pt-[0.65rem] text-[0.8rem] text-ink/48">
                    <span>
                      {formatWhen(order.createdAt)} ·{" "}
                      {order.fulfillmentMode === "delivery"
                        ? "Доставка"
                        : "Самовывоз"}{" "}
                      · {order.totalRub} ₽
                    </span>
                    <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
