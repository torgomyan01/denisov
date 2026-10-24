"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy URL — order card lives inside AdminApp as `#order/[id]`. */
export default function AdminOrderRoute() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (!id) {
      router.replace("/admin#orders");
      return;
    }
    router.replace(`/admin#order/${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-ink">
      <p className="px-6 pt-8 text-sm text-ink/48">Переход к заказу…</p>
    </div>
  );
}
