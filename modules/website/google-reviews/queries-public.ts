import "server-only";
import { getPrisma } from "@/lib/prisma";
import {
  hasBusinessFeatureAccess,
  GOOGLE_REVIEWS_FEATURE_KEY,
} from "@/lib/feature-access";
import {
  normalizePayload,
  selectReviews,
  extractPlaceMeta,
} from "./utils";
import type { GoogleReview } from "./types";

/**
 * PUBLIC, sessionless read layer for cached Google Reviews.
 *
 * This is the ONLY public path to Google review data, and it reads exclusively
 * from GoogleReviewCache (the server-side cache). It NEVER imports ./service,
 * NEVER calls the Google Places API, and NEVER reads GOOGLE_PLACES_API_KEY —
 * public visitors only ever see what a prior admin-triggered sync already cached
 * (see CLAUDE.md: public routes never call the Google API).
 *
 * Tenant safety: the caller (the public Website loader) resolves the public
 * businessId SERVER-SIDE first and passes it in. businessId is never accepted
 * from the client, and both the settings and cache reads are scoped by it, so
 * one business can never surface another business's reviews.
 *
 * Server-only: never import this into a client component.
 */

/** Public, serializable review data injected into the GoogleReviews section. */
export type PublicGoogleReviews = {
  reviews: GoogleReview[];
  aggregateRating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  placeName: string | null;
};

/** Safe empty result: integration disabled, unconfigured, or no cache yet. */
const EMPTY_PUBLIC_REVIEWS: PublicGoogleReviews = {
  reviews: [],
  aggregateRating: null,
  userRatingCount: null,
  googleMapsUri: null,
  placeName: null,
};

/**
 * The public, cache-backed reviews for a business's configured place. Returns
 * an empty result (never throws) when the integration is disabled, has no place
 * id, or has no cache row yet. The businessId MUST be a server-resolved public
 * tenant id — never a client value. Reviews are filtered/sorted/clamped with the
 * per-business minRating/maxCount via the existing pure utils.
 */
export async function getPublicGoogleReviews(
  businessId: string,
): Promise<PublicGoogleReviews> {
  // Paid add-on gate: without the Google Reviews add-on the public site shows
  // nothing, regardless of settings/cache. Scoped by the server-resolved tenant.
  if (!(await hasBusinessFeatureAccess(businessId, GOOGLE_REVIEWS_FEATURE_KEY))) {
    return { ...EMPTY_PUBLIC_REVIEWS };
  }

  const prisma = getPrisma();

  // Settings gate the integration; scoped by the server-resolved businessId.
  const settings = await prisma.googleReviewSettings.findUnique({
    where: { businessId },
    select: { enabled: true, placeId: true, minRating: true, maxCount: true },
  });
  if (!settings || !settings.enabled) return { ...EMPTY_PUBLIC_REVIEWS };

  const placeId = settings.placeId?.trim();
  if (!placeId) return { ...EMPTY_PUBLIC_REVIEWS };

  // Read only THIS (businessId, placeId) cache row — never another tenant's.
  const cache = await prisma.googleReviewCache.findUnique({
    where: { businessId_placeId: { businessId, placeId } },
    select: { payload: true },
  });
  if (!cache) return { ...EMPTY_PUBLIC_REVIEWS };

  const normalized = normalizePayload(cache.payload);
  const meta = extractPlaceMeta(cache.payload);
  const reviews = selectReviews(normalized.reviews, {
    minRating: settings.minRating,
    maxCount: settings.maxCount,
  });

  return {
    reviews,
    aggregateRating: normalized.rating,
    userRatingCount: normalized.userRatingCount,
    googleMapsUri: meta.googleMapsUri,
    placeName: meta.placeName,
  };
}
