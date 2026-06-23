import "server-only";
import { supabaseAdmin } from "./supabase";
import { isSupabaseConfigured } from "./config";

/**
 * Image storage on Supabase Storage. Files always live under a business-specific
 * folder — businesses/{businessId}/images/{filename} — so media can never leak
 * across businesses. Returns null when storage isn't configured (demo mode).
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "media";

export type UploadResult = { url: string; path: string; type: string } | null;

function storageReady(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadBusinessImage(opts: {
  businessId: string;
  file: File;
}): Promise<UploadResult> {
  if (!storageReady()) return null;

  const { businessId, file } = opts;
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `businesses/${businessId}/images/${filename}`;

  const supabase = supabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, type: file.type };
}

/** Delete a stored object by its path. Caller must verify businessId first. */
export async function deleteBusinessImage(path: string): Promise<void> {
  if (!storageReady()) return;
  const supabase = supabaseAdmin();
  await supabase.storage.from(BUCKET).remove([path]);
}
