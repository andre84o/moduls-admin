/**
 * Pure helpers for the Google Reviews website integration.
 *
 * NO database, NO auth, NO network, NO server-only imports — every function here
 * is deterministic and unit-testable in isolation (see
 * tests/google-reviews-utils.test.ts). These shape UNTRUSTED Google payloads
 * (freeform JSON, possibly cached) into the safe, serializable types in
 * ./types.ts.
 *
 * Tenant safety (CLAUDE.md): nothing here ever reads a businessId/tenant field
 * from the payload. A cached Google payload is attacker-shaped data; businessId
 * is always supplied by the server caller, never trusted from this data.
 */

import type {
  GoogleReview,
  GoogleReviewDisplayOptions,
  NormalizedGoogleReviews,
} from "./types";

/** Default number of reviews to display when no maxCount is configured. */
export const DEFAULT_MAX_COUNT = 6;
/** Hard upper bound so a misconfigured maxCount can never render unbounded. */
const MAX_ALLOWED_COUNT = 50;
const RATING_MIN = 1;
const RATING_MAX = 5;

// ─── small safe coercion helpers ──────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First non-blank string among the candidates, or null. */
function firstStringOrNull(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

/** First non-blank string among the candidates, or "". */
function firstString(...vals: unknown[]): string {
  return firstStringOrNull(...vals) ?? "";
}

/**
 * Text may be a plain string (legacy Place Details) or an object `{ text }`
 * (Places API New: `text` / `originalText`). Pick the first usable string.
 */
function pickText(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
    if (isPlainObject(v) && typeof v.text === "string" && v.text.trim() !== "") {
      return v.text;
    }
  }
  return "";
}

/** Coerce a single review rating to an integer in 0..5 (0 = invalid/unknown). */
function clampReviewRating(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const r = Math.round(value);
  if (r < 0) return 0;
  if (r > RATING_MAX) return RATING_MAX;
  return r;
}

/** Coerce a place aggregate rating to a float in 0..5, or null. */
function coerceAggregateRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > RATING_MAX) return RATING_MAX;
  return value;
}

/** Coerce a non-negative integer count, or null. */
function coerceCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  return n < 0 ? 0 : n;
}

/**
 * Normalize a review timestamp to epoch milliseconds.
 * - number  → treated as Google legacy unix SECONDS (× 1000)
 * - string  → parsed as a date (Places API New `publishTime` RFC3339)
 * - else    → null
 */
function coerceTimeMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 1000);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

// ─── clamping (exported: used by admin settings + selection) ──────────

/**
 * Clamp a configured maxCount into [0, MAX_ALLOWED_COUNT]. A non-finite or
 * missing value falls back to `fallback` (default DEFAULT_MAX_COUNT). Fractions
 * are floored.
 */
export function clampMaxCount(
  value: unknown,
  fallback: number = DEFAULT_MAX_COUNT,
): number {
  const base =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : fallback;
  if (base < 0) return 0;
  if (base > MAX_ALLOWED_COUNT) return MAX_ALLOWED_COUNT;
  return base;
}

/**
 * Clamp a configured minRating into [RATING_MIN, RATING_MAX], or null when there
 * is no usable minimum (null/undefined/non-finite) — null meaning "no filter".
 */
export function clampMinRating(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < RATING_MIN) return RATING_MIN;
  if (n > RATING_MAX) return RATING_MAX;
  return n;
}

// ─── normalization ────────────────────────────────────────────────────

/**
 * Normalize one review-like value into a safe GoogleReview, or null when the
 * value is not an object. Reads only known Google fields (both the legacy
 * Place Details snake_case shape and the Places API New camelCase/attribution
 * shape). Never reads a businessId/tenant field.
 */
export function normalizeReview(raw: unknown): GoogleReview | null {
  if (!isPlainObject(raw)) return null;
  const attribution = isPlainObject(raw.authorAttribution)
    ? raw.authorAttribution
    : {};

  return {
    author: firstString(raw.author_name, attribution.displayName, raw.author),
    rating: clampReviewRating(raw.rating),
    text: pickText(raw.text, raw.originalText),
    relativeTime: firstString(
      raw.relative_time_description,
      raw.relativePublishTime,
    ),
    time: coerceTimeMs(raw.time ?? raw.publishTime),
    profilePhotoUrl: firstStringOrNull(
      raw.profile_photo_url,
      attribution.photoUri,
    ),
    authorUrl: firstStringOrNull(raw.author_url, attribution.uri),
    language: firstStringOrNull(raw.language, raw.languageCode),
  };
}

