import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";

export type ActivityInput = {
  actorId: string | null;
  action: string;
  entityType: "Property" | "User" | "Report" | "City" | "Neighborhood" | "Country" | "PropertyCategory" | "Amenity" | "SiteSetting";
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

/** Records an administrative change in the audit log. Pass a transaction client to keep it atomic. */
export async function logActivity(input: ActivityInput, client: Tx | typeof db = db) {
  await client.adminActivity.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary.slice(0, 500),
      metadata: input.metadata,
    },
  });
}
