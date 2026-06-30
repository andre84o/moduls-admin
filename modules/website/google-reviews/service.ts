import "server-only";

/**
 * Server-only Google Places (New) integration for the Website Google Reviews
 * feature. This is the ONLY place GOOGLE_PLACES_API_KEY is read, and it is read
 * inside the request — never at module load, never exported, never logged, never
 * returned. The public site must NEVER import this; it reads cached reviews from
 * the database instead (CLAUDE.md: public routes never call the Google API).
 *
 * Tenant safety: this service has no concept of a business. Callers (server
 * actions) resolve the businessId server-side and own all persistence/scoping.
 *
 * Failure policy: every outcome is a clean discriminated result — never a thrown
 * error and never a raw Google body. The success arm carries the UNNORMALIZED
 * Google payload; the caller normalizes it with the pure utils. Nothing here
 * touches Prisma/the database.
 */

/** Places API (New) Place Details endpoint base — the placeId is appended. */
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/**
 * MVP FieldMask (Places API New), sent via the X-Goog-FieldMask header. Requests
 * the place-level aggregates plus the full `reviews` collection the normalizer
 * reads. Google returns up to ~5 reviews for a place.
 */
const FIELD_MASK = "id,displayName,rating,userRatingCount,googleMapsUri,reviews";

/**
 * Result of a place-reviews fetch. Discriminated so callers handle every arm:
 *  - OK      → the raw Google payload (caller normalizes with the pure utils)
 *  - SKIPPED → nothing to do (no API key configured, or no place id) — not a
 *              per-business failure; the caller surfaces it cleanly
 *  - ERROR   → a real fetch failure, with a short generic message (no key, no
 *              raw Google body)
 */
export type GooglePlaceReviewsResult =
  | { status: "OK"; payload: unknown }
  | { status: "SKIPPED"; reason: string }
  | { status: "ERROR"; error: string };

/**
 * Fetch the reviews payload for a single Google Place. Never throws and never
 * includes the API key in its return value or in any logged value. Returns the
 * raw Google JSON on success; the caller is responsible for normalizing it.
 */
export async function fetchGooglePlaceReviews(
  placeId: string,
): Promise<GooglePlaceReviewsResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return { status: "SKIPPED", reason: "Google Places API key is not configured." };
  }

  const id = typeof placeId === "string" ? placeId.trim() : "";
  if (!id) {
    return { status: "SKIPPED", reason: "A Google Place ID is required." };
  }

  const url = `${PLACES_ENDPOINT}/${encodeURIComponent(id)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        // The key travels only in this request header — never the query string,
        // never logged. The header names are the Places API (New) convention.
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      // Reviews change slowly and the public site reads the cache, not this — no
      // need to cache the upstream call itself.
      cache: "no-store",
    });
  } catch {
    // Network/DNS/abort — never surface the raw error (it may be noisy).
    return { status: "ERROR", error: "Could not reach Google Places." };
  }

  if (!response.ok) {
    // Status only — the body may contain an unhelpful or sensitive Google error.
    return {
      status: "ERROR",
      error: `Google Places request failed (${response.status}).`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: "ERROR", error: "Google Places returned an unreadable response." };
  }

  return { status: "OK", payload };
}
