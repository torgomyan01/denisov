import { CartShellGate } from "@/components/cart/CartShellGate";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import { listActivePickupPoints } from "@/lib/pickup-points";
import { getSite } from "@/lib/site";

/** Loads cart data on the server and mounts the global cart UI. */
export const SiteCart = async () => {
  try {
    const [site, pickupPoints] = await Promise.all([
      getSite(),
      listActivePickupPoints(),
    ]);
    return (
      <CartShellGate
        menu={site.menu}
        pickupPoints={pickupPoints}
        cafeHours={site.contacts.hours}
        delivery={site.delivery ?? createDefaultDeliverySettings()}
      />
    );
  } catch {
    return null;
  }
};
