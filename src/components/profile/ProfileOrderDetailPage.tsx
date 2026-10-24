"use client";

import { ChevronLeft, Clock3 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getMyOrderAction } from "@/actions/orders";
import { OrderFulfillmentQr } from "@/components/orders/OrderFulfillmentQr";
import {
  profileBack,
  profileBadge,
  profileBlockTitle,
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
import {
  customerFlowStepLabel,
  customerOrderFlow,
  getCustomerOrderStatusView,
} from "@/lib/order-customer";
import type { OrderPublic } from "@/lib/orders";

const itemsBlockClass = "mt-5 border-t border-ink/10 pt-4";

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

type ProfileOrderDetailPageProps = {
  orderId: string;
};

export const ProfileOrderDetailPage = ({
  orderId,
}: ProfileOrderDetailPageProps) => {
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await getMyOrderAction(orderId);
    if (!result.success || !result.data) {
      setError(result.success ? "Заказ не найден" : result.error);
      setOrder(null);
      setLoading(false);
      return;
    }
    setOrder(result.data);
    setError("");
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div className={profilePanelCard}>
        <p className={profileOrdersMuted}>Загрузка заказа…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={profilePanelCard}>
        <Link href="/profile/orders" className={profileBack}>
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          К заказам
        </Link>
        <h2 className={profileTitle}>Заказ не найден</h2>
        <p className={profileOrdersError}>{error}</p>
      </div>
    );
  }

  const view = getCustomerOrderStatusView(order);
  const flow = customerOrderFlow(order.fulfillmentMode);
  const currentIdx = flow.indexOf(order.status);

  return (
    <div className={profilePanelCard}>
      <header className={profilePanelHead}>
        <div>
          <Link href="/profile/orders" className={profileBack}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            К заказам
          </Link>
          <p className={profileBadge}>Заказ</p>
          <h2 className={profileTitle}>{order.number}</h2>
          <p className={profileLead}>
            {order.fulfillmentMode === "delivery" ? "Доставка" : "Самовывоз"} ·{" "}
            {formatWhen(order.createdAt)}
          </p>
        </div>
      </header>

      <section className="mt-1 rounded-2xl border border-clay/22 bg-[image:linear-gradient(145deg,rgba(156,107,74,0.1),rgba(255,255,255,0.7))] px-[1.05rem] py-4">
        <div className="flex flex-col items-start gap-[0.45rem]">
          <span className={profileOrderStatus(order.status)}>{view.title}</span>
          <strong className="font-sans text-[1.05rem] leading-[1.35] font-[650]">
            {view.detail}
          </strong>
        </div>
        <div className={profileOrderEta(true)}>
          <Clock3 size={16} strokeWidth={2} aria-hidden="true" />
          <span>{view.eta}</span>
        </div>
        {order.status !== "cancelled" && order.status !== "completed" ? (
          <div className={profileOrderProgress(true)} aria-hidden="true">
            <span
              className={profileOrderProgressBar}
              style={{ width: `${view.progress}%` }}
            />
          </div>
        ) : null}
        <p className="mt-[0.65rem] text-[0.78rem] text-ink/48">
          Время ориентировочное — зависит от загрузки кухни и дороги.
        </p>
      </section>

      {order.status !== "cancelled" ? (
        <ol className="mt-[1.15rem] flex flex-col">
          {flow.map((step, index) => {
            const done =
              order.status === "completed" ||
              (currentIdx >= 0 && index < currentIdx);
            const current = step === order.status;
            return (
              <li
                key={step}
                className={`relative grid grid-cols-[18px_1fr] items-start gap-[0.7rem] py-[0.55rem] not-last:before:absolute not-last:before:top-[1.45rem] not-last:before:-bottom-[0.15rem] not-last:before:left-2 not-last:before:w-px not-last:before:bg-ink/12 not-last:before:content-[''] ${
                  current || done ? "text-ink" : "text-ink/48"
                }`}
              >
                <span
                  className={`relative z-[1] mt-[0.3rem] ml-1 size-2.5 rounded-full ${
                    current
                      ? "bg-clay-deep shadow-[0_0_0_4px_rgba(156,107,74,0.18)]"
                      : done
                        ? "bg-clay"
                        : "bg-ink/18"
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <strong className="block text-[0.92rem]">
                    {customerFlowStepLabel(step)}
                  </strong>
                  {current ? (
                    <em className="mt-[0.1rem] inline-block text-[0.75rem] tracking-[0.08em] text-clay uppercase not-italic">
                      Сейчас
                    </em>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {order.fulfillmentToken ? (
        <section>
          <OrderFulfillmentQr
            token={order.fulfillmentToken}
            orderNumber={order.number}
            fulfillmentMode={order.fulfillmentMode}
            status={order.status}
          />
        </section>
      ) : null}

      <section className={itemsBlockClass}>
        <h3 className={profileBlockTitle}>Состав</h3>
        <ul className="mt-[0.65rem] flex flex-col gap-[0.65rem]">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[52px_1fr] items-center gap-3"
            >
              <div className="size-[52px] overflow-hidden rounded-[10px] bg-ink/5">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="block size-full object-cover"
                    src={item.image}
                    alt=""
                  />
                ) : (
                  <span />
                )}
              </div>
              <div>
                <strong className="block text-[0.92rem]">{item.name}</strong>
                <span className="mt-[0.15rem] block text-[0.8rem] text-ink/48">
                  {item.qty} шт. · {item.lineTotalRub} ₽
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-[0.85rem] flex items-baseline justify-between border-t border-dashed border-ink/10 pt-3">
          <span>Итого</span>
          <strong className="font-serif text-[1.45rem]">
            {order.totalRub} ₽
          </strong>
        </div>
      </section>

      {order.statusLogs.length ? (
        <section className={itemsBlockClass}>
          <h3 className={profileBlockTitle}>История</h3>
          <ol className="mt-[0.55rem] list-none">
            {[...order.statusLogs].reverse().map((log) => (
              <li
                key={log.id}
                className="flex justify-between gap-3 border-b border-ink/6 py-[0.4rem] text-[0.88rem]"
              >
                <strong>{customerFlowStepLabel(log.status)}</strong>
                <span className="whitespace-nowrap text-ink/48">
                  {formatWhen(log.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
};
