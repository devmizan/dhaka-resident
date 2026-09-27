import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getNotificationSummary } from "@/server/queries/notifications";

export const dynamic = "force-dynamic";

/** Latest notifications for the signed-in user (used by the header bell to poll for updates). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const summary = await getNotificationSummary(user.id);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store, private" } });
}
