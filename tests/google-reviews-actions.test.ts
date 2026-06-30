import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tenant-safety tests for the Google Reviews server actions.
 *
 * requireModule, the audit log, next/cache and the server-only Google Places
 * service are all mocked so these run without a database or network. They prove
 * that EVERY read/write is scoped by the SERVER-RESOLVED businessId (never a
 * client value), that the cache stores the RAW payload, that a service ERROR is
 * recorded as lastError (cleared on success), that clearing only touches the
 * active business, that demo mode is a no-op, and that the audit actions use the
 * expected names.
 */

const hoisted = vi.hoisted(() => ({
  access: { businessId: "biz_1", userId: "user_1", role: "OWNER" as const, isDemo: false },
  settingsRow: { enabled: true, placeId: "place_1" } as
    | { enabled: boolean; placeId: string | null }
    | null,
  // Default service result: OK with a raw Google-ish payload (2 reviews).
  service: { status: "OK", payload: { reviews: [{ rating: 5, text: "a" }, { rating: 4, text: "b" }] } } as
    | { status: "OK"; payload: unknown }
    | { status: "SKIPPED"; reason: string }
    | { status: "ERROR"; error: string },
  calls: {
    settingsUpsert: [] as unknown[],
    settingsUpdateMany: [] as unknown[],
    settingsFindUnique: [] as unknown[],
    cacheDeleteMany: [] as unknown[],
    cacheCreate: [] as unknown[],
    audit: [] as Array<{ action: string }>,
    transaction: 0,
  },
}));

vi.mock("@/lib/modules", () => ({
  requireModule: vi.fn(async () => hoisted.access),
}));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async (entry: { action: string }) => {
    hoisted.calls.audit.push(entry);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/website/google-reviews/service", () => ({
  fetchGooglePlaceReviews: vi.fn(async () => hoisted.service),
}));
vi.mock("@/lib/prisma", () => ({
  isDbConfigured: () => true,
  getPrisma: () => ({
    googleReviewSettings: {
      upsert: async (args: unknown) => {
        hoisted.calls.settingsUpsert.push(args);
        return { id: "settings_1" };
      },
      updateMany: async (args: unknown) => {
        hoisted.calls.settingsUpdateMany.push(args);
        return { count: 1 };
      },
      findUnique: async (args: unknown) => {
        hoisted.calls.settingsFindUnique.push(args);
        return hoisted.settingsRow;
      },
    },
    googleReviewCache: {
      deleteMany: async (args: unknown) => {
        hoisted.calls.cacheDeleteMany.push(args);
        return { count: 2 };
      },
      create: async (args: unknown) => {
        hoisted.calls.cacheCreate.push(args);
        return { id: "cache_1" };
      },
    },
    // Actions pass an array of in-flight operations; mirror Prisma's behavior.
    $transaction: async (ops: Promise<unknown>[]) => {
      hoisted.calls.transaction += 1;
      return Promise.all(ops);
    },
  }),
}));

import {
  saveGoogleReviewSettings,
  syncGoogleReviews,
  clearGoogleReviewCache,
} from "@/modules/website/google-reviews/actions";

function whereOf(arg: unknown): Record<string, unknown> {
  return (arg as { where?: Record<string, unknown> }).where ?? {};
}
function auditActions(): string[] {
  return hoisted.calls.audit.map((a) => a.action);
}

beforeEach(() => {
  hoisted.access = { businessId: "biz_1", userId: "user_1", role: "OWNER", isDemo: false };
  hoisted.settingsRow = { enabled: true, placeId: "place_1" };
  hoisted.service = {
    status: "OK",
    payload: { reviews: [{ rating: 5, text: "a" }, { rating: 4, text: "b" }] },
  };
  hoisted.calls = {
    settingsUpsert: [],
    settingsUpdateMany: [],
    settingsFindUnique: [],
    cacheDeleteMany: [],
    cacheCreate: [],
    audit: [],
    transaction: 0,
  };
});

describe("saveGoogleReviewSettings — server-resolved tenant scope", () => {
  it("upserts on the server-resolved businessId, clamps inputs, ignores client businessId", async () => {
    const res = await saveGoogleReviewSettings({
      enabled: true,
      placeId: "  place_1  ",
      minRating: 9, // clamped to 5
      maxCount: 999, // clamped down to 50
      // @ts-expect-error — a client-injected businessId must never be trusted/used
      businessId: "biz_attacker",
    });

    expect(res).toEqual({});
    expect(hoisted.calls.settingsUpsert).toHaveLength(1);
    const args = hoisted.calls.settingsUpsert[0] as {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.where).toEqual({ businessId: "biz_1" });
    expect(args.create.businessId).toBe("biz_1"); // never biz_attacker
    expect(args.create.placeId).toBe("place_1"); // trimmed
    expect(args.create.minRating).toBe(5);
    expect(args.create.maxCount).toBe(50);
    expect(args.update).not.toHaveProperty("businessId"); // never re-targeted
    expect(auditActions()).toContain("google_reviews.settings_updated");
  });

  it("rejects enabling without a place id and writes nothing", async () => {
    const res = await saveGoogleReviewSettings({ enabled: true, placeId: "" });
    expect(res.error).toBeTruthy();
    expect(hoisted.calls.settingsUpsert).toHaveLength(0);
  });

  it("is a no-op in demo mode", async () => {
    hoisted.access = { ...hoisted.access, isDemo: true };
    const res = await saveGoogleReviewSettings({ enabled: false });
    expect(res).toEqual({});
    expect(hoisted.calls.settingsUpsert).toHaveLength(0);
  });
});

