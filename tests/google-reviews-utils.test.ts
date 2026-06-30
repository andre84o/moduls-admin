import { describe, it, expect } from "vitest";
import {
  DEFAULT_MAX_COUNT,
  clampMaxCount,
  clampMinRating,
  normalizeReview,
  normalizeReviews,
  normalizePayload,
  filterByMinRating,
  sortReviews,
  selectReviews,
  isCacheStale,
} from "@/modules/website/google-reviews/utils";
import type { GoogleReview } from "@/modules/website/google-reviews/types";

/** Build a normalized review for selection/sort tests. */
function review(partial: Partial<GoogleReview>): GoogleReview {
  return {
    author: "",
    rating: 0,
    text: "",
    relativeTime: "",
    time: null,
    profilePhotoUrl: null,
    authorUrl: null,
    language: null,
    ...partial,
  };
}

const GOOGLE_REVIEW_KEYS = [
  "author",
  "rating",
  "text",
  "relativeTime",
  "time",
  "profilePhotoUrl",
  "authorUrl",
  "language",
].sort();

describe("clampMaxCount", () => {
  it("falls back to DEFAULT_MAX_COUNT for missing/invalid values", () => {
    expect(clampMaxCount(undefined)).toBe(DEFAULT_MAX_COUNT);
    expect(clampMaxCount(null)).toBe(DEFAULT_MAX_COUNT);
    expect(clampMaxCount("8")).toBe(DEFAULT_MAX_COUNT);
    expect(clampMaxCount(Number.NaN)).toBe(DEFAULT_MAX_COUNT);
  });

  it("clamps into [0, 50] and floors fractions", () => {
    expect(clampMaxCount(3)).toBe(3);
    expect(clampMaxCount(2.9)).toBe(2);
    expect(clampMaxCount(-5)).toBe(0);
    expect(clampMaxCount(1000)).toBe(50);
  });
});

describe("clampMinRating", () => {
  it("returns null (no filter) for null/undefined/invalid", () => {
    expect(clampMinRating(null)).toBeNull();
    expect(clampMinRating(undefined)).toBeNull();
    expect(clampMinRating("4")).toBeNull();
    expect(clampMinRating(Number.NaN)).toBeNull();
  });

  it("clamps into [1, 5] and rounds", () => {
    expect(clampMinRating(0)).toBe(1);
    expect(clampMinRating(3)).toBe(3);
    expect(clampMinRating(3.6)).toBe(4);
    expect(clampMinRating(9)).toBe(5);
  });
});

describe("normalizeReview", () => {
  it("normalizes the legacy Place Details (snake_case) shape", () => {
    const r = normalizeReview({
      author_name: "Ada",
      rating: 5,
      text: "Great",
      relative_time_description: "2 weeks ago",
      time: 1_700_000_000, // unix seconds
      profile_photo_url: "https://img/ada.png",
      author_url: "https://maps/ada",
      language: "en",
    });
    expect(r).toEqual({
      author: "Ada",
      rating: 5,
      text: "Great",
      relativeTime: "2 weeks ago",
      time: 1_700_000_000_000, // converted to ms
      profilePhotoUrl: "https://img/ada.png",
      authorUrl: "https://maps/ada",
      language: "en",
    });
  });

  it("normalizes the Places API New (attribution + nested text) shape", () => {
    const r = normalizeReview({
      authorAttribution: {
        displayName: "Grace",
        photoUri: "https://img/grace.png",
        uri: "https://maps/grace",
      },
      rating: 4,
      originalText: { text: "Solid" },
      relativePublishTime: "a month ago",
      publishTime: "2026-01-15T10:00:00Z",
      languageCode: "sv",
    });
    expect(r?.author).toBe("Grace");
    expect(r?.text).toBe("Solid");
    expect(r?.profilePhotoUrl).toBe("https://img/grace.png");
    expect(r?.language).toBe("sv");
    expect(r?.time).toBe(Date.parse("2026-01-15T10:00:00Z"));
  });

  it("returns null for non-object input and never throws on junk", () => {
    expect(normalizeReview(null)).toBeNull();
    expect(normalizeReview("x")).toBeNull();
    expect(normalizeReview(42)).toBeNull();
    expect(normalizeReview([])).toBeNull();
  });

  it("uses safe defaults for missing fields (rating 0, empty strings, null)", () => {
    expect(normalizeReview({})).toEqual(review({}));
  });

  it("does NOT carry a businessId (or any tenant field) from client data", () => {
    const r = normalizeReview({
      author_name: "Mallory",
      rating: 5,
      text: "hi",
      businessId: "biz_attacker",
      ownerId: "owner_x",
      tenantId: "t1",
    });
    expect(r).not.toBeNull();
    expect(Object.keys(r as object).sort()).toEqual(GOOGLE_REVIEW_KEYS);
    expect(r).not.toHaveProperty("businessId");
    expect(JSON.stringify(r)).not.toContain("biz_attacker");
  });

  it("clamps an out-of-range review rating into 0..5", () => {
    expect(normalizeReview({ rating: 99 })?.rating).toBe(5);
    expect(normalizeReview({ rating: -3 })?.rating).toBe(0);
    expect(normalizeReview({ rating: "five" })?.rating).toBe(0);
  });
});

