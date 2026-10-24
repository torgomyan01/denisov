import type { Metadata } from "next";
import { ProfileOrderDetailPage } from "@/components/profile/ProfileOrderDetailPage";

export const metadata: Metadata = {
  title: "Заказ — ДЕНИСОВ",
  description: "Статус вашего заказа в кафе Денисов",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfileOrderDetailRoutePage({
  params,
}: PageProps) {
  const { id } = await params;
  return <ProfileOrderDetailPage orderId={id} />;
}