/** Pull the reviews array out of any supported payload shape. */
function extractReviewArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isPlainObject(raw)) {
    if (Array.isArray(raw.reviews)) return raw.reviews;
    const result = raw.result;
    if (isPlainObject(result) && Array.isArray(result.reviews)) {
      return result.reviews;
    }
  }
  return [];
}

/**
 * Normalize any review-like payload (array, `{ reviews }`, or `{ result:
 * { reviews } }`) into a clean GoogleReview[]. Non-object entries are dropped;
 * an unusable payload yields []. Never throws.
 */
export function normalizeReviews(raw: unknown): GoogleReview[] {
  const out: GoogleReview[] = [];
  for (const item of extractReviewArray(raw)) {
    const review = normalizeReview(item);
    if (review) out.push(review);
  }
  return out;
}

/**
 * Normalize a full Google place payload into aggregates + reviews. Reads only
 * known fields; supports the legacy `{ result }` envelope. Never throws and
 * never surfaces a tenant field.
 */
export function normalizePayload(raw: unknown): NormalizedGoogleReviews {
  const obj = isPlainObject(raw) ? raw : {};
  const result = isPlainObject(obj.result) ? obj.result : obj;
  return {
    rating: coerceAggregateRating(result.rating),
    userRatingCount: coerceCount(
      result.user_ratings_total ?? result.userRatingCount,
    ),
    reviews: normalizeReviews(raw),
  };
}

// ─── selection (filter + sort + clamp) ────────────────────────────────

/**
 * Return only reviews meeting the minimum rating. A null/invalid minRating means
 * no filtering. Does not mutate the input.
 */
export function filterByMinRating(
  reviews: readonly GoogleReview[],
  minRating: number | null,
): GoogleReview[] {
  const min = clampMinRating(minRating);
  if (min == null) return reviews.slice();
  return reviews.filter((r) => r.rating >= min);
}

/**
 * Deterministic comparator: highest rating first, then most recent first
 * (unknown times last), then by author and text. Total order ⇒ stable result
 * regardless of input order.
 */
function compareReviews(a: GoogleReview, b: GoogleReview): number {
  if (a.rating !== b.rating) return b.rating - a.rating;
  const at = a.time ?? Number.NEGATIVE_INFINITY;
  const bt = b.time ?? Number.NEGATIVE_INFINITY;
  if (at !== bt) return bt - at;
  if (a.author !== b.author) return a.author < b.author ? -1 : 1;
  if (a.text !== b.text) return a.text < b.text ? -1 : 1;
  return 0;
}

/** Sort reviews deterministically without mutating the input. */
export function sortReviews(reviews: readonly GoogleReview[]): GoogleReview[] {
  return reviews.slice().sort(compareReviews);
}

/**
 * The main selection entry: filter by minRating, sort deterministically, then
 * clamp to maxCount. Pure — takes already-normalized reviews and returns a new
 * array. Used later by both the admin preview and the public loader.
 */
export function selectReviews(
  reviews: readonly GoogleReview[],
  options: GoogleReviewDisplayOptions = {},
): GoogleReview[] {
  const filtered = filterByMinRating(reviews, options.minRating ?? null);
  const sorted = sortReviews(filtered);
  const max = clampMaxCount(options.maxCount, DEFAULT_MAX_COUNT);
  return sorted.slice(0, max);
}

// ─── cache staleness ──────────────────────────────────────────────────

function toEpochMs(value: Date | string | number | null | undefined): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * Whether a cache entry fetched at `fetchedAt` is older than `ttlMs` relative to
 * the injected `nowMs`. Pure (the clock is passed in, never read here). An
 * unknown fetch time or an invalid ttl is treated as stale (safe default).
 */
export function isCacheStale(
  fetchedAt: Date | string | number | null | undefined,
  ttlMs: number,
  nowMs: number,
): boolean {
  const fetchedMs = toEpochMs(fetchedAt);
  if (fetchedMs == null) return true;
  if (!Number.isFinite(ttlMs) || ttlMs < 0) return true;
  return nowMs - fetchedMs > ttlMs;
}
