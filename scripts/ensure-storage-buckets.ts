import { config } from "dotenv";
// Next.js loads .env.local with priority over .env; mirror that order here so
// this DevOps command sees the same credentials the app does.
config({ path: ".env.local" });
config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";

/**
 * Idempotent Supabase Storage provisioning for the media library.
 *
 * Creates the two buckets the app expects, with the correct visibility:
 *   - PUBLIC bucket  (media-public)  — website images/logos, permanent URLs.
 *   - PRIVATE bucket (media-private) — documents + customer files, signed URLs.
 *
 * Behaviour:
 *   - Missing bucket  → created with the correct `public` flag.
 *   - Existing bucket → visibility is VALIDATED, never modified. A mismatch is a
 *     hard error (flipping a live bucket's visibility would expose or break
 *     existing files), so the operator must fix it deliberately.
 *
 * This is a MANUAL DevOps setup command for new environments. It is never
 * imported or run inside the app runtime, and it uploads no files.
 *
 *   npm run storage:ensure
 */

// Bucket names mirror lib/storage.ts exactly (including the legacy fallback).
const PUBLIC_BUCKET =
  process.env.SUPABASE_PUBLIC_BUCKET ??
  process.env.SUPABASE_STORAGE_BUCKET ??
  "media-public";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET ?? "media-private";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("[")) {
    console.error(
      `Missing required server-only env var: ${name}. ` +
        `Set it in .env.local (or .env) before running storage:ensure.`,
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function ensureBucket(name: string, shouldBePublic: boolean): Promise<void> {
    const label = shouldBePublic ? "public" : "private";
    const { data: existing, error: getError } = await supabase.storage.getBucket(name);

    // Supabase returns an error (not just null) when the bucket is absent, so we
    // only treat a present bucket as "exists" and otherwise attempt to create it.
    if (existing) {
      if (existing.public !== shouldBePublic) {
        throw new Error(
          `Bucket "${name}" exists but is ${existing.public ? "PUBLIC" : "PRIVATE"}, ` +
            `expected ${label.toUpperCase()}. Refusing to change it automatically — ` +
            `flipping visibility on a live bucket can expose or break existing files. ` +
            `Fix it deliberately in the Supabase dashboard or recreate the bucket.`,
        );
      }
      console.log(`✓ Bucket "${name}" already exists and is ${label}.`);
      return;
    }

    const { error: createError } = await supabase.storage.createBucket(name, {
      public: shouldBePublic,
    });
    if (createError) {
      throw new Error(
        `Failed to create bucket "${name}": ${createError.message}` +
          (getError ? ` (lookup said: ${getError.message})` : ""),
      );
    }
    console.log(`+ Created bucket "${name}" (${label}).`);
  }

  await ensureBucket(PUBLIC_BUCKET, true);
  await ensureBucket(PRIVATE_BUCKET, false);

  console.log("Storage buckets are provisioned and valid.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
