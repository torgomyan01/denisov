"use client";

import { btnDark, btnLine, orderBadgeClass, toastClass } from "@/components/admin/styles";
import { ArrowLeft, MapPin, Phone, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getOrderAdminAction,
  updateOrderStatusAction,
} from "@/actions/orders";
import { OrderDeliveryMapModal } from "@/components/admin/OrderDeliveryMapModal";
import { OrderPrintLabel } from "@/components/admin/OrderPrintLabel";
import {
  ORDER_STATUS_HINTS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  canFulfillOrderByQr,
  nextOrderStatuses,
  type OrderPublic,
  type OrderStatus,
} from "@/lib/orders";
import { formatPhoneDisplay } from "@/lib/phone";

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

type OrderDetailPanelProps = {
  orderId: string;
  onBack: () => void;
  onOrdersChanged?: () => void;
};

export const OrderDetailPanel = ({
  orderId,
  onBack,
  onOrdersChanged,
}: OrderDetailPanelProps) => {
  const [booting, setBooting] = useState(true);
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliveryMapOpen, setDeliveryMapOpen] = useState(false);
  const [toast, setToast] = useState({
    text: "",
    tone: "success" as "success" | "error",
  });
  const [toastVisible, setToastVisible] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const showToast = useCallback(
    (msg: string, tone: "success" | "error" = "success") => {
      setToast({ text: msg, tone });
      setToastVisible(true);
      window.setTimeout(() => setToastVisible(false), 2600);
    },
    [],
  );

  const load = useCallback(async () => {
    setBooting(true);
    const result = await getOrderAdminAction(orderId);
    if (!result.success || !result.data) {
      setError(result.success ? "Заказ не найден" : result.error);
      setOrder(null);
      setBooting(false);
      return;
    }
    setOrder(result.data);
    setError("");
    setBooting(false);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (status: OrderStatus) => {
    if (!order || busy) return;
    setBusy(true);
    const result = await updateOrderStatusAction({
      orderId: order.id,
      status,
    });
    setBusy(false);
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка" : result.error, "error");
      return;
    }
    setOrder(result.data);
    showToast(`Статус: ${ORDER_STATUS_LABELS[status]}`, "success");
    try {
      window.localStorage.setItem(
        "denisov_admin_orders_bump",
        String(Date.now()),
      );
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("denisov-orders-changed"));
    onOrdersChanged?.();
  };

  const toastPortal =
    portalReady && typeof document !== "undefined"
      ? createPortal(
          <div
            className={toastClass(toast.tone, toastVisible)}
            role="status"
            aria-live="polite"
          >
            {toast.text}
          </div>,
          document.body,
        )
      : null;

  if (booting) {
    return (
      <div className="animate-panel-in">
        <p className="text-sm text-ink/48">Загрузка заказа…</p>
        {toastPortal}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="animate-panel-in">
        <button
          type="button"
          className="mb-[1.1rem] inline-flex cursor-pointer items-center gap-[0.35rem] border-0 bg-transparent p-0 font-sans text-xs font-[650] uppercase leading-none tracking-[0.1em] text-clay hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          К списку заказов
        </button>
        <h2 className="mt-[0.2rem] font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15]">
          Заказ не найден
        </h2>
        <p className="text-sm text-ink/48">{error}</p>
        {toastPortal}
      </div>
    );
  }

  const next = nextOrderStatuses(order.status, order.fulfillmentMode).filter(
    (status) => status !== "completed",
  );
  const workflowNext = next.filter((status) => status !== "cancelled");
  const awaitQrHandover =
    workflowNext.length === 0 &&
    (order.status === "ready" || order.status === "delivering") &&
    canFulfillOrderByQr(order.status, order.fulfillmentMode);

  return (
    <div className="animate-panel-in">
      <button
        type="button"
        className="mb-[1.1rem] inline-flex cursor-pointer items-center gap-[0.35rem] border-0 bg-transparent p-0 font-sans text-xs font-[650] uppercase leading-none tracking-[0.1em] text-clay hover:text-ink"
        onClick={onBack}
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        К списку заказов
      </button>

      <header className="mb-[1.15rem] flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-ink/55">
            Заказ
          </p>
          <h2 className="mt-[0.2rem] font-serif text-[clamp(1.55rem,2.4vw,2.1rem)] leading-[1.05]">
            {order.number}
          </h2>
          <p className="mt-[0.35rem] text-[0.9rem] text-ink/48">
            {ORDER_STATUS_HINTS[order.status]}
          </p>
          <p className="mt-[0.35rem] text-[0.9rem] text-ink/48">
            Создан {formatWhen(order.createdAt)} · обновлён{" "}
            {formatWhen(order.statusUpdatedAt)}
          </p>
        </div>
        <span className={orderBadgeClass(order.status)}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </header>

      <div className="mb-[0.85rem] grid grid-cols-3 gap-[0.85rem] max-[820px]:grid-cols-1">
        <section className="rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] shadow-[0_10px_28px_rgba(33,30,25,0.04)] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55 [&_p]:mt-1 [&_p]:text-[0.92rem]">
          <h2>Клиент</h2>
          <p className="font-sans text-[1.05rem]! font-[650]! leading-[1.3]! text-ink">
            {order.customerName || "—"}
          </p>
          <p className="flex items-center gap-[0.4rem]">
            <Phone size={15} strokeWidth={2} aria-hidden="true" />
            {order.customerPhone
              ? formatPhoneDisplay(order.customerPhone)
              : "—"}
          </p>
          {order.customerEmail ? <p>{order.customerEmail}</p> : null}
        </section>

        <section className="rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] shadow-[0_10px_28px_rgba(33,30,25,0.04)] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55 [&_p]:mt-1 [&_p]:text-[0.92rem]">
          <h2>Получение</h2>
          <p className="font-sans text-[1.05rem]! font-[650]! leading-[1.3]! text-ink">
            {order.fulfillmentMode === "delivery" ? "Доставка" : "Самовывоз"}
          </p>
          {order.fulfillmentMode === "pickup" ? (
            <>
              <p className="flex items-center gap-[0.4rem]">
                <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                {order.pickupPointName || "—"}
              </p>
              <p>{order.pickupPointAddress}</p>
            </>
          ) : (
            <div className="mt-[0.35rem] flex flex-col gap-[0.65rem]">
              {order.deliveryAddress ? (
                <p>{order.deliveryAddress}</p>
              ) : (
                <p className="text-sm text-ink/48">
                  Адрес выбран на карте клиентом
                </p>
              )}
              {(order.deliveryApartment ||
                order.deliveryEntrance ||
                order.deliveryFloor ||
                order.deliveryIntercom) && (
                <p className="text-[0.88rem] leading-[1.4] text-ink/72">
                  {[
                    order.deliveryApartment
                      ? `кв. ${order.deliveryApartment}`
                      : null,
                    order.deliveryEntrance
                      ? `подъезд ${order.deliveryEntrance}`
                      : null,
                    order.deliveryFloor ? `этаж ${order.deliveryFloor}` : null,
                    order.deliveryIntercom
                      ? `домофон ${order.deliveryIntercom}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {order.deliveryCourierComment ? (
                <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-[0.88rem] leading-[1.4] text-ink/70">
                  Курьеру: {order.deliveryCourierComment}
                </p>
              ) : null}
              {order.deliveryLat != null && order.deliveryLng != null ? (
                <button
                  type="button"
                  className={`${btnDark} w-fit`}
                  onClick={() => setDeliveryMapOpen(true)}
                >
                  <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                  Открыть на карте
                </button>
              ) : (
                <p className="text-sm text-ink/48">Координаты не указаны</p>
              )}
            </div>
          )}
          <p>
            Время:{" "}
            {order.timeMode === "asap"
              ? "Как можно скорее"
              : order.scheduledAt
                ? formatWhen(order.scheduledAt)
                : "—"}
          </p>
          {order.utensils > 0 ? (
            <p className="flex items-center gap-[0.4rem]">
              <Utensils size={15} strokeWidth={2} aria-hidden="true" />
              Приборы: {order.utensils}
            </p>
          ) : null}
          {order.comment ? (
            <p className="mt-[0.55rem]! rounded-[10px] bg-ink/4 px-[0.65rem] py-[0.55rem] italic">
              «{order.comment}»
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] shadow-[0_10px_28px_rgba(33,30,25,0.04)] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55 [&_p]:mt-1 [&_p]:text-[0.92rem]">
          <h2>Оплата</h2>
          <p className="font-sans text-[1.05rem]! font-[650]! leading-[1.3]! text-ink">
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </p>
          <p>
            {order.paymentMethod === "card_test"
              ? "Тестовая карта"
              : order.paymentMethod}
          </p>
          {order.paidAt ? <p>Оплачен: {formatWhen(order.paidAt)}</p> : null}
          <p className="mt-[0.65rem]! font-serif text-[1.45rem]! font-semibold">
            {order.totalRub} ₽
          </p>
        </section>
      </div>

      {order.status !== "cancelled" ? (
        <div className="mb-[0.85rem]">
          <OrderPrintLabel order={order} />
        </div>
      ) : null}

      <section className="mb-[0.85rem] rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] shadow-[0_10px_28px_rgba(33,30,25,0.04)] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55 [&_p]:mt-1 [&_p]:text-[0.92rem]">
        <div className="mb-[0.35rem] flex items-baseline justify-between gap-3 [&_span]:text-[0.85rem] [&_span]:text-ink/55">
          <h2>Состав заказа</h2>
          <span>
            {order.items.reduce((sum, item) => sum + item.qty, 0)} шт.
          </span>
        </div>
        <ul className="m-0 flex flex-col gap-[0.65rem] p-0">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-[0.85rem] border-b border-ink/6 py-[0.55rem] last:border-b-0 max-[560px]:grid-cols-[56px_minmax(0,1fr)]"
            >
              <div className="grid size-[72px] place-items-center overflow-hidden rounded-xl bg-ink/5 text-[0.7rem] text-ink/40 max-[560px]:size-14 [&_img]:block [&_img]:size-full [&_img]:object-cover">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" />
                ) : (
                  <span>Нет фото</span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-[0.15rem] [&_strong]:text-base [&_em]:text-[0.8rem] [&_em]:not-italic [&_em]:text-ink/50">
                <strong>{item.name}</strong>
                {item.categoryName ? <em>{item.categoryName}</em> : null}
                <span className="text-[0.85rem] text-ink/65">
                  {item.qty} шт. · {item.price || `${item.lineTotalRub} ₽`}
                </span>
              </div>
              <div className="flex flex-col gap-[0.2rem] text-right max-[560px]:col-start-2 max-[560px]:flex-row max-[560px]:gap-[0.65rem] max-[560px]:text-left [&_span]:text-[0.8rem] [&_span]:text-ink/50 [&_strong]:text-[1.05rem]">
                <span>×{item.qty}</span>
                <strong>{item.lineTotalRub} ₽</strong>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-ink/14 pt-3 [&_strong]:font-serif [&_strong]:text-[1.5rem]">
          <span>Итого</span>
          <strong>{order.totalRub} ₽</strong>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] shadow-[0_10px_28px_rgba(33,30,25,0.04)] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55 [&_p]:mt-1 [&_p]:text-[0.92rem]">
        <h2>История статусов</h2>
        <ol className="mb-0 pl-[1.1rem] [&_li]:my-[0.35rem] [&_li]:text-[0.86rem] [&_span]:ml-[0.45rem] [&_span]:inline-block [&_span]:text-ink/55 [&_em]:block [&_em]:not-italic [&_em]:text-ink/55">
          {order.statusLogs.map((log) => (
            <li key={log.id}>
              <strong>{ORDER_STATUS_LABELS[log.status]}</strong>
              <span>{formatWhen(log.createdAt)}</span>
              {log.note ? <em>{log.note}</em> : null}
            </li>
          ))}
        </ol>
      </section>

      {order.status === "completed" && order.fulfilledAt ? (
        <p className="mt-[0.85rem] text-[0.95rem] text-ink/60">
          Выдан {formatWhen(order.fulfilledAt)} · через сканер QR
        </p>
      ) : null}

      {awaitQrHandover ? (
        <section className="mt-[0.85rem] rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55">
          <h2>Выдача</h2>
          <p className="mt-[0.35rem] text-[0.9rem] text-ink/48">
            Финальную передачу подтверждайте в разделе «Выдача по QR» в меню
            админки.
          </p>
          {next.includes("cancelled") ? (
            <div className="mt-3 flex flex-wrap gap-[0.55rem]">
              <button
                type="button"
                className={btnLine}
                disabled={busy}
                onClick={() => void setStatus("cancelled")}
              >
                Отменить заказ
              </button>
            </div>
          ) : null}
        </section>
      ) : next.length ? (
        <section className="mt-[0.85rem] rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] [&_h2]:mb-[0.55rem] [&_h2]:text-[0.72rem] [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-ink/55">
          <h2>Следующий этап</h2>
          <div className="flex flex-wrap gap-[0.55rem]">
            {next.map((status) => (
              <button
                key={status}
                type="button"
                className={status === "cancelled" ? btnLine : btnDark}
                disabled={busy}
                onClick={() => void setStatus(status)}
              >
                {status === "cancelled"
                  ? "Отменить заказ"
                  : `→ ${ORDER_STATUS_LABELS[status]}`}
              </button>
            ))}
          </div>
        </section>
      ) : order.status === "completed" || order.status === "cancelled" ? (
        <p className="mt-[0.85rem] text-sm text-ink/48">
          Заказ завершён — дальнейших этапов нет.
        </p>
      ) : null}

      {toastPortal}
      {order.deliveryLat != null && order.deliveryLng != null ? (
        <OrderDeliveryMapModal
          open={deliveryMapOpen}
          lat={order.deliveryLat}
          lng={order.deliveryLng}
          customerName={order.customerName}
          onClose={() => setDeliveryMapOpen(false)}
        />
      ) : null}
    </div>
  );
};
