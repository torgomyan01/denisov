import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CourierFulfillmentPage } from "@/components/profile/CourierFulfillmentPage";
import { getCustomer } from "@/lib/customer-auth";

export const metadata: Metadata = {
  title: "Доставка — ДЕНИСОВ",
};

export const dynamic = "force-dynamic";

export default async function ProfileCourierPage() {
  const customer = await getCustomer();
  if (!customer) {
    redirect("/auth?next=/profile/courier");
  }
  if (!customer.isCourier) {
    redirect("/profile");
  }

  return <CourierFulfillmentPage />;
}
