"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — scan lives inside AdminApp as `#fulfillment`. */
export default function AdminOrderScanRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin#fulfillment");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-ink">
      <p className="px-6 pt-8 text-sm text-ink/48">Переход к выдаче…</p>
    </div>
  );
}
