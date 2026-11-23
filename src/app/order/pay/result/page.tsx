import type { Metadata } from "next";
import Link from "next/link";
import { OrderPayResultClient } from "@/components/order/OrderPayResultClient";
import { RetrySberPaymentButton } from "@/components/order/RetrySberPaymentButton";
import { canRetryOnlinePayment } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { sberGetOrderStatus } from "@/lib/sber/client";
import {
  fulfillSberPaidOrder,
  markSberOrderFailed,
  markSberOrderRefunded,
} from "@/lib/sber/fulfill-paid-order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оплата заказа — ДЕНИСОВ",
  description: "Результат оплаты заказа в кафе Денисов",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

export default async function OrderPayResultPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusHint = first(params.status).toLowerCase();
  const sberOrderId = (
    first(params.orderId) ||
    first(params.mdOrder) ||
    ""
  ).trim();
  const orderNumber = first(params.orderNumber).trim();

  const orderSelect = {
    id: true,
    number: true,
    paymentStatus: true,
    paymentMethod: true,
    status: true,
    sberOrderId: true,
    totalRub: true,
  } as const;

  let order =
    (sberOrderId
      ? await prisma.order.findFirst({
          where: { sberOrderId },
          select: orderSelect,
        })
      : null) ||
    (orderNumber
      ? await prisma.order.findFirst({
          where: { number: orderNumber },
          select: orderSelect,
        })
      : null);

  let outcome: "paid" | "pending" | "failed" | "refunded" | "unknown" =
    "unknown";

  if (order?.paymentStatus === "refunded") {
    outcome = "refunded";
  } else if (order?.sberOrderId) {
    const gateway = await sberGetOrderStatus({
      sberOrderId: order.sberOrderId,
    });
    if (gateway.ok && gateway.deposited) {
      const fulfilled = await fulfillSberPaidOrder(order.id);
      if (fulfilled.ok) {
        outcome = "paid";
        order = { ...order, paymentStatus: "paid" };
      } else if (fulfilled.error === "Оплата уже возвращена") {
        outcome = "refunded";
        order = { ...order, paymentStatus: "refunded" };
      } else {
        outcome = "pending";
      }
    } else if (
      gateway.ok &&
      (gateway.orderStatus === 3 || gateway.orderStatus === 4)
    ) {
      await markSberOrderRefunded(
        order.id,
        `Sber return: статус ${gateway.orderStatus}`,
      );
      outcome = "refunded";
      order = { ...order, paymentStatus: "refunded" };
    } else if (gateway.ok && gateway.declined) {
      await markSberOrderFailed(
        order.id,
        `Оплата отклонена (return ${statusHint || "fail"})`,
      );
      outcome = "failed";
      order = { ...order, paymentStatus: "failed" };
    } else if (order.paymentStatus === "paid") {
      outcome = "paid";
    } else if (statusHint === "fail") {
      outcome = "failed";
    } else {
      outcome = "pending";
    }
  } else if (statusHint === "ok") {
    outcome = "pending";
  } else if (statusHint === "fail") {
    outcome = "failed";
  }

  const title =
    outcome === "paid"
      ? "Оплата прошла"
      : outcome === "refunded"
        ? "Оплата возвращена"
        : outcome === "failed"
          ? "Оплата не прошла"
          : outcome === "pending"
            ? "Проверяем оплату"
            : "Результат оплаты";

  const message =
    outcome === "paid"
      ? "Спасибо! Заказ оплачен и отправлен на кухню."
      : outcome === "refunded"
        ? "Средства по этому заказу возвращены на карту."
        : outcome === "failed"
          ? "Платёж отклонён или отменён. Можно оплатить этот же заказ снова — без нового оформления."
          : outcome === "pending"
            ? "Если вы уже оплатили — статус обновится через несколько секунд. Обновите страницу или откройте заказ в профиле. Если оплата не завершена — нажмите «Оплатить снова»."
            : "Не удалось сопоставить платёж с заказом. Откройте заказ в личном кабинете.";

  const showPayAgain =
    order != null &&
    canRetryOnlinePayment({
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
    }) &&
    (outcome === "failed" || outcome === "pending" || outcome === "unknown");

  return (
    <main className="relative min-h-[70vh] overflow-hidden bg-[radial-gradient(90%_70%_at_12%_0%,rgba(156,107,74,0.14),transparent_55%),radial-gradient(70%_60%_at_100%_10%,rgba(107,143,113,0.12),transparent_50%),linear-gradient(180deg,#f7f3ea_0%,#efe8db_100%)] px-5 py-16 text-ink">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <p className="text-[11px] font-[650] tracking-[0.16em] text-clay uppercase">
          ДЕНИСОВ · Оплата
        </p>
        <h1 className="font-serif text-[2.1rem] leading-[1.15] font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        {order ? (
          <p className="text-[1.05rem] font-[650] tracking-[0.04em] text-clay">
            Заказ № {order.number}
          </p>
        ) : null}
        <p className="max-w-[40ch] text-[0.98rem] leading-[1.5] text-ink/68">
          {message}
        </p>
        {showPayAgain && order ? (
          <RetrySberPaymentButton orderId={order.id} />
        ) : null}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {order ? (
            <Link
              href={`/profile/orders/${order.id}`}
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-[0.85rem] text-[0.82rem] font-[650] tracking-[0.1em] text-paper uppercase transition-opacity hover:opacity-90"
            >
              Открыть заказ
            </Link>
          ) : (
            <Link
              href="/profile/orders"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-[0.85rem] text-[0.82rem] font-[650] tracking-[0.1em] text-paper uppercase transition-opacity hover:opacity-90"
            >
              Мои заказы
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white/60 px-5 py-[0.85rem] text-[0.82rem] font-[650] tracking-[0.1em] text-ink/70 uppercase transition-colors hover:border-ink/30 hover:text-ink"
          >
            На главную
          </Link>
        </div>
        {outcome === "paid" && order ? (
          <OrderPayResultClient
            orderId={order.id}
            orderNumber={order.number}
            totalRub={order.totalRub}
          />
        ) : null}
      </div>
    </main>
  );
}
