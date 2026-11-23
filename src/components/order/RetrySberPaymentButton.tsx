"use client";

import { useState } from "react";
import { retrySberPaymentAction } from "@/actions/orders";

type RetrySberPaymentButtonProps = {
  orderId: string;
  className?: string;
  label?: string;
};

export const RetrySberPaymentButton = ({
  orderId,
  className,
  label = "Оплатить снова",
}: RetrySberPaymentButtonProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await retrySberPaymentAction({ orderId });
      if (!result.success || !result.data?.paymentUrl) {
        setError(
          result.success ? "Не удалось создать ссылку" : result.error,
        );
        return;
      }
      window.location.assign(result.data.paymentUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={
          className ??
          "inline-flex cursor-pointer items-center justify-center rounded-full bg-clay px-5 py-[0.85rem] text-[0.82rem] font-[650] tracking-[0.1em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-55"
        }
        disabled={busy}
        onClick={() => void onClick()}
      >
        {busy ? "Создаём оплату…" : label}
      </button>
      {error ? (
        <p className="m-0 text-[0.85rem] leading-[1.4] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
