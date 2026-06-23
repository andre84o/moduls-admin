import "server-only";
import { supabaseAdmin } from "./supabase";
import { isSupabaseConfigured } from "./config";

/**
 * Central file storage on Supabase Storage. Tenant isolation is mandatory:
 * every object lives under a business-scoped prefix and can never leak across
 * businesses:
 *
 *   businesses/{businessId}/images/{filename}
 *   businesses/{businessId}/documents/{filename}
 *
 * Two buckets back the library:
 *   - PUBLIC bucket  — website images and logos only. Served via permanent URL.
 *   - PRIVATE bucket — all documents and any private/customer files. Never
 *     publicly readable; access is granted through short-lived signed URLs.
 *
 * Raster images are compressed/resized to WebP on the way in (sharp). Returns
 * null when storage isn't configured (demo mode), so callers degrade gracefully.
 */

const PUBLIC_BUCKET =
  process.env.SUPABASE_PUBLIC_BUCKET ??
  process.env.SUPABASE_STORAGE_BUCKET ?? // legacy single-bucket fallback
  "media-public";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET ?? "media-private";

// Resize cap + quality for uploaded images. Large photos shrink a lot here.
const MAX_IMAGE_DIMENSION = 2000;
const WEBP_QUALITY = 78;

// How long signed URLs for private files stay valid (seconds).
export const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type MediaKind = "IMAGE" | "DOCUMENT";
export type MediaVisibility = "PUBLIC" | "PRIVATE";

export type StoredFile = {
  /** Permanent public URL — only set for PUBLIC files; null for PRIVATE. */
  url: string | null;
  path: string;
  type: string;
  kind: MediaKind;
  visibility: MediaVisibility;
  name: string;
  size: number;
  width: number | null;
  height: number | null;
};

function storageReady(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function bucketFor(visibility: MediaVisibility): string {
  return visibility === "PUBLIC" ? PUBLIC_BUCKET : PRIVATE_BUCKET;
}

/** Whether a mime type is a raster image we can safely re-encode with sharp. */
function isCompressibleImage(mime: string): boolean {
  return /^image\/(jpe?g|png|webp|tiff|avif)$/i.test(mime);
}

/** Classify a file as IMAGE or DOCUMENT from its mime type. */
export function classifyFile(mime: string): MediaKind {
  return mime.startsWith("image/") ? "IMAGE" : "DOCUMENT";
}

function randomName(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

/**
 * Upload one file for a business. The caller passes the SERVER-RESOLVED
 * businessId and visibility — never values taken straight from the client.
 * Documents are always forced into the private bucket regardless of the
 * requested visibility. Images are compressed to WebP.
 */
export async function uploadBusinessFile(opts: {
  businessId: string;
  file: File;
  visibility: MediaVisibility;
}): Promise<StoredFile | null> {
  if (!storageReady()) return null;

  const { businessId, file } = opts;
  const originalName = file.name || "file";
  const kind = classifyFile(file.type);

  // Documents (and anything non-image) are NEVER public.
  const visibility: MediaVisibility = kind === "IMAGE" ? opts.visibility : "PRIVATE";

  let buffer: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer());
  let contentType = file.type || "application/octet-stream";
  let width: number | null = null;
  let height: number | null = null;
  let ext = (originalName.split(".").pop() || "bin").toLowerCase();

  if (kind === "IMAGE" && isCompressibleImage(file.type)) {
    // Lazy import: sharp is a native module, auto-externalized by Next.js.
    const sharp = (await import("sharp")).default;
    const processed = await sharp(buffer)
      .rotate() // respect EXIF orientation before stripping metadata
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    buffer = processed.data;
    width = processed.info.width;
    height = processed.info.height;
    contentType = "image/webp";
    ext = "webp";
  }

  const subfolder = kind === "IMAGE" ? "images" : "documents";
  const path = `businesses/${businessId}/${subfolder}/${randomName(ext)}`;
  const bucket = bucketFor(visibility);

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(error.message);

  let url: string | null = null;
  if (visibility === "PUBLIC") {
    url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  return {
    url,
    path,
    type: contentType,
    kind,
    visibility,
    name: originalName,
    size: buffer.byteLength,
    width,
    height,
  };
}

/** A short-lived signed URL for a single private object. */
export async function signedUrlFor(
  visibility: MediaVisibility,
  path: string,
  ttl = SIGNED_URL_TTL,
): Promise<string | null> {
  if (!storageReady()) return null;
  const supabase = supabaseAdmin();
  const { data } = await supabase.storage
    .from(bucketFor(visibility))
    .createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

/**
 * Batch-sign many private objects in one bucket. Returns a path -> signedUrl map.
 */
export async function signedUrlMap(
  paths: string[],
  ttl = SIGNED_URL_TTL,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!storageReady() || paths.length === 0) return out;

  const supabase = supabaseAdmin();
  const { data } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrls(paths, ttl);
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
}

/** Delete one stored object. Caller MUST verify businessId owns it first. */
export async function deleteBusinessFile(
  visibility: MediaVisibility,
  path: string,
): Promise<void> {
  if (!storageReady()) return;
  const supabase = supabaseAdmin();
  await supabase.storage.from(bucketFor(visibility)).remove([path]);
}

/**
 * List every stored object path for a business across both buckets — powers
 * full data export/erasure by businessId. Returns { bucket, path } pairs.
 */
export async function listAllBusinessFiles(
  businessId: string,
): Promise<Array<{ bucket: string; path: string }>> {
  if (!storageReady()) return [];
  const supabase = supabaseAdmin();
  const results: Array<{ bucket: string; path: string }> = [];

  for (const bucket of [PUBLIC_BUCKET, PRIVATE_BUCKET]) {
    for (const sub of ["images", "documents"]) {
      const prefix = `businesses/${businessId}/${sub}`;
      const { data } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 1000 });
      for (const obj of data ?? []) {
        if (obj.name) results.push({ bucket, path: `${prefix}/${obj.name}` });
      }
    }
  }
  return results;
}

/** Remove every stored object for a business across both buckets (GDPR erase). */
export async function deleteAllBusinessFiles(businessId: string): Promise<number> {
  if (!storageReady()) return 0;
  const supabase = supabaseAdmin();
  const files = await listAllBusinessFiles(businessId);

  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of files) {
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, paths] of byBucket) {
    if (paths.length) await supabase.storage.from(bucket).remove(paths);
  }
  return files.length;
}
