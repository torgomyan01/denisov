import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/menu`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/#about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/#visit`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
