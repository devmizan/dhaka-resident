import type { Role } from "@/generated/prisma/enums";
import { forbidden } from "@/lib/errors";

export type Actor = { id: string; role: Role; name?: string };

export function assertRole(actor: Actor, roles: Role[], message?: string) {
  if (!roles.includes(actor.role)) {
    throw forbidden(message ?? "Your account type can't do that.");
  }
}
