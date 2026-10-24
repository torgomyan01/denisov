"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { FulfillmentMode } from "@/lib/customer-auth";
import { encodeFulfillmentQrPayload, type OrderStatus } from "@/lib/orders";

type OrderFulfillmentQrProps = {
  token: string;
  orderNumber: string;
  fulfillmentMode: FulfillmentMode;
  status: OrderStatus;
  className?: string;
};

export const OrderFulfillmentQr = ({
  token,
  orderNumber,
  fulfillmentMode,
  status,
  className = "",
}: OrderFulfillmentQrProps) => {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(encodeFulfillmentQrPayload(token), {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1a1a1a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "cancelled") return null;

  const done = status === "completed";
  const hint =
    fulfillmentMode === "pickup"
      ? "Покажите этот QR на точке самовывоза"
      : "Покажите этот QR курьеру при получении";

  return (
    <div
      className={[
        "flex w-full flex-col items-center gap-3.5 rounded-[14px] border border-ink/8 bg-ink/[0.03] px-3.5 py-4",
        done ? "opacity-70" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid place-items-center rounded-xl bg-white p-2.5 shadow-[0_8px_24px_rgba(33,30,25,0.08)]">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR заказа ${orderNumber}`}
            className="block size-[200px]"
          />
        ) : (
          <div
            className="size-[200px] animate-qr-shimmer bg-[linear-gradient(110deg,rgba(33,30,25,0.06),rgba(33,30,25,0.12),rgba(33,30,25,0.06))] bg-[length:200%_100%]"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="text-center">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-ink/55">
          {done ? "Заказ выдан" : "Код получения"}
        </p>
        <p className="mt-1.5 mb-0 max-w-[28ch] text-[0.9rem] leading-snug text-ink/70">
          {done ? "QR уже использован" : hint}
        </p>
        <p
          className="mt-2.5 mb-0 font-mono text-[0.82rem] font-semibold leading-tight tracking-wide text-clay"
          aria-label="Код заказа"
        >
          {token.slice(0, 4)} · {token.slice(4, 8)} · {token.slice(8, 12)} ·{" "}
          {token.slice(12)}
        </p>
      </div>
    </div>
  );
};
