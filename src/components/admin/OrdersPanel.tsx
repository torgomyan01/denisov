"use client";

import { btnLine, fieldClass, orderBadgeClass } from "@/components/admin/styles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listOrdersAdminAction } from "@/actions/orders";
import { Field } from "@/components/admin/ui";
import {
  ORDER_STATUS_LABELS,
  type OrderPublic,
  type OrderStatus,
} from "@/lib/orders";

const formatWhen = (iso: string): string => {
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

interface OrdersPanelProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  showToast: (msg: string, tone?: "success" | "error") => void;
  onOrdersChanged?: () => void;
  onOpenOrder: (orderId: string) => void;
}

export const OrdersPanel = ({
  busy,
  showToast,
  onOrdersChanged,
  onOpenOrder,
}: OrdersPanelProps) => {
  const [orders, setOrders] = useState<OrderPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listOrdersAdminAction();
    setLoading(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }
    setOrders(result.data);
    onOrdersChanged?.();
  }, [showToast, onOrdersChanged]);

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
        order.customerPhone.includes(q) ||
        order.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [orders, query, statusFilter]);

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">Заказы</h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Нажмите на заказ, чтобы открыть полную карточку и сменить статус
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnLine}
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Обновить
          </button>
        </div>
      </div>

      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      <div className="grid gap-4 mt-5 items-end">
        <Field
          label="Поиск"
          value={query}
          onChange={setQuery}
          placeholder="Номер, имя, телефон, блюдо…"
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
        <p className="text-sm text-ink/48 mt-5">Загрузка заказов…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink/48 mt-5">Заказов пока нет</p>
      ) : (
        <ul className="m-0 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0 mt-5!">
          {filtered.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                className="w-full cursor-pointer rounded-xl border border-ink/10 bg-white px-[0.95rem] py-[0.85rem] text-left text-ink hover:border-clay/55 hover:shadow-[0_8px_22px_rgba(33,30,25,0.06)] [&_p]:mt-[0.15rem] [&_p]:text-[0.86rem]"
                onClick={() => onOpenOrder(order.id)}
              >
                <div className="mb-[0.35rem] flex items-center justify-between gap-2">
                  <strong>{order.number}</strong>
                  <span className={orderBadgeClass(order.status)}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p>
                  {order.customerName || "Клиент"} ·{" "}
                  {order.fulfillmentMode === "delivery"
                    ? "Доставка"
                    : "Самовывоз"}{" "}
                  · {order.items.reduce((sum, item) => sum + item.qty, 0)} шт.
                </p>
                <p className="text-ink/55">
                  {formatWhen(order.createdAt)} · {order.totalRub} ₽
                </p>
                {order.items[0] ? (
                  <div className="mt-[0.65rem] flex items-center gap-[0.35rem]">
                    {order.items.slice(0, 4).map((item) => (
                      <div key={item.id} className="size-[2.2rem] shrink-0 overflow-hidden rounded-lg bg-ink/6 [&_img]:block [&_img]:size-full [&_img]:object-cover">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" />
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    {order.items.length > 4 ? (
                      <span className="ml-[0.15rem] text-xs text-ink/55">
                        +{order.items.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
