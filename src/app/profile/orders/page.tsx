import type { Metadata } from "next";
import { ProfileOrdersPage } from "@/components/profile/ProfileOrdersPage";

export const metadata: Metadata = {
  title: "Мои заказы — ДЕНИСОВ",
  description: "Статусы и история ваших заказов в кафе Денисов",
};

export default function ProfileOrdersRoutePage() {
  return <ProfileOrdersPage />;
}