describe("syncGoogleReviews — cache writes scoped to the active business", () => {
  it("replaces the cache with the RAW payload, scoped by businessId, and clears lastError", async () => {
    const res = await syncGoogleReviews();

    expect(res).toEqual({ count: 2 });
    expect(whereOf(hoisted.calls.settingsFindUnique[0])).toEqual({ businessId: "biz_1" });
    expect(whereOf(hoisted.calls.cacheDeleteMany[0])).toEqual({ businessId: "biz_1" });

    const created = hoisted.calls.cacheCreate[0] as { data: Record<string, unknown> };
    expect(created.data.businessId).toBe("biz_1");
    expect(created.data.placeId).toBe("place_1");
    // RAW payload stored (not normalized) — read layers normalize on read.
    expect(created.data.payload).toEqual({ reviews: [{ rating: 5, text: "a" }, { rating: 4, text: "b" }] });

    const upd = hoisted.calls.settingsUpdateMany[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(upd.where).toEqual({ businessId: "biz_1" });
    expect(upd.data.lastError).toBeNull();
    expect(upd.data.lastSyncedAt).toBeInstanceOf(Date);
    expect(auditActions()).toContain("google_reviews.synced");
  });

  it("records lastError (scoped by businessId) and writes no cache on service ERROR", async () => {
    hoisted.service = { status: "ERROR", error: "Google Places request failed (403)." };

    const res = await syncGoogleReviews();

    expect(res.error).toBe("Google Places request failed (403).");
    expect(hoisted.calls.cacheDeleteMany).toHaveLength(0);
    expect(hoisted.calls.cacheCreate).toHaveLength(0);
    const upd = hoisted.calls.settingsUpdateMany[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(upd.where).toEqual({ businessId: "biz_1" });
    expect(upd.data.lastError).toBe("Google Places request failed (403).");
    expect(auditActions()).toContain("google_reviews.sync_failed");
  });

  it("surfaces a SKIPPED service result cleanly without persisting lastError", async () => {
    hoisted.service = { status: "SKIPPED", reason: "Google Places API key is not configured." };

    const res = await syncGoogleReviews();

    expect(res.error).toMatch(/not configured/i);
    expect(hoisted.calls.settingsUpdateMany).toHaveLength(0); // no lastError write
    expect(hoisted.calls.cacheCreate).toHaveLength(0);
  });

  it("returns a clean error when disabled or missing a place id (no service call)", async () => {
    hoisted.settingsRow = { enabled: false, placeId: "place_1" };
    const disabled = await syncGoogleReviews();
    expect(disabled.error).toBeTruthy();
    expect(hoisted.calls.cacheCreate).toHaveLength(0);

    hoisted.settingsRow = { enabled: true, placeId: null };
    const noPlace = await syncGoogleReviews();
    expect(noPlace.error).toBeTruthy();
    expect(hoisted.calls.cacheCreate).toHaveLength(0);
  });

  it("scopes all writes to a different tenant when access resolves to another business", async () => {
    hoisted.access = { ...hoisted.access, businessId: "biz_2" };
    await syncGoogleReviews();
    expect(whereOf(hoisted.calls.cacheDeleteMany[0])).toEqual({ businessId: "biz_2" });
    const created = hoisted.calls.cacheCreate[0] as { data: Record<string, unknown> };
    expect(created.data.businessId).toBe("biz_2");
  });

  it("is a no-op in demo mode", async () => {
    hoisted.access = { ...hoisted.access, isDemo: true };
    const res = await syncGoogleReviews();
    expect(res).toEqual({});
    expect(hoisted.calls.settingsFindUnique).toHaveLength(0);
    expect(hoisted.calls.cacheCreate).toHaveLength(0);
  });
});

describe("clearGoogleReviewCache — only the active business's cache", () => {
  it("deletes cache rows scoped by the server-resolved businessId", async () => {
    const res = await clearGoogleReviewCache();
    expect(res).toEqual({ count: 2 });
    expect(hoisted.calls.cacheDeleteMany).toHaveLength(1);
    expect(whereOf(hoisted.calls.cacheDeleteMany[0])).toEqual({ businessId: "biz_1" });
    expect(auditActions()).toContain("google_reviews.cache_cleared");
  });

  it("scopes to a different businessId when access resolves to another tenant", async () => {
    hoisted.access = { ...hoisted.access, businessId: "biz_2" };
    await clearGoogleReviewCache();
    expect(whereOf(hoisted.calls.cacheDeleteMany[0])).toEqual({ businessId: "biz_2" });
  });

  it("is a no-op in demo mode", async () => {
    hoisted.access = { ...hoisted.access, isDemo: true };
    const res = await clearGoogleReviewCache();
    expect(res).toEqual({});
    expect(hoisted.calls.cacheDeleteMany).toHaveLength(0);
  });
});
