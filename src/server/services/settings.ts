import { db } from "@/lib/db";
import type { SiteSettings } from "@/lib/validation/admin";

export const DEFAULT_SETTINGS: SiteSettings = {
  contactEmail: "support@example.com",
  contactPhone: undefined,
  officeAddress: "Dhaka, Bangladesh",
  announcement: undefined,
};

const KEY = "general";

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: KEY } });
    if (!row || typeof row.value !== "object" || row.value === null) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SiteSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSiteSettings(settings: SiteSettings, updatedById: string) {
  const value = JSON.parse(JSON.stringify(settings));
  await db.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value, updatedById },
    update: { value, updatedById },
  });
}
