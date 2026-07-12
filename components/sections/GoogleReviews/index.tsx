import type { GoogleReview } from "@/modules/website/google-reviews/types";

/**
 * Public Google Reviews section — shared, reusable, presentational only.
 *
 * Editorial copy (eyebrow/heading/body and the show* toggles) comes from the
 * WebsiteSection publishedContent. The actual `reviews` plus place aggregates
 * are INJECTED server-side by the public Website loader from the cached
 * GoogleReviewCache — this component never fetches anything, never calls the
 * Google API, and never sees GOOGLE_PLACES_API_KEY. It must render safely with
 * no reviews (empty array / omitted props), so every field is optional and the
 * review grid is simply absent when there is nothing cached yet.
 */

export type GoogleReviewsProps = {
  // Editorial content (publishedContent) — all optional.
  eyebrow?: string;
  heading?: string;
  body?: string;
  showRating?: boolean;
  showReviewCount?: boolean;
  // Server-injected from the cache — optional so editorial-only content typechecks.
  reviews?: GoogleReview[];
  aggregateRating?: number | null;
  userRatingCount?: number | null;
  googleMapsUri?: string | null;
  placeName?: string | null;
  accentClassName?: string;
};

/** Clamp a rating into whole stars in 0..5 for the star row. */
function toStars(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  const r = Math.round(rating);
  return r < 0 ? 0 : r > 5 ? 5 : r;
}

function StarRow({ rating }: { rating: number }) {
  const full = toStars(rating);
  return (
    <span
      className="text-amber-500"
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {"★".repeat(full)}
      <span className="text-zinc-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function GoogleReviews({
  eyebrow,
  heading,
  body,
  showRating = true,
  showReviewCount = true,
  reviews = [],
  aggregateRating = null,
  userRatingCount = null,
  googleMapsUri = null,
  placeName = null,
  accentClassName = "text-indigo-600",
}: GoogleReviewsProps) {
  const hasReviews = reviews.length > 0;
  const showAggregate = showRating && aggregateRating != null;
  const showCount = showReviewCount && userRatingCount != null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p
            className={`mb-4 text-sm font-medium uppercase tracking-[0.2em] ${accentClassName}`}
          >
            {eyebrow}
          </p>
        ) : null}
        {heading ? (
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {heading}
          </h2>
        ) : null}
        {body ? <p className="mt-4 text-lg text-zinc-600">{body}</p> : null}

        {showAggregate || showCount ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-600">
            {showAggregate ? (
              <>
                <StarRow rating={aggregateRating as number} />
                <span className="font-semibold text-zinc-900">
                  {(aggregateRating as number).toFixed(1)}
                </span>
              </>
            ) : null}
            {showCount ? (
              <span>
                {showAggregate ? "· " : ""}
                {userRatingCount} review{userRatingCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasReviews ? (
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <article
              key={`${review.author}-${review.time ?? index}`}
              className="flex flex-col rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-semibold tracking-tight">
                  {review.author || "Anonymous"}
                </span>
                <StarRow rating={review.rating} />
              </div>
              {review.text ? (
                <p className="flex-1 text-zinc-600">{review.text}</p>
              ) : null}
              {review.relativeTime ? (
                <p className="mt-4 text-xs uppercase tracking-wide text-zinc-400">
                  {review.relativeTime}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {googleMapsUri ? (
        <div className="mt-12 text-center">
          <a
            href={googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full border border-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          >
            {placeName ? `See all reviews on Google` : "View on Google"}
          </a>
        </div>
      ) : null}
    </section>
  );
}
