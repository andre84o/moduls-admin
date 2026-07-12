import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 2C — public Google Reviews rendering & cache injection.
 *
 * Proves the public path:
 *  - recognizes the new `googleReviews` section type and skips malformed content,
 *  - reads reviews ONLY from GoogleReviewCache (never the Google API / API key),
 *  - injects cached reviews scoped to the server-resolved public businessId,
 *  - returns empty when the integration is disabled / unconfigured / uncached,
 *  - never lets one business surface another business's reviews,
 *  - never selects draftContent.
 */

const hoisted = vi.hoisted(() => ({
  businesses: [] as { id: string }[],
  pages: [] as Array<{
    businessId: string;
    key: string;
    status: string;
    sections: Array<{ isVisible: boolean; type: string; publishedContent: unknown }>;
  }>,
  settings: [] as Array<{
    businessId: string;
    enabled: boolean;
    placeId: string | null;
    minRating: number | null;
    maxCount: number;
  }>,
  caches: [] as Array<{ businessId: string; placeId: string; payload: unknown }>,
  moduleEnabled: true,
  // Businesses that have been granted the paid Google Reviews add-on.
  addOnBusinesses: new Set<string>(),
  fetchCalls: 0,
  lastFindFirstArgs: null as { where?: Record<string, unknown>; select?: unknown } | null,
}));

vi.mock("@/lib/prisma", () => ({
  isDbConfigured: () => true,
  getPrisma: () => ({
    business: {
      findMany: async ({ take }: { take?: number }) =>
        hoisted.businesses.slice(0, take ?? hoisted.businesses.length),
    },
    websitePage: {
      findFirst: async (args: { where: Record<string, unknown>; select: unknown }) => {
        hoisted.lastFindFirstArgs = args;
        const w = args.where;
        const page = hoisted.pages.find(
          (p) => p.businessId === w.businessId && p.key === w.key && p.status === w.status,
        );
        if (!page) return null;
        return {
          sections: page.sections
            .filter((s) => s.isVisible)
            .map((s) => ({ type: s.type, publishedContent: s.publishedContent })),
        };
      },
    },
    googleReviewSettings: {
      findUnique: async ({ where }: { where: { businessId: string } }) =>
        hoisted.settings.find((s) => s.businessId === where.businessId) ?? null,
    },
    googleReviewCache: {
      findUnique: async ({
        where,
      }: {
        where: { businessId_placeId: { businessId: string; placeId: string } };
      }) => {
        const { businessId, placeId } = where.businessId_placeId;
        return (
          hoisted.caches.find((c) => c.businessId === businessId && c.placeId === placeId) ?? null
        );
      },
    },
  }),
}));

vi.mock("@/lib/config", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/modules", () => ({
  isModuleEnabledForBusiness: vi.fn(async () => hoisted.moduleEnabled),
}));
vi.mock("@/lib/feature-access", () => ({
  GOOGLE_REVIEWS_FEATURE_KEY: "GOOGLE_REVIEWS",
  hasBusinessFeatureAccess: vi.fn(async (businessId: string) =>
    hoisted.addOnBusinesses.has(businessId),
  ),
}));

import { mapPublishedSections } from "@/modules/website/utils";
import { extractPlaceMeta } from "@/modules/website/google-reviews/utils";
import { getPublicGoogleReviews } from "@/modules/website/google-reviews/queries-public";
import { getPublishedPageSections } from "@/modules/website/queries-public";

const ORIGINAL_ENV = process.env.PUBLIC_BUSINESS_ID;

/** A Places-API-New-ish payload with `n` five-star reviews for a place. */
function payload(placeName: string, count: number) {
  return {
    displayName: { text: placeName, languageCode: "en" },
    googleMapsUri: `https://maps.google.com/?cid=${placeName}`,
    rating: 4.5,
    userRatingCount: 100,
    reviews: Array.from({ length: count }, (_, i) => ({
      authorAttribution: { displayName: `${placeName}-author-${i}` },
      rating: 5,
      text: { text: `Great ${placeName} ${i}` },
      publishTime: `2026-01-0${(i % 9) + 1}T00:00:00Z`,
    })),
  };
}

function googleReviewsPage(businessId: string) {
  return {
    businessId,
    key: "home",
    status: "PUBLISHED",
    sections: [
      {
        isVisible: true,
        type: "googleReviews",
        publishedContent: { heading: "Reviews", showRating: true },
      },
    ],
  };
}