describe("normalizeReviews / normalizePayload (robust, never crashes)", () => {
  it("returns [] for empty/invalid payloads", () => {
    expect(normalizeReviews(null)).toEqual([]);
    expect(normalizeReviews(undefined)).toEqual([]);
    expect(normalizeReviews({})).toEqual([]);
    expect(normalizeReviews(123)).toEqual([]);
    expect(normalizeReviews("nope")).toEqual([]);
  });

  it("accepts an array, a { reviews } object, and a { result: { reviews } } envelope", () => {
    const item = { author_name: "A", rating: 5, text: "t" };
    expect(normalizeReviews([item])).toHaveLength(1);
    expect(normalizeReviews({ reviews: [item] })).toHaveLength(1);
    expect(normalizeReviews({ result: { reviews: [item] } })).toHaveLength(1);
  });

  it("drops non-object entries inside a reviews array without crashing", () => {
    const out = normalizeReviews({ reviews: [null, 1, "x", { rating: 4 }] });
    expect(out).toHaveLength(1);
    expect(out[0].rating).toBe(4);
  });

  it("normalizePayload extracts aggregates and never throws on junk", () => {
    expect(normalizePayload(undefined)).toEqual({
      rating: null,
      userRatingCount: null,
      reviews: [],
    });
    const p = normalizePayload({
      result: {
        rating: 4.5,
        user_ratings_total: 120,
        reviews: [{ author_name: "A", rating: 5, text: "t" }],
      },
    });
    expect(p.rating).toBe(4.5);
    expect(p.userRatingCount).toBe(120);
    expect(p.reviews).toHaveLength(1);
  });
});

describe("filterByMinRating", () => {
  const reviews = [
    review({ author: "a", rating: 5 }),
    review({ author: "b", rating: 3 }),
    review({ author: "c", rating: 1 }),
  ];

  it("keeps only reviews at or above the minimum", () => {
    expect(filterByMinRating(reviews, 3).map((r) => r.rating)).toEqual([5, 3]);
    expect(filterByMinRating(reviews, 5).map((r) => r.rating)).toEqual([5]);
  });

  it("returns all reviews (a copy) when minRating is null", () => {
    const out = filterByMinRating(reviews, null);
    expect(out).toHaveLength(3);
    expect(out).not.toBe(reviews); // copy, not the same reference
  });

  it("does not mutate the input array", () => {
    const before = reviews.map((r) => r.rating);
    filterByMinRating(reviews, 4);
    expect(reviews.map((r) => r.rating)).toEqual(before);
  });
});

