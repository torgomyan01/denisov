import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuProductPage } from "@/components/site/MenuProductPage";
import { getCustomer } from "@/lib/customer-auth";
import { findMenuItemBySlug } from "@/lib/menu-lookup";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const site = await getSite();
    const found = findMenuItemBySlug(site.menu, slug);
    if (found) {
      return {
        title: `${found.item.name} — ${site.menu.title || "Меню"} — ДЕНИСОВ`,
        description:
          found.item.description || site.meta.description || undefined,
      };
    }
    return { title: `${site.menu.title || "Меню"} — ДЕНИСОВ` };
  } catch {
    return { title: "Меню — ДЕНИСОВ" };
  }
}

export default async function MenuProductRoute({ params }: PageProps) {
  const { slug } = await params;
  const [site, customer] = await Promise.all([getSite(), getCustomer()]);
  const found = findMenuItemBySlug(site.menu, slug);
  if (!found) notFound();
  return (
    <MenuProductPage
      site={site}
      item={found.item}
      category={found.category}
      customer={customer}
    />
  );
}
