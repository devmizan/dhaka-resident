import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { MAX_PHOTOS } from "@/lib/validation/listing";
import { getOwnedListing, markPhotosChanged } from "@/server/services/listings";
import { enforceRateLimit, RATE_LIMITS } from "@/server/services/rate-limit";
import { deleteStoredFile, MAX_UPLOAD_BYTES, storePropertyPhoto } from "@/server/services/uploads";

export const runtime = "nodejs";

/** Route handlers don't get Server Actions' built-in CSRF check, so compare Origin and Host explicitly. */
function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: RouteContext<"/api/listings/[id]/photos">) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { id } = await context.params;
  try {
    await getOwnedListing(user, id);
    await enforceRateLimit(`upload:${user.id}`, RATE_LIMITS.upload, "Too many uploads. Please wait a few minutes.");

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "Photos must be 10 MB or smaller." }, { status: 413 });
    }

    const count = await db.propertyPhoto.count({ where: { propertyId: id } });
    if (count >= MAX_PHOTOS) return NextResponse.json({ error: `A listing can have at most ${MAX_PHOTOS} photos.` }, { status: 400 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Photos must be 10 MB or smaller." }, { status: 413 });

    const stored = await storePropertyPhoto(id, Buffer.from(await file.arrayBuffer()));
    const title = (await db.property.findUnique({ where: { id }, select: { title: true } }))?.title;
    let photo;
    try {
      photo = await db.propertyPhoto.create({
        data: {
          propertyId: id,
          url: stored.url,
          storageKey: stored.storageKey,
          width: stored.width,
          height: stored.height,
          sortOrder: count,
          altText: title ? `${title} — photo ${count + 1}` : null,
        },
        select: { id: true, url: true, altText: true },
      });
    } catch (error) {
      await deleteStoredFile(stored.storageKey);
      throw error;
    }
    await markPhotosChanged(user, id);
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "RATE_LIMITED" ? 429 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[photo upload failed]", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
