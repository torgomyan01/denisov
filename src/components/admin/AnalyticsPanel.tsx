"use client";

import { btnLine, fieldClass, tabClass } from "@/components/admin/styles";
import { getAdminAnalyticsAction } from "@/actions/admin-analytics";
import {
  ANALYTICS_RANGE_LABELS,
  ANALYTICS_RANGES,
  formatRubCompact,
  type AdminAnalyticsPayload,
  type AnalyticsRange,
} from "@/lib/admin-analytics";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AnalyticsPanelProps {
  showToast: (msg: string, tone?: "success" | "error") => void;
}

const ANALYTICS_TABS = [
  {
    id: "overview",
    label: "Обзор",
    hint: "Главные цифры и выручка",
  },
  {
    id: "carts",
    label: "Корзины",
    hint: "Что лежит у клиентов сейчас",
  },
  {
    id: "orders",
    label: "Заказы",
    hint: "Статусы, оплата, часы, iiko",
  },
  {
    id: "customers",
    label: "Клиенты",
    hint: "С заказами и без",
  },
  {
    id: "products",
    label: "Блюда",
    hint: "Топ продаж за период",
  },
] as const;

type AnalyticsTabId = (typeof ANALYTICS_TABS)[number]["id"];

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

const pct = (part: number, whole: number): string => {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
};

const KpiCard = ({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "muted" | "live";
}) => {
  const toneClass =
    tone === "good"
      ? "border-olive/25 bg-[linear-gradient(160deg,rgba(107,143,113,.12),rgba(251,248,241,.9))]"
      : tone === "warn"
        ? "border-clay/30 bg-[linear-gradient(160deg,rgba(156,107,74,.12),rgba(251,248,241,.9))]"
        : tone === "live"
          ? "border-clay/35 bg-[linear-gradient(160deg,rgba(156,107,74,.16),rgba(251,248,241,.95))] ring-1 ring-clay/10"
          : tone === "muted"
            ? "border-ink/10 bg-paper/70"
            : "border-ink/12 bg-white/70";

  return (
    <article
      className={`rounded-[18px] border px-4 py-4 shadow-[0_10px_28px_rgba(33,30,25,.04)] ${toneClass}`}
    >
      <p className="text-[10px] font-semibold tracking-[0.16em] text-ink/45 uppercase">
        {label}
      </p>
      <p className="mt-2 font-serif text-[1.55rem] leading-none tracking-[0.02em] text-ink tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[12px] leading-snug text-ink/50">{hint}</p>
      ) : null}
    </article>
  );
};

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) => (
  <section className="rounded-[22px] border border-ink/12 bg-white/55 p-4 shadow-[0_12px_32px_rgba(33,30,25,.04)] sm:p-5">
    <header className="mb-4">
      <h3 className="font-serif text-[1.25rem] tracking-[0.02em] text-ink">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 text-[13px] text-ink/50">{subtitle}</p>
      ) : null}
    </header>
    {children}
  </section>
);

