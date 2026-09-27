import { after } from "next/server";
import type { NotificationType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { appUrl, sendEmail } from "@/server/services/email";

export type NotificationCategory = "enquiries" | "viewings" | "listing" | "account";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  category: NotificationCategory;
};

/** Runs work after the response is sent when inside a request; otherwise runs it detached. */
function runInBackground(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task().catch((error) => console.error("[background task failed]", error));
  }
}

/** Creates an in-app notification and, if the user opted in, sends an email copy. */
export async function notifyUser(input: NotifyInput) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true, emailNotifications: true, notifyEnquiries: true, notifyViewings: true, notifyListing: true },
  });
  if (!user) return;

  await db.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link },
  });

  const wantsEmail =
    Boolean(user.email) &&
    user.emailNotifications &&
    (input.category === "account" ||
      (input.category === "enquiries" && user.notifyEnquiries) ||
      (input.category === "viewings" && user.notifyViewings) ||
      (input.category === "listing" && user.notifyListing));

  if (wantsEmail) {
    runInBackground(() =>
      sendEmail({
        to: user.email!,
        subject: `${input.title} — Dhaka Resident`,
        text: `Hi ${user.name},\n\n${input.body}\n\n${input.link ? `Open: ${appUrl(input.link)}\n\n` : ""}You can change email preferences in your account settings.\n\n— Dhaka Resident`,
      }),
    );
  }
}

export async function notifyAdmins(input: Omit<NotifyInput, "userId">) {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  await Promise.all(admins.map((admin) => notifyUser({ ...input, userId: admin.id })));
}

export { runInBackground };
