import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { getCustomer } from "@/lib/customer-auth";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import { listActivePickupPoints } from "@/lib/pickup-points";
import { getSite } from "@/lib/site";

export const metadata: Metadata = {
  title: "Личные данные — ДЕНИСОВ",
  description: "Личный кабинет гостя кафе Денисов",
};

export default async function ProfileRoutePage() {
  const customer = await getCustomer();
  // layout already redirects; keep for type narrowing
  if (!customer) return null;
  const [pickupPoints, site] = await Promise.all([
    listActivePickupPoints(),
    getSite(),
  ]);
  return (
    <ProfilePage
      customer={customer}
      pickupPoints={pickupPoints}
      delivery={site.delivery ?? createDefaultDeliverySettings()}
    />
  );
}
