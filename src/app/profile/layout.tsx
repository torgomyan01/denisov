import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ProfileWorkspace } from "@/components/profile/ProfileWorkspace";
import { SiteChrome } from "@/components/site/SiteChrome";
import { getCustomer } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const customer = await getCustomer();
  if (!customer) {
    redirect("/auth?next=/profile");
  }

  return (
    <SiteChrome>
      <main>
        <ProfileWorkspace customer={customer}>{children}</ProfileWorkspace>
      </main>
    </SiteChrome>
  );
}
