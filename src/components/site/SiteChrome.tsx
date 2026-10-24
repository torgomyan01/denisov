import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCustomer } from "@/lib/customer-auth";
import { getSite } from "@/lib/site";

type SiteChromeProps = {
  children: ReactNode;
};

/** Shared site chrome: same main nav on every public customer page. */
export const SiteChrome = async ({ children }: SiteChromeProps) => {
  const [site, customer] = await Promise.all([getSite(), getCustomer()]);
  return (
    <>
      <SiteHeader site={site} customer={customer} />
      {children}
    </>
  );
};
