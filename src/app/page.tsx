import type { Metadata } from "next";
import { HomePage } from "@/components/site/HomePage";
import { getCustomer } from "@/lib/customer-auth";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const site = await getSite();
    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    return {
      title: site.meta.title,
      description: site.meta.description,
      keywords: site.meta.keywords,
      openGraph: {
        title: site.meta.title,
        description: site.meta.description,
        locale: site.meta.locale || "ru_RU",
        type: "website",
        url: siteUrl,
        images: site.meta.ogImage
          ? [
              {
                url: site.meta.ogImage.startsWith("http")
                  ? site.meta.ogImage
                  : `${siteUrl}${site.meta.ogImage}`,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: site.meta.title,
        description: site.meta.description,
      },
      alternates: {
        canonical: siteUrl,
      },
    };
  } catch {
    return {
      title: "ДЕНИСОВ — Кафе и пекарня",
    };
  }
}

export default async function Page() {
  const [site, customer] = await Promise.all([getSite(), getCustomer()]);
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: site.hero.title || "ДЕНИСОВ",
    description: site.meta.description,
    image: site.meta.ogImage
      ? site.meta.ogImage.startsWith("http")
        ? site.meta.ogImage
        : `${siteUrl}${site.meta.ogImage}`
      : undefined,
    url: siteUrl,
    telephone: site.contacts.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.contacts.address,
      addressLocality: "Санкт-Петербург",
      addressCountry: "RU",
    },
    openingHours: site.contacts.hours,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage site={site} customer={customer} />
    </>
  );
}
