import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the generic per-business add-on gate (BusinessFeatureAccess).
 *
 * Proves hasBusinessFeatureAccess is scoped by (businessId, key), defaults to
 * false when no row exists or the row is disabled, and never lets one business's
 * grant leak into another's. Demo mode enables every add-on.
 */

const hoisted = vi.hoisted(() => ({
  rows: [] as Array<{ businessId: string; key: string; enabled: boolean }>,
  demo: false,
  lastWhere: null as unknown,
}));

vi.mock("@/lib/config", () => ({ isDemoMode: () => hoisted.demo }));
vi.mock("@/lib/prisma", () => ({
  isDbConfigured: () => true,
  getPrisma: () => ({
    businessFeatureAccess: {
      findUnique: async ({
        where,
      }: {
        where: { businessId_key: { businessId: string; key: string } };
      }) => {
        hoisted.lastWhere = where;
        const { businessId, key } = where.businessId_key;
        return hoisted.rows.find((r) => r.businessId === businessId && r.key === key) ?? null;
      },
    },
  }),
}));

import {
  hasBusinessFeatureAccess,
  GOOGLE_REVIEWS_FEATURE_KEY,
  KNOWN_FEATURE_KEYS,
} from "@/lib/feature-access";

beforeEach(() => {
  hoisted.rows = [];
  hoisted.demo = false;
  hoisted.lastWhere = null;
});

describe("hasBusinessFeatureAccess", () => {
  it("returns false when there is no access row", async () => {
    expect(await hasBusinessFeatureAccess("biz_a", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(false);
  });

  it("returns false when the row exists but is disabled", async () => {
    hoisted.rows = [{ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: false }];
    expect(await hasBusinessFeatureAccess("biz_a", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(false);
  });

  it("returns true when the row is enabled", async () => {
    hoisted.rows = [{ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: true }];
    expect(await hasBusinessFeatureAccess("biz_a", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(true);
    expect(hoisted.lastWhere).toEqual({
      businessId_key: { businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY },
    });
  });

  it("business A's grant does not enable business B", async () => {
    hoisted.rows = [{ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: true }];
    expect(await hasBusinessFeatureAccess("biz_a", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(true);
    expect(await hasBusinessFeatureAccess("biz_b", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(false);
  });

  it("scopes by key — a different key is not granted", async () => {
    hoisted.rows = [{ businessId: "biz_a", key: "SOME_OTHER_ADDON", enabled: true }];
    expect(await hasBusinessFeatureAccess("biz_a", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(false);
  });

  it("enables every add-on in demo mode without touching the database", async () => {
    hoisted.demo = true;
    expect(await hasBusinessFeatureAccess("biz_a", GOOGLE_REVIEWS_FEATURE_KEY)).toBe(true);
    expect(hoisted.lastWhere).toBeNull(); // never queried the DB
  });

  it("whitelists GOOGLE_REVIEWS as a known feature key", () => {
    expect(KNOWN_FEATURE_KEYS.has(GOOGLE_REVIEWS_FEATURE_KEY)).toBe(true);
  });
});
