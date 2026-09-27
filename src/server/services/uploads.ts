import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { invalid } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const KEY_PATTERN = /^properties\/[a-z0-9]{10,40}\/[0-9a-f-]{36}\.webp$/;

function uploadRoot() {
  // Runtime-only path: tell the bundler not to trace the whole project for it.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || "storage/uploads");
}

/** Maps a storage key to an absolute path, refusing anything that could escape the upload directory. */
export function resolveStorageKey(key: string): string | null {
  if (!KEY_PATTERN.test(key)) return null;
  const root = uploadRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

/**
 * Validates an uploaded image by decoding it (not trusting the file name or MIME type),
 * normalises orientation, strips metadata such as GPS location, resizes and re-encodes to WebP.
 */
export async function storePropertyPhoto(propertyId: string, input: Buffer) {
  if (input.byteLength === 0) throw invalid("The file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw invalid("Photos must be 10 MB or smaller.");

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw invalid("That file isn't a supported image. Use JPG, PNG, WebP or AVIF.");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw invalid("That file isn't a supported image. Use JPG, PNG, WebP or AVIF.");
  }
  if ((metadata.width ?? 0) < 400 || (metadata.height ?? 0) < 300) {
    throw invalid("Photos must be at least 400 × 300 pixels.");
  }

  const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  const key = `properties/${propertyId}/${randomUUID()}.webp`;
  const fullPath = resolveStorageKey(key);
  if (!fullPath) throw invalid("Could not store the photo.");
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);

  return { storageKey: key, url: `/media/${key}`, width: info.width, height: info.height };
}

export async function readStoredFile(key: string): Promise<Buffer | null> {
  const fullPath = resolveStorageKey(key);
  if (!fullPath) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ fullPath);
  } catch {
    return null;
  }
}

export async function deleteStoredFile(key: string) {
  const fullPath = resolveStorageKey(key);
  if (!fullPath) return;
  await unlink(fullPath).catch(() => undefined);
}
