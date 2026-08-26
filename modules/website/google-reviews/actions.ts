"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import {
  hasBusinessFeatureAccess,
  GOOGLE_REVIEWS_FEATURE_KEY,
} from "@/lib/feature-access";
import { writeAuditLog } from "@/lib/audit";
import type { BusinessAccess } from "@/lib/auth";
import { fetchGooglePlaceReviews } from "./service";
import { clampMaxCount, clampMinRating, normalizePayload, DEFAULT_MAX_COUNT } from "./utils";
import type { ManualReview } from "./types";

/**
 * Mutating server actions for the Website Google Reviews integration.
 *
 * Every action resolves the SAFE businessId via requireModule("WEBSITE") — this
 * wraps requireBusinessAccess (session + role + tenant checks) AND blocks when
 * the WEBSITE module is disabled for the business. businessId is NEVER taken from
 * the caller; all reads/writes are scoped by access.businessId. The Google API is
 * called only through the server-only service (./service), never from the public
 * site, and the API key is never handled here. All actions no-op in demo mode.
 *
 * Treated as a WEBSITE settings feature — no ProjectType, no Super Admin toggle.
 *
 * Cache contract: the cache stores the RAW Google payload; the read layers
 * (queries.ts / the future public loader) normalize it with the pure utils. We
 * normalize here too, but only to count reviews for the audit/return value.
 */

const WEBSITE_WRITER_ROLES = ["OWNER", "ADMIN"] as const;

const ADDON_DISABLED_ERROR = "Google Reviews is not enabled for this business.";

/**
 * Gate every mutating action behind the paid Google Reviews add-on. Access is
 * checked against the SERVER-RESOLVED businessId (from requireModule), never a
 * client value. Demo mode is treated as granted (no database). Returns true when
 * the caller may proceed, false when the add-on is not enabled.
 */
async function hasGoogleReviewsAddOn(access: BusinessAccess): Promise<boolean> {
  if (access.isDemo) return true;
  return hasBusinessFeatureAccess(access.businessId, GOOGLE_REVIEWS_FEATURE_KEY);
}

