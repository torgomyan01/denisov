import type { Metadata } from "next";
import { MenuPageView } from "@/components/site/MenuPage";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const site = await getSite();
    return {
      title: `${site.menu.title || "Меню"} — ДЕНИСОВ`,
      description:
        site.meta.description ||
        "Меню кафе ДЕНИСОВ — домашняя кухня, выпечка и напитки на Московском проспекте.",
    };
  } catch {
    return { title: "Меню — ДЕНИСОВ" };
  }
}

export default async function MenuPage() {
  const site = await getSite();
  return <MenuPageView site={site} />;
}