const BarRows = ({
  rows,
}: {
  rows: Array<{ label: string; value: number; meta?: string }>;
}) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) {
    return <p className="py-6 text-center text-ink/40 italic">Нет данных</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink/75">{row.label}</span>
            <span className="shrink-0 tabular-nums text-ink/55">
              {row.meta ?? row.value}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/[.06]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#9C6B4A,#6f4a34)] transition-[width] duration-500"
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

const DailyChart = ({
  daily,
}: {
  daily: AdminAnalyticsPayload["daily"];
}) => {
  const max = Math.max(...daily.map((d) => d.revenueRub), 1);
  if (!daily.length) {
    return (
      <p className="py-8 text-center font-serif text-ink/40 italic">
        Нет данных за период
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <div
        className="flex h-44 min-w-full items-end gap-1.5 px-1"
        style={{ minWidth: `${Math.max(daily.length * 28, 280)}px` }}
      >
        {daily.map((day) => {
          const h = Math.max(4, Math.round((day.revenueRub / max) * 100));
          return (
            <div
              key={day.day}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${day.label}: ${formatRubCompact(day.revenueRub)} · ${day.orders} зак.`}
            >
              <div
                className="w-full max-w-[28px] rounded-t-[6px] bg-[linear-gradient(180deg,#9C6B4A,#6f4a34)] opacity-85 transition-opacity group-hover:opacity-100"
                style={{ height: `${h}%` }}
              />
              <span className="mt-2 origin-top-left rotate-[-35deg] text-[9px] tracking-wide whitespace-nowrap text-ink/40">
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-[12px] text-ink/45">
        Столбцы — выручка успешных заказов (Delivered / Closed) по дням МСК.
      </p>
    </div>
  );
};

const HourChart = ({
  byHour,
}: {
  byHour: AdminAnalyticsPayload["byHour"];
}) => {
  const max = Math.max(...byHour.map((h) => h.orders), 1);
  return (
    <div className="overflow-x-auto">
      <div
        className="flex h-36 min-w-full items-end gap-1"
        style={{ minWidth: "560px" }}
      >
        {byHour.map((slot) => {
          const h = Math.max(
            slot.orders ? 6 : 2,
            Math.round((slot.orders / max) * 100),
          );
          return (
            <div
              key={slot.hour}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${slot.label}: ${slot.orders} зак. · ${formatRubCompact(slot.revenueRub)}`}
            >
              <div
                className={`w-full max-w-[14px] rounded-t-[4px] ${
                  slot.orders
                    ? "bg-[linear-gradient(180deg,#5b6248,#3f4534)]"
                    : "bg-ink/10"
                }`}
                style={{ height: `${h}%` }}
              />
              {slot.hour % 3 === 0 ? (
                <span className="mt-1 text-[9px] text-ink/40">{slot.hour}</span>
              ) : (
                <span className="mt-1 text-[9px] text-transparent">·</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-ink/45">
        Часы оформления заказов (МСК). Высота — количество, не выручка.
      </p>
    </div>
  );
};

const TableShell = ({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) => (
  <div className="overflow-x-auto rounded-[14px] border border-ink/10">
    <table className="w-full min-w-[540px] border-collapse text-left text-[13px]">
      <thead className="bg-sand/60 text-[10px] font-semibold tracking-[0.14em] text-ink/45 uppercase">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-3 py-2.5 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/[.06] bg-paper/40">{children}</tbody>
    </table>
  </div>
);

const OverviewTab = ({ data }: { data: AdminAnalyticsPayload }) => {
  const k = data.kpis;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Выручка успешных"
          value={formatRubCompact(k.revenueCompletedRub)}
          hint={`${k.ordersCompleted} заказов · ср. чек ${formatRubCompact(k.avgCheckCompletedRub)}`}
          tone="good"
        />
        <KpiCard
          label="Заказы за период"
          value={String(k.ordersTotal)}
          hint={`В работе ${k.ordersActive} · отмены ${k.ordersCancelled} (${k.cancelRatePct}%)`}
        />
        <KpiCard
          label="Клиенты"
          value={String(k.customersTotal)}
          hint={`С заказами ${k.customersWithOrders} · без ${k.customersWithoutOrders}`}
          tone="warn"
        />
        <KpiCard
          label="В корзинах сейчас"
          value={String(k.cartUnitsTotal)}
          hint={`${k.cartsWithItems} корзин · ${formatRubCompact(k.cartValueEstimateRub)}`}
          tone="live"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Чек min / max"
          value={`${formatRubCompact(k.minCheckCompletedRub)} · ${formatRubCompact(k.maxCheckCompletedRub)}`}
        />
        <KpiCard
          label="Продано позиций"
          value={String(k.itemsSoldCompleted)}
          hint={`${k.uniqueProductsSold} уникальных · ср. ${k.avgItemsPerCompletedOrder} шт.`}
          tone="muted"
        />
        <KpiCard
          label="Доставка / самовывоз"
          value={`${k.deliveryOrders} / ${k.pickupOrders}`}
          hint={`Сборы ${formatRubCompact(k.deliveryFeesRub)}`}
        />
        <KpiCard
          label="Оплачено"
          value={formatRubCompact(k.revenuePaidRub)}
          hint={`В работе ${formatRubCompact(k.revenueActiveRub)}`}
        />
      </div>

      <Section
        title="Выручка по дням"
        subtitle={`Период: ${ANALYTICS_RANGE_LABELS[data.range]} · обновлено ${formatWhen(data.generatedAt)}`}
      >
        <DailyChart daily={data.daily} />
      </Section>
    </div>
  );
};

const CartsTab = ({ data }: { data: AdminAnalyticsPayload }) => {
  const k = data.kpis;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Товаров в корзинах"
          value={String(k.cartUnitsTotal)}
          hint={`${k.cartLinesTotal} позиций · ${k.cartsWithItems} корзин`}
          tone="live"
        />
        <KpiCard
          label="Потенциал корзин"
          value={formatRubCompact(k.cartValueEstimateRub)}
          hint="Оценка по ценам в корзине"
          tone="live"
        />
        <KpiCard
          label="Активные сессии"
          value={String(k.activeSessions)}
          hint="Клиенты с не истёкшим входом"
          tone="live"
        />
        <KpiCard
          label="Push"
          value={String(k.pushCustomers)}
          hint={`${k.pushDevices} устройств подписано`}
          tone="live"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Что лежит в корзинах"
          subtitle="Топ блюд по текущим корзинам клиентов"
        >
          {data.topCartProducts.length ? (
            <TableShell
              headers={["Блюдо", "Категория", "Шт.", "Корзин", "Сумма"]}
            >
              {data.topCartProducts.map((row) => (
                <tr key={`${row.productId}-${row.name}`}>
                  <td className="px-3 py-2.5 font-medium text-ink">
                    {row.name}
                  </td>
                  <td className="px-3 py-2.5 text-ink/55">
                    {row.categoryName || "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.qty}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.carts}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatRubCompact(row.valueRub)}
                  </td>
                </tr>
              ))}
            </TableShell>
          ) : (
            <p className="py-6 text-center text-ink/40 italic">Корзины пусты</p>
          )}
        </Section>

        <Section
          title="Брошенные корзины"
          subtitle="Последние корзины с товарами — потенциал дожима"
        >
          {data.abandonedCarts.length ? (
            <TableShell headers={["Клиент", "Шт.", "Сумма", "Обновлено"]}>
              {data.abandonedCarts.map((row) => (
                <tr key={row.cartId}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-[12px] text-ink/45">
                      {row.phone ? formatPhoneDisplay(row.phone) : "—"} ·{" "}
                      {row.fulfillmentMode === "delivery"
                        ? "доставка"
                        : "самовывоз"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.units}
                    <span className="text-ink/40"> / {row.lines}</span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatRubCompact(row.valueRub)}
                  </td>
                  <td className="px-3 py-2.5 text-ink/55">
                    {formatWhen(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </TableShell>
          ) : (
            <p className="py-6 text-center text-ink/40 italic">
              Нет заполненных корзин
            </p>
          )}
        </Section>
      </div>
    </div>
  );
};

const OrdersTab = ({ data }: { data: AdminAnalyticsPayload }) => {
  const k = data.kpis;
  const statusBars = data.byStatus.map((row) => ({
    label: ORDER_STATUS_LABELS[row.status] ?? row.status,
    value: row.count,
    meta: `${row.count} · ${formatRubCompact(row.totalRub)}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="В работе / отмены"
          value={`${formatRubCompact(k.revenueActiveRub)} / ${formatRubCompact(k.revenueCancelledRub)}`}
          hint={`${k.ordersActive} активных · ${k.cancelRatePct}% отмен`}
        />
        <KpiCard
          label="ASAP / ко времени"
          value={`${k.asapOrders} / ${k.scheduledOrders}`}
        />
        <KpiCard
          label="С аккаунтом / гости"
          value={`${k.ordersWithAccount} / ${k.ordersGuest}`}
        />
        <KpiCard
          label="iiko OK / ошибка"
          value={`${k.iikoOk} / ${k.iikoError}`}
          hint={`Прочее: ${k.iikoOther}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Section title="Статусы заказов">
          <BarRows rows={statusBars} />
        </Section>
        <Section
          title="Пиковые часы"
          subtitle="Когда чаще оформляют заказы (МСК)"
        >
          <HourChart byHour={data.byHour} />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Способ получения">
          <BarRows
            rows={data.byFulfillment.map((r) => ({
              label: r.label,
              value: r.count,
              meta: `${r.count} · ${formatRubCompact(r.totalRub)}`,
            }))}
          />
        </Section>
        <Section title="Оплата — статус">
          <BarRows
            rows={data.byPaymentStatus.map((r) => ({
              label: r.label,
              value: r.count,
              meta: `${r.count} · ${formatRubCompact(r.totalRub)}`,
            }))}
          />
        </Section>
        <Section title="Оплата — метод">
          <BarRows
            rows={data.byPaymentMethod.map((r) => ({
              label: r.label,
              value: r.count,
              meta: `${r.count} · ${formatRubCompact(r.totalRub)}`,
            }))}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Время получения">
          <BarRows
            rows={data.byTimeMode.map((r) => ({
              label: r.label,
              value: r.count,
              meta: `${r.count} · ${formatRubCompact(r.totalRub)}`,
            }))}
          />
        </Section>
        <Section title="Точки самовывоза">
          <BarRows
            rows={data.byPickupPoint.map((r) => ({
              label: r.label,
              value: r.count,
              meta: `${r.count} · ${formatRubCompact(r.totalRub)}`,
            }))}
          />
        </Section>
        <Section title="Синхронизация iiko">
          <BarRows
            rows={data.byIiko.map((r) => ({
              label: r.label,
              value: r.count,
              meta: `${r.count} · ${formatRubCompact(r.totalRub)}`,
            }))}
          />
        </Section>
      </div>
    </div>
  );
};

const CustomersTab = ({ data }: { data: AdminAnalyticsPayload }) => {
  const k = data.kpis;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Всего клиентов"
          value={String(k.customersTotal)}
          hint={`Конверсия ${pct(k.customersWithOrders, k.customersTotal)}`}
          tone="warn"
        />
        <KpiCard
          label="Повторные / разовые"
          value={`${k.repeatBuyers} / ${k.oneTimeBuyers}`}
          hint="По успешным заказам периода"
        />
        <KpiCard
          label="Новые за период"
          value={String(k.customersNewInPeriod)}
        />
        <KpiCard
          label="Яндекс / с паролем"
          value={`${k.customersYandex} / ${k.customersWithPassword}`}
          hint={`Курьеров: ${k.couriersTotal}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Клиенты с заказами"
          subtitle="Топ по сумме успешных заказов в периоде"
        >
          {data.topCustomers.length ? (
            <TableShell headers={["Клиент", "Заказов", "Сумма", "Последний"]}>
              {data.topCustomers.map((row) => (
                <tr key={row.id || row.name}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-[12px] text-ink/45">
                      {row.phone
                        ? formatPhoneDisplay(row.phone)
                        : row.email || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.ordersCount}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatRubCompact(row.spentRub)}
                  </td>
                  <td className="px-3 py-2.5 text-ink/55">
                    {formatWhen(row.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </TableShell>
          ) : (
            <p className="py-6 text-center text-ink/40 italic">
              Нет завершённых заказов с привязкой к клиенту
            </p>
          )}
        </Section>

        <Section
          title="Клиенты без заказов"
          subtitle={`Всего ${k.customersWithoutOrders} · показаны последние регистрации`}
        >
          {data.customersWithoutOrders.length ? (
            <TableShell headers={["Клиент", "Контакт", "Регистрация"]}>
              {data.customersWithoutOrders.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5 font-medium text-ink">{row.name}</td>
                  <td className="px-3 py-2.5 text-ink/55">
                    {row.phone
                      ? formatPhoneDisplay(row.phone)
                      : row.email || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-ink/55">
                    {formatWhen(row.createdAt)}
                  </td>
                </tr>
              ))}
            </TableShell>
          ) : (
            <p className="py-6 text-center text-ink/40 italic">
              Все клиенты уже делали заказ — отлично
            </p>
          )}
        </Section>
      </div>
    </div>
  );
};

const ProductsTab = ({ data }: { data: AdminAnalyticsPayload }) => {
  const k = data.kpis;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Продано позиций"
          value={String(k.itemsSoldCompleted)}
          hint="В успешных заказах"
          tone="good"
        />
        <KpiCard
          label="Уникальных блюд"
          value={String(k.uniqueProductsSold)}
        />
        <KpiCard
          label="Среднее в заказе"
          value={String(k.avgItemsPerCompletedOrder)}
          hint="Штук на успешный заказ"
          tone="muted"
        />
      </div>

      <Section
        title="Топ блюд"
        subtitle="По количеству в успешных заказах периода"
      >
        {data.topProducts.length ? (
          <TableShell
            headers={["Блюдо", "Категория", "Шт.", "Заказов", "Сумма"]}
          >
            {data.topProducts.map((row) => (
              <tr key={`${row.productId}-${row.name}`}>
                <td className="px-3 py-2.5 font-medium text-ink">{row.name}</td>
                <td className="px-3 py-2.5 text-ink/55">
                  {row.categoryName || "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{row.qty}</td>
                <td className="px-3 py-2.5 tabular-nums">{row.orders}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  {formatRubCompact(row.revenueRub)}
                </td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <p className="py-6 text-center text-ink/40 italic">
            Пока нет продаж в периоде
          </p>
        )}
      </Section>
    </div>
  );
};

export const AnalyticsPanel = ({ showToast }: AnalyticsPanelProps) => {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [tab, setTab] = useState<AnalyticsTabId>("overview");
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAdminAnalyticsAction({ range });
    setLoading(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }
    setData(result.data);
  }, [range, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMeta = useMemo(
    () => ANALYTICS_TABS.find((item) => item.id === tab) ?? ANALYTICS_TABS[0],
    [tab],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-clay uppercase">
            Движение проекта
          </p>
          <h2 className="mt-1 font-serif text-[1.7rem] tracking-[0.02em] text-ink">
            Аналитика
          </h2>
          <p className="mt-1 max-w-[40rem] text-[13px] text-ink/50">
            Разделы по смыслу — откройте нужный таб. Успешные заказы:
            «Доставлен» и «Закрыт».
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`${fieldClass} !mb-0 min-w-[10rem]`}>
            <label htmlFor="analytics-range">Период</label>
            <select
              id="analytics-range"
              className="w-full rounded-[12px] border border-ink/12 bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-clay/40"
              value={range}
              onChange={(e) => setRange(e.target.value as AnalyticsRange)}
            >
              {ANALYTICS_RANGES.map((id) => (
                <option key={id} value={id}>
                  {ANALYTICS_RANGE_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={btnLine}
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Загрузка…" : "Обновить"}
          </button>
        </div>
      </div>

      <div className="rounded-[22px] border border-ink/10 bg-white/40 p-2 shadow-[0_10px_28px_rgba(33,30,25,.03)]">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Разделы аналитики"
        >
          {ANALYTICS_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tabClass(tab === item.id)}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 pb-1 text-[12px] text-ink/45">{activeMeta.hint}</p>
      </div>

      {loading && !data ? (
        <p className="py-16 text-center font-serif text-ink/40 italic">
          Собираем аналитику…
        </p>
      ) : null}

      {data ? (
        <div role="tabpanel" aria-label={activeMeta.label}>
          {tab === "overview" ? <OverviewTab data={data} /> : null}
          {tab === "carts" ? <CartsTab data={data} /> : null}
          {tab === "orders" ? <OrdersTab data={data} /> : null}
          {tab === "customers" ? <CustomersTab data={data} /> : null}
          {tab === "products" ? <ProductsTab data={data} /> : null}
        </div>
      ) : null}
    </div>
  );
};
