import type { ListingStatus, Role } from "@/generated/prisma/enums";

export type ListingAction =
  | "submit"
  | "withdraw"
  | "pause"
  | "resume"
  | "markRented"
  | "relist"
  | "approve"
  | "reject"
  | "unpublish";

type Transition = { from: ListingStatus[]; to: ListingStatus; roles: Role[] };

/** The single source of truth for who may move a listing between states. */
export const LISTING_TRANSITIONS: Record<ListingAction, Transition> = {
  submit: { from: ["DRAFT", "REJECTED", "UNPUBLISHED"], to: "PENDING_REVIEW", roles: ["OWNER"] },
  withdraw: { from: ["PENDING_REVIEW"], to: "DRAFT", roles: ["OWNER"] },
  pause: { from: ["PUBLISHED"], to: "PAUSED", roles: ["OWNER"] },
  resume: { from: ["PAUSED"], to: "PUBLISHED", roles: ["OWNER"] },
  markRented: { from: ["PUBLISHED", "PAUSED"], to: "RENTED", roles: ["OWNER"] },
  relist: { from: ["RENTED"], to: "PUBLISHED", roles: ["OWNER"] },
  approve: { from: ["PENDING_REVIEW"], to: "PUBLISHED", roles: ["ADMIN"] },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED", roles: ["ADMIN"] },
  unpublish: { from: ["PUBLISHED", "PAUSED", "RENTED"], to: "UNPUBLISHED", roles: ["ADMIN"] },
};

export function canTransition(action: ListingAction, from: ListingStatus, role: Role): boolean {
  const transition = LISTING_TRANSITIONS[action];
  return transition.roles.includes(role) && transition.from.includes(from);
}

export function availableOwnerActions(status: ListingStatus): ListingAction[] {
  return (Object.keys(LISTING_TRANSITIONS) as ListingAction[]).filter((action) => canTransition(action, status, "OWNER"));
}

/**
 * Editing listing content after approval sends it back for review, so an approved
 * listing can't be swapped for different content without moderation.
 */
export function statusAfterContentEdit(status: ListingStatus): ListingStatus {
  switch (status) {
    case "PUBLISHED":
    case "PAUSED":
    case "RENTED":
      return "PENDING_REVIEW";
    default:
      return status;
  }
}

export function isEditRequiringReview(status: ListingStatus): boolean {
  return statusAfterContentEdit(status) !== status;
}

export function isPubliclyVisible(status: ListingStatus): boolean {
  return status === "PUBLISHED";
}