beforeEach(() => {
  hoisted.businesses = [];
  hoisted.pages = [];
  hoisted.settings = [];
  hoisted.caches = [];
  hoisted.moduleEnabled = true;
  hoisted.addOnBusinesses = new Set(["biz_a", "biz_b"]);
  hoisted.fetchCalls = 0;
  hoisted.lastFindFirstArgs = null;
  delete process.env.PUBLIC_BUSINESS_ID;
  // Any real Google API call would go through fetch — spy so we can assert none.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      hoisted.fetchCalls += 1;
      throw new Error("public code must never call the network");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_ENV === undefined) delete process.env.PUBLIC_BUSINESS_ID;
  else process.env.PUBLIC_BUSINESS_ID = ORIGINAL_ENV;
});

describe("mapPublishedSections — googleReviews", () => {
  it("recognizes googleReviews and preserves editorial props", () => {
    const rows = [
      { type: "googleReviews", publishedContent: { heading: "H", showRating: false } },
    ];
    expect(mapPublishedSections(rows)).toEqual([
      { type: "googleReviews", props: { heading: "H", showRating: false } },
    ]);
  });

  it("renders even with empty editorial content (all fields optional)", () => {
    expect(mapPublishedSections([{ type: "googleReviews", publishedContent: {} }])).toEqual([
      { type: "googleReviews", props: {} },
    ]);
  });

  it("skips malformed googleReviews content safely", () => {
    const rows = [
      { type: "googleReviews", publishedContent: null },
      { type: "googleReviews", publishedContent: "nope" },
      { type: "googleReviews", publishedContent: 123 },
      { type: "googleReviews", publishedContent: [] },
    ];
    expect(mapPublishedSections(rows)).toEqual([]);
  });
});

describe("extractPlaceMeta", () => {
  it("reads Places API (New) displayName + googleMapsUri", () => {
    expect(extractPlaceMeta(payload("Acme", 1))).toEqual({
      googleMapsUri: "https://maps.google.com/?cid=Acme",
      placeName: "Acme",
    });
  });

  it("reads the legacy { result: { name, url } } envelope", () => {
    expect(extractPlaceMeta({ result: { name: "Legacy Co", url: "https://g/legacy" } })).toEqual({
      googleMapsUri: "https://g/legacy",
      placeName: "Legacy Co",
    });
  });

  it("returns nulls for junk / missing fields", () => {
    expect(extractPlaceMeta(null)).toEqual({ googleMapsUri: null, placeName: null });
    expect(extractPlaceMeta({})).toEqual({ googleMapsUri: null, placeName: null });
  });
});

