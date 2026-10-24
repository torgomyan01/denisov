"use client";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartFab } from "@/components/cart/CartFab";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import type { PickupPointPublic } from "@/lib/pickup-points";
import type { DeliverySettings, SiteMenu } from "@/types/site";

type CartShellProps = {
  menu: SiteMenu;
  pickupPoints: PickupPointPublic[];
  cafeHours: string;
  delivery?: DeliverySettings;
};

/** Floating cart button + fixed right drawer with slide animation. */
export const CartShell = ({
  menu,
  pickupPoints,
  cafeHours,
  delivery = createDefaultDeliverySettings(),
}: CartShellProps) => (
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
