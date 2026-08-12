"use server";

import { requireModule } from "@/lib/modules";
import { createMediaRecord } from "@/lib/media";

/**
 * Website image upload — the server entry point behind the reusable
 * <ImageUpload /> field used in the Website editor. It lets an admin UPLOAD an
 * image (rather than only pasting a URL) and returns a permanent PUBLIC url that
 * can be stored directly in a section's draftContent.
 *
 * SECURITY (CLAUDE.md, multi-tenant):
 *  - businessId is resolved server-side via requireModule("WEBSITE") — this
 *    enforces the session + role + tenant checks AND blocks when the WEBSITE
 *    module is disabled. businessId is NEVER taken from the client.
 *  - The mime type is validated against an allowlist and the size against a hard
 *    cap SERVER-SIDE — the browser accept="image/*" is only a convenience.
 *  - The file is attached as ownerType "Business" (ownerId === businessId), which
 *    lib/media.ts routes to the PUBLIC bucket with a permanent url, under the
 *    business-scoped path businesses/{businessId}/images/{filename}. Visibility,
 *    bucket and path are all decided server-side by the media service.
 *  - No-ops (returns an error) in demo mode / when storage isn't configured.
 *
 * Reuses the existing media pipeline (lib/media.ts -> lib/storage.ts) rather than
 * touching storage directly, so collision-safe filenames, image compression, the
 * Media DB record and the audit log all come for free.
 *
 * Server-only "use server" module: only its exported action is callable from the
 * client, and it never returns anything but a url or an error string.
 */

// WEBSITE writer roles — mirrors modules/website/actions.ts.
const WEBSITE_WRITER_ROLES = ["OWNER", "ADMIN"] as const;

/** Mime types accepted for website images. Validated server-side. */
// SVG is intentionally excluded: it isn't re-encoded (unlike raster via sharp),
// so an uploaded SVG could carry an inline <script> that executes if opened
// directly from storage. Raster-only keeps uploads safe.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/** Hard server-side size cap for a single website image. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export type UploadWebsiteImageResult = { url: string } | { error: string };

/**
 * Upload one website image (form field "file") and return its permanent public
 * url. On any failure returns { error } instead of throwing, so the client field
 * can render an inline message without crashing.
 */
export async function uploadWebsiteImage(
  formData: FormData,
): Promise<UploadWebsiteImageResult> {
  // Resolves the SAFE businessId (session + role + WEBSITE module enabled).
  const access = await requireModule("WEBSITE", {
    allowedRoles: [...WEBSITE_WRITER_ROLES],
  });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image to upload." };
  }

  // Server-side type + size validation (never trust the client accept filter).
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      error: "Unsupported image type. Use PNG, JPEG, WebP, AVIF, GIF or SVG.",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. The maximum size is 8 MB." };
  }

  // Demo mode / storage not configured: media service returns null.
  if (access.isDemo) {
    return { error: "Uploads are disabled in demo mode." };
  }

  try {
    // Attach as a Business-owned, website-folder image. Both route the file to
    // the PUBLIC bucket with a permanent url (see PUBLIC_OWNER_TYPES /
    // PUBLIC_FOLDERS in lib/media.ts). businessId is the server-resolved value.
    const media = await createMediaRecord({
      file,
      folder: "website",
      ownerType: "Business",
      ownerId: access.businessId,
      // Reuse the already-validated WEBSITE access so no second access resolve
      // (and no CORE re-check) happens inside the media service.
      access,
    });

    if (!media?.url) {
      return {
        error: "Upload failed. Image storage is not configured on the server.",
      };
    }

    return { url: media.url };
  } catch {
    // Never leak internal errors to the client.
    return { error: "Upload failed. Please try again." };
  }
}
