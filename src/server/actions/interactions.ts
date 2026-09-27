"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth/session";
import { handleAction } from "@/server/action-utils";
import { createEnquiry, markEnquiryRead, sendMessage, setEnquiryStatus } from "@/server/services/enquiries";
import { markNotificationsRead, reportListing, setFavorite } from "@/server/services/tenant";
import { acceptViewing, cancelViewing, declineViewing, requestViewing } from "@/server/services/viewings";

export async function toggleFavoriteAction(propertyId: string, saved: boolean) {
  return handleAction(async () => {
    const user = await requireActionUser();
    const result = await setFavorite(user, String(propertyId), Boolean(saved));
    revalidatePath("/dashboard/saved");
    return result;
  });
}

export async function sendEnquiryAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    const result = await createEnquiry(user, input);
    revalidatePath("/dashboard/messages");
    return result;
  }, "Enquiry sent. The owner will reply in your messages.");
}

export async function sendMessageAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    const result = await sendMessage(user, input);
    revalidatePath("/dashboard/messages", "layout");
    return result;
  });
}

export async function markEnquiryReadAction(enquiryId: string) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await markEnquiryRead(user, String(enquiryId));
  });
}

export async function setEnquiryStatusAction(enquiryId: string, status: "OPEN" | "CLOSED") {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await setEnquiryStatus(user, String(enquiryId), status === "CLOSED" ? "CLOSED" : "OPEN");
    revalidatePath("/dashboard/messages", "layout");
  }, status === "CLOSED" ? "Conversation closed." : "Conversation reopened.");
}

export async function requestViewingAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    const result = await requestViewing(user, input);
    revalidatePath("/dashboard/viewings");
    return result;
  }, "Viewing requested. You'll be notified when the owner responds.");
}

export async function acceptViewingAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await acceptViewing(user, input);
    revalidatePath("/dashboard", "layout");
  }, "Viewing accepted. The tenant has been notified.");
}

export async function declineViewingAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await declineViewing(user, input);
    revalidatePath("/dashboard", "layout");
  }, "Viewing declined.");
}

export async function cancelViewingAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await cancelViewing(user, input);
    revalidatePath("/dashboard", "layout");
  }, "Viewing cancelled.");
}

export async function reportListingAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await reportListing(user, input);
  }, "Thanks — our team will review this listing.");
}

/** Marks one notification read without re-rendering the page, so it can run alongside a navigation. */
export async function markNotificationReadQuietlyAction(notificationId: string) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await markNotificationsRead(user, String(notificationId));
  });
}

export async function markNotificationsReadAction(notificationId?: string) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await markNotificationsRead(user, notificationId ? String(notificationId) : undefined);
    revalidatePath("/", "layout");
  });
}
