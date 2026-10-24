import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";

export const metadata: Metadata = {
  title: "Админ — ДЕНИСОВ",
};

export default function AdminPage() {
  return <AdminApp />;
}
