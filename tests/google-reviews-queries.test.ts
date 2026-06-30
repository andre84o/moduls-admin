import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tenant-safety tests for the Google Reviews admin read layer.
 *
 * requireBusinessAccess, the module gate and Prisma are mocked. They prove every
 * read is scoped by the SERVER-RESOLVED businessId, that safe defaults/empty are
 * returned when there is no row / the WEBSITE module is off / demo mode, and that
 * the cached payload is normalized on read.
 */

const hoisted = vi.hoisted(() => ({
  access: { businessId: "biz_1", userId: "user_1", role: "OWNER" as const, isDemo: false },
  moduleEnabled: true,
  settingsRow: null as Record<string, unknown> | null,
  cacheRow: null as Record<string, unknown> | null,
  calls: {
    settingsFindUnique: [] as unknown[],
    cacheFindUnique: [] as unknown[],
  },
}));

vi.mock("@/lib/auth", () => ({
  requireBusinessAccess: vi.fn(async () => hoisted.access),
}));
vi.mock("@/lib/modules", () => ({
  isModuleEnabled: vi.fn(async () => hoisted.moduleEnabled),
}));
vi.mock("@/lib/prisma", () => ({
  isDbConfigured: () => true,
  getPrisma: () => ({
    googleReviewSettings: {
      findUnique: async (args: unknown) => {
        hoisted.calls.settingsFindUnique.push(args);
        return hoisted.settingsRow;
      },
    },
    googleReviewCache: {
      findUnique: async (args: unknown) => {
        hoisted.calls.cacheFindUnique.push(args);
        return hoisted.cacheRow;
      },
    },
  }),
}));

import {
  getGoogleReviewSettings,
  getCachedGoogleReviewsAdmin,
} from "@/modules/website/google-reviews/queries";

function whereOf(arg: unknown): Record<string, unknown> {
  return (arg as { where?: Record<string, unknown> }).where ?? {};
}

beforeEach(() => {
  hoisted.access = { businessId: "biz_1", userId: "user_1", role: "OWNER", isDemo: false };
  hoisted.moduleEnabled = true;
  hoisted.settingsRow = null;
  hoisted.cacheRow = null;
  hoisted.calls = { settingsFindUnique: [], cacheFindUnique: [] };
});

describe("getGoogleReviewSettings", () => {
  it("reads scoped by the server-resolved businessId and maps the row", async () => {
    hoisted.settingsRow = {
      enabled: true,
      placeId: "place_1",
      minRating: 4,
      maxCount: 8,
      lastSyncedAt: new Date("2026-01-02T03:04:05Z"),
      lastError: null,
    };

    const settings = await getGoogleReviewSettings();

    expect(whereOf(hoisted.calls.settingsFindUnique[0])).toEqual({ businessId: "biz_1" });
    expect(settings).toEqual({
      enabled: true,
      placeId: "place_1",
      minRating: 4,
      maxCount: 8,
      lastSyncedAt: "2026-01-02T03:04:05.000Z",
      lastError: null,
    });
  });

  it("returns safe defaults when no settings row exists", async () => {
    const settings = await getGoogleReviewSettings();
    expect(settings).toEqual({
      enabled: false,
      placeId: null,
      minRating: null,
      maxCount: 6,
      lastSyncedAt: null,
      lastError: null,
    });
  });

  it("returns defaults without a DB read when the WEBSITE module is disabled", async () => {
    hoisted.moduleEnabled = false;
    const settings = await getGoogleReviewSettings();
    expect(settings.enabled).toBe(false);
    expect(hoisted.calls.settingsFindUnique).toHaveLength(0);
  });

  it("returns defaults without a DB read in demo mode", async () => {
    hoisted.access = { ...hoisted.access, isDemo: true };
    const settings = await getGoogleReviewSettings();
    expect(settings.enabled).toBe(false);
    expect(hoisted.calls.settingsFindUnique).toHaveLength(0);
  });
});

describe("getCachedGoogleReviewsAdmin", () => {
  it("reads the cache scoped by (businessId, placeId) and normalizes the raw payload", async () => {
    hoisted.settingsRow = { placeId: "place_1" };
    hoisted.cacheRow = {
      placeId: "place_1",
      fetchedAt: new Date("2026-02-03T00:00:00Z"),
      payload: {
        rating: 4.5,
        user_ratings_total: 10,
        reviews: [{ author_name: "Ada", rating: 5, text: "Great", time: 1_700_000_000 }],
      },
    };

    const cached = await getCachedGoogleReviewsAdmin();

    expect(whereOf(hoisted.calls.cacheFindUnique[0])).toEqual({
      businessId_placeId: { businessId: "biz_1", placeId: "place_1" },
    });
    expect(cached.placeId).toBe("place_1");
    expect(cached.fetchedAt).toBe("2026-02-03T00:00:00.000Z");
    expect(cached.rating).toBe(4.5);
    expect(cached.userRatingCount).toBe(10);
    expect(cached.reviews).toHaveLength(1);
    expect(cached.reviews[0]).toMatchObject({ author: "Ada", rating: 5, text: "Great", time: 1_700_000_000_000 });
  });

  it("returns empty when there is no configured place id", async () => {
    hoisted.settingsRow = { placeId: null };
    const cached = await getCachedGoogleReviewsAdmin();
    expect(cached).toEqual({ placeId: null, fetchedAt: null, rating: null, userRatingCount: null, reviews: [] });
    expect(hoisted.calls.cacheFindUnique).toHaveLength(0);
  });

  it("returns empty in demo mode without any DB read", async () => {
    hoisted.access = { ...hoisted.access, isDemo: true };
    const cached = await getCachedGoogleReviewsAdmin();
    expect(cached.reviews).toEqual([]);
    expect(hoisted.calls.settingsFindUnique).toHaveLength(0);
    expect(hoisted.calls.cacheFindUnique).toHaveLength(0);
  });
});
