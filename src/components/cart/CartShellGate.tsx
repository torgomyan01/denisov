"use client";

import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartFab } from "@/components/cart/CartFab";
import type { PickupPointPublic } from "@/lib/pickup-points";
import type { DeliverySettings, SiteMenu } from "@/types/site";

type CartShellGateProps = {
  menu: SiteMenu;
  pickupPoints: PickupPointPublic[];
  cafeHours: string;
  delivery: DeliverySettings;
};

/** Global cart FAB + drawer on every public page (hidden only in admin). */
export const CartShellGate = ({
  menu,
  pickupPoints,
  cafeHours,
  delivery,
}: CartShellGateProps) => {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <CartFab />
      <CartDrawer
        menu={menu}
        pickupPoints={pickupPoints}
        cafeHours={cafeHours}
        delivery={delivery}
      />
    </>
  );
};
