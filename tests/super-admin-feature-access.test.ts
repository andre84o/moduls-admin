import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the SUPER_ADMIN add-on toggle (setBusinessFeatureAccess).
 *
 * Proves only a SUPER_ADMIN can change add-on access, the write is a keyed
 * upsert (BusinessFeatureAccess, NOT a Project/ProjectType), arbitrary keys are
 * rejected, an audit log is written, and Google Reviews is an add-on — never a
 * ProjectType enum value.
 */

const hoisted = vi.hoisted(() => ({
  user: { id: "su_1", isDemo: false } as { id: string; isDemo: boolean } | null,
  demo: false,
  upserts: [] as unknown[],
  audits: [] as Array<{ action: string; entityType: string; metadata?: unknown }>,
}));

vi.mock("@/lib/auth", () => ({
  // requireSuperAdmin blocks non-super-admins via redirect(); the mock throws to
  // emulate that hard stop so we can assert the action never proceeds.
  requireSuperAdmin: vi.fn(async () => {
    if (!hoisted.user) throw new Error("redirect: not a super admin");
    return hoisted.user;
  }),
}));
vi.mock("@/lib/config", () => ({ isDemoMode: () => hoisted.demo }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async (entry: { action: string; entityType: string; metadata?: unknown }) => {
    hoisted.audits.push(entry);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  isDbConfigured: () => true,
  getPrisma: () => ({
    businessFeatureAccess: {
      upsert: async (args: unknown) => {
        hoisted.upserts.push(args);
        return { id: "fa_1" };
      },
    },
  }),
}));

import { setBusinessFeatureAccess } from "@/lib/super-admin-actions";
import { GOOGLE_REVIEWS_FEATURE_KEY } from "@/lib/feature-access";
import { ProjectType } from "@/app/generated/prisma/enums";

beforeEach(() => {
  hoisted.user = { id: "su_1", isDemo: false };
  hoisted.demo = false;
  hoisted.upserts = [];
  hoisted.audits = [];
});

describe("setBusinessFeatureAccess — SUPER_ADMIN add-on toggle", () => {
  it("upserts the keyed access row and writes an audit log when enabling", async () => {
    await setBusinessFeatureAccess({
      businessId: "biz_a",
      key: GOOGLE_REVIEWS_FEATURE_KEY,
      enabled: true,
    });

    expect(hoisted.upserts).toHaveLength(1);
    const args = hoisted.upserts[0] as {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.where).toEqual({
      businessId_key: { businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY },
    });
    expect(args.create).toMatchObject({ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: true });
    expect(args.update).toEqual({ enabled: true });

    expect(hoisted.audits).toHaveLength(1);
    expect(hoisted.audits[0].action).toBe("feature.enabled");
    expect(hoisted.audits[0].entityType).toBe("BusinessFeatureAccess");
  });

  it("uses feature.disabled audit action when disabling", async () => {
    await setBusinessFeatureAccess({ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: false });
    expect((hoisted.upserts[0] as { update: Record<string, unknown> }).update).toEqual({ enabled: false });
    expect(hoisted.audits[0].action).toBe("feature.disabled");
  });

  it("rejects an unknown/arbitrary feature key (writes nothing)", async () => {
    await setBusinessFeatureAccess({ businessId: "biz_a", key: "ARBITRARY_ADDON", enabled: true });
    expect(hoisted.upserts).toHaveLength(0);
    expect(hoisted.audits).toHaveLength(0);
  });

  it("does nothing without a businessId", async () => {
    await setBusinessFeatureAccess({ businessId: "  ", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: true });
    expect(hoisted.upserts).toHaveLength(0);
  });

  it("blocks a non-super-admin (requireSuperAdmin stops it before any write)", async () => {
    hoisted.user = null; // emulate a non-super-admin hitting the guard
    await expect(
      setBusinessFeatureAccess({ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: true }),
    ).rejects.toThrow();
    expect(hoisted.upserts).toHaveLength(0);
    expect(hoisted.audits).toHaveLength(0);
  });

  it("is a no-op in demo mode (no DB write)", async () => {
    hoisted.demo = true;
    await setBusinessFeatureAccess({ businessId: "biz_a", key: GOOGLE_REVIEWS_FEATURE_KEY, enabled: true });
    expect(hoisted.upserts).toHaveLength(0);
  });

  it("Google Reviews is an add-on key, NOT a ProjectType (no GOOGLE_REVIEWS module)", () => {
    expect(Object.values(ProjectType)).not.toContain("GOOGLE_REVIEWS");
    // The add-on is keyed by a plain string constant, not the enum.
    expect(GOOGLE_REVIEWS_FEATURE_KEY).toBe("GOOGLE_REVIEWS");
    expect(Object.keys(ProjectType)).not.toContain("GOOGLE_REVIEWS");
  });
});
