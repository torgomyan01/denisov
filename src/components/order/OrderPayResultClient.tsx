"use client";

import { useEffect } from "react";
import { METRIKA_GOALS, reachMetrikaGoal } from "@/lib/yandex-metrika";

type OrderPayResultClientProps = {
  orderId: string;
  orderNumber: string;
  totalRub: number;
};

/** Fires Metrika order_success once after confirmed online payment. */
export const OrderPayResultClient = ({
  orderId,
  orderNumber,
  totalRub,
}: OrderPayResultClientProps) => {
  useEffect(() => {
    const key = `metrika_order_success_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode */
    }
    reachMetrikaGoal(METRIKA_GOALS.orderSuccess, {
      order_id: orderId,
      order_number: orderNumber,
      total_rub: totalRub,
      payment: "sber",
    });
  }, [orderId, orderNumber, totalRub]);

  return null;
};
