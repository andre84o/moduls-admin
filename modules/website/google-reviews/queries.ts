import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireBusinessAccess, type BusinessAccess } from "@/lib/auth";
import { isModuleEnabled } from "@/lib/modules";
import { DEFAULT_MAX_COUNT, normalizePayload } from "./utils";
import type { GoogleReview } from "./types";

/**
 * Admin read layer for the Website Google Reviews integration. Every function
 * resolves the SAFE businessId via requireBusinessAccess and scopes its query by
 * it (tenant isolation — see CLAUDE.md). businessId is NEVER accepted from the
 * caller/client. The WEBSITE module must be enabled; otherwise these return safe
 * defaults/empty so a disabled integration never loads or leaks data. In demo
 * mode there is no database, so they return defaults/empty too.
 *
 * Server-only: never import this into a client component (it reads the DB and,
 * transitively, server-only config).
 */

/** Serializable settings for the admin UI (dates as ISO strings, no Prisma). */
export type AdminGoogleReviewSettings = {
  enabled: boolean;
  placeId: string | null;
  minRating: number | null;
  maxCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};

/** Serializable cached-reviews snapshot for the admin preview. */
export type AdminCachedGoogleReviews = {
  placeId: string | null;
  fetchedAt: string | null;
  rating: number | null;
  userRatingCount: number | null;
  reviews: GoogleReview[];
};

/** Defaults used in demo mode and before any settings row exists. */
const DEFAULT_SETTINGS: AdminGoogleReviewSettings = {
  enabled: false,
  placeId: null,
  minRating: null,
  maxCount: DEFAULT_MAX_COUNT,
  lastSyncedAt: null,
  lastError: null,
};

const EMPTY_CACHE: AdminCachedGoogleReviews = {
  placeId: null,
  fetchedAt: null,
  rating: null,
  userRatingCount: null,
  reviews: [],
};

/** Whether the WEBSITE module is usable for this access (enabled, has a DB). */
async function websiteReadable(access: BusinessAccess): Promise<boolean> {
  if (access.isDemo) return false; // no database in demo mode
  return isModuleEnabled("WEBSITE", access);
}

/**
 * The Google Reviews settings for the active business, or safe defaults when no
 * row exists yet / the module is disabled / demo mode. Always scoped by the
 * server-resolved businessId.
 */
export async function getGoogleReviewSettings(): Promise<AdminGoogleReviewSettings> {
  const access = await requireBusinessAccess();
  if (!(await websiteReadable(access))) return { ...DEFAULT_SETTINGS };

  const row = await getPrisma().googleReviewSettings.findUnique({
    where: { businessId: access.businessId },
    select: {
      enabled: true,
      placeId: true,
      minRating: true,
      maxCount: true,
      lastSyncedAt: true,
      lastError: true,
    },
  });
  if (!row) return { ...DEFAULT_SETTINGS };

  return {
    enabled: row.enabled,
    placeId: row.placeId,
    minRating: row.minRating,
    maxCount: row.maxCount,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastError: row.lastError,
  };
}

/**
 * The cached Google reviews for the active business's configured place, for the
 * admin preview. Returns empty when there is no settings/placeId, no cache row,
 * the module is disabled, or demo mode. The stored payload is re-normalized
 * defensively before returning. Always scoped by the server-resolved businessId.
 */
export async function getCachedGoogleReviewsAdmin(): Promise<AdminCachedGoogleReviews> {
  const access = await requireBusinessAccess();
  if (!(await websiteReadable(access))) return { ...EMPTY_CACHE };

  const prisma = getPrisma();

  // Resolve the configured place first (scoped by businessId), then read only
  // the cache row for that exact (businessId, placeId).
  const settings = await prisma.googleReviewSettings.findUnique({
    where: { businessId: access.businessId },
    select: { placeId: true },
  });
  const placeId = settings?.placeId?.trim();
  if (!placeId) return { ...EMPTY_CACHE };

  const cache = await prisma.googleReviewCache.findUnique({
    where: { businessId_placeId: { businessId: access.businessId, placeId } },
    select: { placeId: true, payload: true, fetchedAt: true },
  });
  if (!cache) return { ...EMPTY_CACHE };

  const normalized = normalizePayload(cache.payload);
  return {
    placeId: cache.placeId,
    fetchedAt: cache.fetchedAt ? cache.fetchedAt.toISOString() : null,
    rating: normalized.rating,
    userRatingCount: normalized.userRatingCount,
    reviews: normalized.reviews,
  };
}