describe("sortReviews (deterministic)", () => {
  it("orders by rating desc, then time desc, then author, then text", () => {
    const input = [
      review({ author: "z", rating: 5, time: 100 }),
      review({ author: "a", rating: 5, time: 200 }),
      review({ author: "m", rating: 3, time: 999 }),
      review({ author: "a", rating: 5, time: 200, text: "b" }),
      review({ author: "a", rating: 5, time: 200, text: "a" }),
    ];
    const out = sortReviews(input).map((r) => [r.author, r.rating, r.time, r.text]);
    expect(out).toEqual([
      ["a", 5, 200, ""], // empty string sorts before "a"/"b"
      ["a", 5, 200, "a"],
      ["a", 5, 200, "b"],
      ["z", 5, 100, ""],
      ["m", 3, 999, ""],
    ]);
  });

  it("is order-independent: shuffled inputs yield identical output", () => {
    const a = [
      review({ author: "a", rating: 4, time: 10 }),
      review({ author: "b", rating: 4, time: 20 }),
      review({ author: "c", rating: 5, time: null }),
    ];
    const b = [a[2], a[0], a[1]];
    expect(sortReviews(a)).toEqual(sortReviews(b));
  });

  it("sorts unknown (null) times last within a rating", () => {
    const out = sortReviews([
      review({ author: "x", rating: 5, time: null }),
      review({ author: "y", rating: 5, time: 1 }),
    ]);
    expect(out.map((r) => r.author)).toEqual(["y", "x"]);
  });

  it("does not mutate the input array", () => {
    const input = [review({ author: "b", rating: 1 }), review({ author: "a", rating: 5 })];
    const snapshot = input.map((r) => r.author);
    sortReviews(input);
    expect(input.map((r) => r.author)).toEqual(snapshot);
  });
});

describe("selectReviews (filter + sort + clamp)", () => {
  const reviews = [
    review({ author: "a", rating: 5, time: 1 }),
    review({ author: "b", rating: 4, time: 2 }),
    review({ author: "c", rating: 2, time: 3 }),
    review({ author: "d", rating: 5, time: 4 }),
  ];

  it("applies minRating then maxCount", () => {
    const out = selectReviews(reviews, { minRating: 4, maxCount: 2 });
    expect(out.map((r) => r.author)).toEqual(["d", "a"]); // rating 5s, newest first
    expect(out).toHaveLength(2);
  });

  it("clamps maxCount and defaults when unset", () => {
    expect(selectReviews(reviews, { maxCount: 1 })).toHaveLength(1);
    expect(selectReviews(reviews, { maxCount: 1000 })).toHaveLength(4);
    expect(selectReviews(reviews)).toHaveLength(4); // default 6 > 4 items
    expect(selectReviews(reviews, { maxCount: 0 })).toHaveLength(0);
  });

  it("produces JSON-serializable output (round-trips unchanged)", () => {
    const out = selectReviews(reviews, { minRating: 4 });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});

describe("isCacheStale (clock injected, pure)", () => {
  const now = 1_000_000;

  it("is fresh within the ttl and stale beyond it", () => {
    expect(isCacheStale(now - 500, 1000, now)).toBe(false);
    expect(isCacheStale(now - 1500, 1000, now)).toBe(true);
  });

  it("accepts Date, numeric ms, and ISO string fetch times", () => {
    expect(isCacheStale(new Date(now - 100), 1000, now)).toBe(false);
    expect(isCacheStale("2026-01-01T00:00:00Z", 1000, Date.parse("2026-01-01T00:00:00.500Z"))).toBe(false);
  });

  it("treats an unknown fetch time or invalid ttl as stale (safe default)", () => {
    expect(isCacheStale(null, 1000, now)).toBe(true);
    expect(isCacheStale(undefined, 1000, now)).toBe(true);
    expect(isCacheStale("not-a-date", 1000, now)).toBe(true);
    expect(isCacheStale(now, -1, now)).toBe(true);
  });
});
