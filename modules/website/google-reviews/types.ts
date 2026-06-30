/**
 * Pure, serializable types for the Google Reviews website integration.
 *
 * These describe the NORMALIZED, public-safe shape produced by
 * modules/website/google-reviews/utils.ts. They deliberately contain NO
 * businessId / tenant fields — tenant scoping is always resolved server-side
 * from the session or the resolved public business, never read from a cached
 * Google payload (see CLAUDE.md). Nothing here imports Prisma or runs I/O.
 */

/** One normalized Google review, safe to serialize and (later) render publicly. */
export type GoogleReview = {
  author: string;
  /** Star rating clamped to 0..5 (0 = unknown/invalid). */
  rating: number;
  text: string;
  /** Human-readable relative time, e.g. "2 weeks ago". May be "". */
  relativeTime: string;
  /** Epoch milliseconds for deterministic sorting; null when unknown. */
  time: number | null;
  profilePhotoUrl: string | null;
  authorUrl: string | null;
  language: string | null;
};

/**
 * The normalized shape of a cached Google payload: place-level aggregates plus
 * the normalized reviews. This is what a cache `payload` should be reduced to
 * before storing/reading. Contains no tenant fields.
 */
export type NormalizedGoogleReviews = {
  /** Place aggregate rating (0..5) or null. */
  rating: number | null;
  /** Total number of ratings reported by Google, or null. */
  userRatingCount: number | null;
  reviews: GoogleReview[];
};

/** Display options applied when selecting which cached reviews to show. */
export type GoogleReviewDisplayOptions = {
  /** Minimum star rating to include (1..5), or null/undefined for no filter. */
  minRating?: number | null;
  /** Maximum number of reviews to return. */
  maxCount?: number | null;
};
