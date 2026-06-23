"use server";

import { revalidatePath } from "next/cache";
import { createMediaRecord, deleteMediaRecord } from "./media";

/**
 * Server actions for the central media library. These are the form-facing
 * entry points used by the reusable <MediaUpload /> and <MediaLibrary />
 * components — they delegate to the access-checked media service (lib/media.ts).
 *
 * Attach context (folder / ownerType / ownerId / propertyId) and the path to
 * revalidate are passed as hidden form fields, so the same components work on
 * any page in the project.
 */

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Upload one or more files (field name "files"). No-op in demo mode. */
export async function uploadMedia(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;

  const folder = str(formData, "folder") || "general";
  const alt = str(formData, "alt") || null;
  const ownerType = str(formData, "ownerType") || null;
  const ownerId = str(formData, "ownerId") || null;
  const propertyId = str(formData, "propertyId") || null;
  const revalidate = str(formData, "revalidate") || "/admin";

  for (const file of files) {
    await createMediaRecord({
      file,
      folder,
      alt,
      ownerType,
      ownerId,
      propertyId,
    });
  }

  revalidatePath(revalidate);
}

/** Delete a media item by id. No-op in demo mode. */
export async function deleteMediaItem(id: string, revalidate = "/admin") {
  if (!id) return;
  await deleteMediaRecord(id);
  revalidatePath(revalidate);
}
