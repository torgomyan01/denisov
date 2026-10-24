import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { getCustomer } from "@/lib/customer-auth";
import { listActivePickupPoints } from "@/lib/pickup-points";

export const metadata: Metadata = {
  title: "Личные данные — ДЕНИСОВ",
  description: "Личный кабинет гостя кафе Денисов",
};

export default async function ProfileRoutePage() {
  const customer = await getCustomer();
  // layout already redirects; keep for type narrowing
  if (!customer) return null;
  const pickupPoints = await listActivePickupPoints();
  return <ProfilePage customer={customer} pickupPoints={pickupPoints} />;
}
