"use client";

import { OrderScanPanel } from "@/components/admin/OrderScanPage";
import {
  profileBadge,
  profileLead,
  profileTitle,
} from "@/components/profile/profile-styles";

export const CourierFulfillmentPage = () => (
  <div className="flex flex-col gap-4">
    <div>
      <p className={profileBadge}>Курьер</p>
      <h1 className={profileTitle}>Доставка</h1>
      <p className={profileLead}>
        Сканируйте QR на пакете, проверьте заказ и подтвердите передачу клиенту.
      </p>
    </div>
    <OrderScanPanel variant="courier" />
  </div>
);
