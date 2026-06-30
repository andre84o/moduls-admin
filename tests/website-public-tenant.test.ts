import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 0.5 — public Website Content tenant resolution.
 *
 * Proves the public loader resolves the public businessId FIRST (PUBLIC_BUSINESS_ID,
 * else the sole business, else nothing) and then scopes the WebsitePage lookup by
 * businessId + key + PUBLISHED — never resolving a page by key alone and trusting
 * its businessId, and never guessing between multiple tenants. Also proves only
 * publishedContent is selected (never draftContent).
 */

// Mutable in-memory state the mocked prisma/modules read from per test.
const hoisted = vi.hoisted(() => ({
  businesses: [] as { id: string }[],
  pages: [] as Array<{
    businessId: string;
    key: string;
    status: string;
    sections: Array<{ isVisible: boolean; type: string; publishedContent: unknown }>;
  }>,
  moduleEnabled: true,
  // Captured args of the last websitePage.findFirst call (null = never called).
  lastFindFirstArgs: null as { where?: Record<string, unknown>; select?: unknown } | null,
}));

vi.mock("@/lib/prisma", () => ({
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
          (p) =>
            p.businessId === w.businessId &&
            p.key === w.key &&
            p.status === w.status,
        );
        if (!page) return null;
        // Emulate the nested sections select: visible rows, published content only.
        return {
          sections: page.sections
            .filter((s) => s.isVisible)
            .map((s) => ({ type: s.type, publishedContent: s.publishedContent })),
        };
      },
    },
  }),
  isDbConfigured: () => true,
}));

vi.mock("@/lib/config", () => ({
  isDemoMode: () => false,
}));

vi.mock("@/lib/modules", () => ({
  isModuleEnabledForBusiness: vi.fn(async () => hoisted.moduleEnabled),
}));

import { pickPublicBusinessId } from "@/modules/website/utils";
import { getPublishedHomeSections } from "@/modules/website/queries-public";

const ORIGINAL_ENV = process.env.PUBLIC_BUSINESS_ID;

/** A PUBLISHED home page with one renderable hero section for `businessId`. */
function homePage(businessId: string) {
  return {
    businessId,
    key: "home",
    status: "PUBLISHED",
    sections: [
      {
        isVisible: true,
        type: "hero",
        publishedContent: {
          eyebrow: "",
          heading: `H-${businessId}`,
          body: "",
          cta: { label: "Go", href: "/x" },
        },
      },
    ],
  };
}

beforeEach(() => {
  hoisted.businesses = [];
  hoisted.pages = [];
  hoisted.moduleEnabled = true;
  hoisted.lastFindFirstArgs = null;
  delete process.env.PUBLIC_BUSINESS_ID;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.PUBLIC_BUSINESS_ID;
  else process.env.PUBLIC_BUSINESS_ID = ORIGINAL_ENV;
});

describe("pickPublicBusinessId (pure resolution order)", () => {
  it("uses an explicit PUBLIC_BUSINESS_ID even when multiple businesses exist", () => {
    expect(pickPublicBusinessId("biz_env", ["a", "b"])).toBe("biz_env");
  });

  it("falls back to the only business when exactly one exists and env is unset", () => {
    expect(pickPublicBusinessId(null, ["only"])).toBe("only");
    expect(pickPublicBusinessId("", ["only"])).toBe("only");
    expect(pickPublicBusinessId("   ", ["only"])).toBe("only");
  });

  it("returns null with multiple businesses and no explicit tenant (no guessing)", () => {
    expect(pickPublicBusinessId(null, ["a", "b"])).toBeNull();
  });

  it("returns null with zero businesses and no explicit tenant", () => {
    expect(pickPublicBusinessId(undefined, [])).toBeNull();
  });
});

describe("getPublishedHomeSections — tenant scoping", () => {
  it("scopes the home lookup by PUBLIC_BUSINESS_ID", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    hoisted.businesses = [{ id: "biz_a" }, { id: "biz_b" }];
    hoisted.pages = [homePage("biz_a"), homePage("biz_b")];

    const sections = await getPublishedHomeSections();

    expect(sections?.map((s) => s.type)).toEqual(["hero"]);
    expect(hoisted.lastFindFirstArgs?.where).toEqual({
      businessId: "biz_a",
      key: "home",
      status: "PUBLISHED",
    });
  });

  it("uses the single-business fallback when exactly one exists and no env is set", async () => {
    hoisted.businesses = [{ id: "solo" }];
    hoisted.pages = [homePage("solo")];

    const sections = await getPublishedHomeSections();

    expect(sections?.map((s) => s.type)).toEqual(["hero"]);
    expect(hoisted.lastFindFirstArgs?.where?.businessId).toBe("solo");
  });

  it("returns null (config fallback) with multiple businesses and no env — never guesses", async () => {
    hoisted.businesses = [{ id: "biz_a" }, { id: "biz_b" }];
    hoisted.pages = [homePage("biz_a"), homePage("biz_b")];

    const sections = await getPublishedHomeSections();

    expect(sections).toBeNull();
    // It must not even attempt a page lookup when no tenant can be resolved.
    expect(hoisted.lastFindFirstArgs).toBeNull();
  });

  it("does not resolve another business's home when the key collides across tenants", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    // Only biz_b has a published "home"; biz_a (the configured tenant) does not.
    hoisted.businesses = [{ id: "biz_a" }, { id: "biz_b" }];
    hoisted.pages = [homePage("biz_b")];

    const sections = await getPublishedHomeSections();

    expect(sections).toBeNull(); // never falls through to biz_b's page
    expect(hoisted.lastFindFirstArgs?.where?.businessId).toBe("biz_a");
  });

  it("selects publishedContent only, never draftContent", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    hoisted.businesses = [{ id: "biz_a" }];
    hoisted.pages = [homePage("biz_a")];

    await getPublishedHomeSections();

    const select = hoisted.lastFindFirstArgs?.select as {
      sections: { select: Record<string, unknown> };
    };
    expect(select.sections.select).toHaveProperty("publishedContent", true);
    expect(select.sections.select).not.toHaveProperty("draftContent");
    // Belt-and-suspenders: draftContent must appear nowhere in the public select.
    expect(JSON.stringify(hoisted.lastFindFirstArgs?.select)).not.toContain(
      "draftContent",
    );
  });

  it("returns null when the WEBSITE module is disabled for the resolved business", async () => {
    process.env.PUBLIC_BUSINESS_ID = "biz_a";
    hoisted.businesses = [{ id: "biz_a" }];
    hoisted.pages = [homePage("biz_a")];
    hoisted.moduleEnabled = false;

    const sections = await getPublishedHomeSections();

    expect(sections).toBeNull();
  });
});
