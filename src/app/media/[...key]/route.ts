import { readStoredFile } from "@/server/services/uploads";

export const runtime = "nodejs";

/** Serves uploaded listing photos. Keys are validated against a strict pattern (no path traversal). */
export async function GET(_request: Request, context: RouteContext<"/media/[...key]">) {
  const { key } = await context.params;
  const file = await readStoredFile(key.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