/** Trim a place id to a non-empty string, or null. Place ids are opaque. */
function normalizePlaceId(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Save (create or update) the per-business Google Reviews settings. Inputs are
 * validated/clamped server-side. Upserted by the server-resolved businessId so a
 * client can never target another business's row.
 */
export async function saveGoogleReviewSettings(input: {
  enabled: boolean;
  placeId?: string | null;
  minRating?: number | null;
  maxCount?: number | null;
}): Promise<{ error?: string }> {
  const access = await requireModule("WEBSITE", {
    allowedRoles: [...WEBSITE_WRITER_ROLES],
  });
  if (!(await hasGoogleReviewsAddOn(access))) {
    return { error: ADDON_DISABLED_ERROR };
  }

  const enabled = Boolean(input.enabled);
  const placeId = normalizePlaceId(input.placeId);
  const minRating = clampMinRating(input.minRating ?? null);
  const maxCount = clampMaxCount(input.maxCount, DEFAULT_MAX_COUNT);

  // A place to read from is required before the integration can be enabled.
  if (enabled && !placeId) {
    return { error: "A Google Place ID is required to enable Google reviews." };
  }

  if (access.isDemo) return {};

  const row = await getPrisma().googleReviewSettings.upsert({
    where: { businessId: access.businessId },
    create: { businessId: access.businessId, enabled, placeId, minRating, maxCount },
    update: { enabled, placeId, minRating, maxCount },
    select: { id: true },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "google_reviews.settings_updated",
    entityType: "GoogleReviewSettings",
    entityId: row.id,
    // placeId is not a secret; keep metadata small and non-sensitive.
    metadata: { enabled, hasPlaceId: placeId !== null, minRating, maxCount },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

/**
 * Sync reviews from Google for the active business's configured place. Reads
 * settings scoped by businessId, calls the server-only Places service, and on
 * success REPLACES this business's cache (delete-then-create, scoped by
 * businessId) with the RAW payload, records lastSyncedAt and clears lastError.
 * On a real failure it records lastError and returns a clean message — raw Google
 * errors never reach the caller.
 */
export async function syncGoogleReviews(): Promise<{ error?: string; count?: number }> {
  const access = await requireModule("WEBSITE", {
    allowedRoles: [...WEBSITE_WRITER_ROLES],
  });
  if (!(await hasGoogleReviewsAddOn(access))) {
    return { error: ADDON_DISABLED_ERROR };
  }
  if (access.isDemo) return {};

  const prisma = getPrisma();

  const settings = await prisma.googleReviewSettings.findUnique({
    where: { businessId: access.businessId },
    select: { enabled: true, placeId: true },
  });
  if (!settings || !settings.enabled) {
    return { error: "Google reviews are not enabled for this business." };
  }
  const placeId = normalizePlaceId(settings.placeId);
  if (!placeId) {
    return { error: "Add a Google Place ID before syncing." };
  }

  const result = await fetchGooglePlaceReviews(placeId);

  // Not configured to run (e.g. no server API key) — surface cleanly, but do not
  // persist a per-business lastError for a platform-level config gap.
  if (result.status === "SKIPPED") {
    return { error: result.reason };
  }

  if (result.status === "ERROR") {
    // Persist the failure for the admin UI; scoped by businessId. Never throw.
    await prisma.googleReviewSettings.updateMany({
      where: { businessId: access.businessId },
      data: { lastError: result.error },
    });
    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "google_reviews.sync_failed",
      entityType: "GoogleReviewCache",
      metadata: { error: result.error },
    });
    revalidatePath("/");
    return { error: result.error };
  }

  // count is derived from the normalized payload; the cache stores the RAW
  // payload so the read layers remain the single normalization point.
  const count = normalizePayload(result.payload).reviews.length;

  // Replace this business's cache: delete all of its rows, then write the fresh
  // one. Both operations are scoped by the server-resolved businessId, so no
  // other tenant's cache can ever be touched. fetchedAt uses the column default.
  await prisma.$transaction([
    prisma.googleReviewCache.deleteMany({
      where: { businessId: access.businessId },
    }),
    prisma.googleReviewCache.create({
      data: {
        businessId: access.businessId,
        placeId,
        payload: result.payload as Prisma.InputJsonValue,
      },
    }),
  ]);

  await prisma.googleReviewSettings.updateMany({
    where: { businessId: access.businessId },
    data: { lastSyncedAt: new Date(), lastError: null },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "google_reviews.synced",
    entityType: "GoogleReviewCache",
    metadata: { count, placeId },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { count };
}

/**
 * Save the manually entered reviews for this business. Replaces the entire
 * manualReviews array — always server-resolved businessId, never from client.
 */
export async function saveManualReviews(
  reviews: ManualReview[],
): Promise<{ error?: string }> {
  const access = await requireModule("WEBSITE", {
    allowedRoles: [...WEBSITE_WRITER_ROLES],
  });
  if (!(await hasGoogleReviewsAddOn(access))) {
    return { error: ADDON_DISABLED_ERROR };
  }
  if (access.isDemo) return {};

  // Validate each review server-side
  const safe = reviews
    .filter((r) => typeof r.author === "string" && typeof r.text === "string")
    .map((r) => ({
      author: String(r.author).trim().slice(0, 200),
      rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))),
      text: String(r.text).trim().slice(0, 2000),
      relativeTime: String(r.relativeTime ?? "").trim().slice(0, 100),
    }));

  await getPrisma().googleReviewSettings.upsert({
    where: { businessId: access.businessId },
    create: { businessId: access.businessId, manualReviews: safe as Prisma.InputJsonValue },
    update: { manualReviews: safe as Prisma.InputJsonValue },
    select: { id: true },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

/**
 * Delete this business's cached Google reviews. Scoped by the server-resolved
 * businessId via deleteMany, so only the active business's cache is removed.
 */
export async function clearGoogleReviewCache(): Promise<{ error?: string; count?: number }> {
  const access = await requireModule("WEBSITE", {
    allowedRoles: [...WEBSITE_WRITER_ROLES],
  });
  if (!(await hasGoogleReviewsAddOn(access))) {
    return { error: ADDON_DISABLED_ERROR };
  }
  if (access.isDemo) return {};

  const { count } = await getPrisma().googleReviewCache.deleteMany({
    where: { businessId: access.businessId },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "google_reviews.cache_cleared",
    entityType: "GoogleReviewCache",
    metadata: { deleted: count },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { count };
}
