import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const [listings, cities, categories] = await Promise.all([
    db.property.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 5000 }),
    db.city.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.propertyCategory.findMany({ where: { isActive: true }, select: { slug: true } }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "hourly", priority: 0.9 },
    ...cities.map((c) => ({ url: `${base}/search?city=${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: `${base}/search?type=${c.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...listings.map((l) => ({ url: `${base}/properties/${l.slug}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: `${base}/list-your-property`, priority: 0.5 },
    { url: `${base}/help`, priority: 0.3 },
  ];
}