describe("getPublicGoogleReviews — cache-only, tenant-scoped", () => {
  it("returns empty when there are no settings", async () => {
    const data = await getPublicGoogleReviews("biz_a");
    expect(data.reviews).toEqual([]);
    expect(data.aggregateRating).toBeNull();
    expect(hoisted.fetchCalls).toBe(0);
  });

  it("returns empty when the integration is disabled", async () => {
    hoisted.settings = [{ businessId: "biz_a", enabled: false, placeId: "p1", minRating: null, maxCount: 6 }];
    hoisted.caches = [{ businessId: "biz_a", placeId: "p1", payload: payload("Acme", 3) }];
    expect((await getPublicGoogleReviews("biz_a")).reviews).toEqual([]);
  });

  it("returns empty when enabled but no place id", async () => {
    hoisted.settings = [{ businessId: "biz_a", enabled: true, placeId: null, minRating: null, maxCount: 6 }];
    expect((await getPublicGoogleReviews("biz_a")).reviews).toEqual([]);
  });

  it("returns empty when there is no cache row yet", async () => {
    hoisted.settings = [{ businessId: "biz_a", enabled: true, placeId: "p1", minRating: null, maxCount: 6 }];
    expect((await getPublicGoogleReviews("biz_a")).reviews).toEqual([]);
  });

  it("returns selected cached reviews + aggregates, clamped by maxCount", async () => {
    hoisted.settings = [{ businessId: "biz_a", enabled: true, placeId: "p1", minRating: null, maxCount: 2 }];
    hoisted.caches = [{ businessId: "biz_a", placeId: "p1", payload: payload("Acme", 5) }];

    const data = await getPublicGoogleReviews("biz_a");
    expect(data.reviews).toHaveLength(2); // clamped by maxCount
    expect(data.aggregateRating).toBe(4.5);
    expect(data.userRatingCount).toBe(100);
    expect(data.googleMapsUri).toBe("https://maps.google.com/?cid=Acme");
    expect(data.placeName).toBe("Acme");
    expect(hoisted.fetchCalls).toBe(0);
  });

  it("never returns business B's reviews for business A", async () => {
    hoisted.settings = [
      { businessId: "biz_a", enabled: true, placeId: "pa", minRating: null, maxCount: 6 },
      { businessId: "biz_b", enabled: true, placeId: "pb", minRating: null, maxCount: 6 },
    ];
    hoisted.caches = [
      { businessId: "biz_a", placeId: "pa", payload: payload("AAA", 2) },
      { businessId: "biz_b", placeId: "pb", payload: payload("BBB", 2) },
    ];

    const a = await getPublicGoogleReviews("biz_a");
    expect(a.placeName).toBe("AAA");
    expect(a.reviews.every((r) => r.author.startsWith("AAA"))).toBe(true);
    expect(a.reviews.some((r) => r.author.startsWith("BBB"))).toBe(false);
  });

  it("returns empty when the paid add-on is NOT granted, even with settings + cache", async () => {
    hoisted.addOnBusinesses = new Set(); // add-on revoked for everyone
    hoisted.settings = [{ businessId: "biz_a", enabled: true, placeId: "pa", minRating: null, maxCount: 6 }];
    hoisted.caches = [{ businessId: "biz_a", placeId: "pa", payload: payload("Acme", 3) }];

    const data = await getPublicGoogleReviews("biz_a");
    expect(data.reviews).toEqual([]);
    expect(data.aggregateRating).toBeNull();
  });

  it("add-on granted to business A does not enable business B's public reviews", async () => {
    hoisted.addOnBusinesses = new Set(["biz_a"]); // only A has the add-on
    hoisted.settings = [
      { businessId: "biz_a", enabled: true, placeId: "pa", minRating: null, maxCount: 6 },
      { businessId: "biz_b", enabled: true, placeId: "pb", minRating: null, maxCount: 6 },
    ];
    hoisted.caches = [
      { businessId: "biz_a", placeId: "pa", payload: payload("AAA", 2) },
      { businessId: "biz_b", placeId: "pb", payload: payload("BBB", 2) },
    ];

    expect((await getPublicGoogleReviews("biz_a")).reviews).toHaveLength(2);
    expect((await getPublicGoogleReviews("biz_b")).reviews).toEqual([]);
  });
});

describe("getPublishedPageSections — googleReviews injection", () => {
  it("injects cached reviews into the googleReviews section, scoped by resolved businessId", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    hoisted.businesses = [{ id: "biz_a" }, { id: "biz_b" }];
    hoisted.pages = [googleReviewsPage("biz_a")];
    hoisted.settings = [{ businessId: "biz_a", enabled: true, placeId: "pa", minRating: null, maxCount: 6 }];
    hoisted.caches = [{ businessId: "biz_a", placeId: "pa", payload: payload("Acme", 3) }];

    const sections = await getPublishedPageSections("home");
    expect(sections).toHaveLength(1);
    const props = sections![0].props as { heading?: string; reviews?: unknown[]; placeName?: string };
    expect(sections![0].type).toBe("googleReviews");
    expect(props.heading).toBe("Reviews"); // editorial content preserved
    expect(props.reviews).toHaveLength(3); // injected from cache
    expect(props.placeName).toBe("Acme");
    expect(hoisted.fetchCalls).toBe(0); // no Google API call anywhere
  });

  it("injects empty reviews when the integration is disabled (section still renders)", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    hoisted.businesses = [{ id: "biz_a" }];
    hoisted.pages = [googleReviewsPage("biz_a")];
    hoisted.settings = [{ businessId: "biz_a", enabled: false, placeId: "pa", minRating: null, maxCount: 6 }];
    hoisted.caches = [{ businessId: "biz_a", placeId: "pa", payload: payload("Acme", 3) }];

    const sections = await getPublishedPageSections("home");
    const props = sections![0].props as { reviews?: unknown[] };
    expect(props.reviews).toEqual([]);
  });

  it("does not select draftContent when injecting reviews", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    hoisted.businesses = [{ id: "biz_a" }];
    hoisted.pages = [googleReviewsPage("biz_a")];
    hoisted.settings = [{ businessId: "biz_a", enabled: true, placeId: "pa", minRating: null, maxCount: 6 }];
    hoisted.caches = [{ businessId: "biz_a", placeId: "pa", payload: payload("Acme", 1) }];

    await getPublishedPageSections("home");
    expect(JSON.stringify(hoisted.lastFindFirstArgs?.select)).not.toContain("draftContent");
  });
});
