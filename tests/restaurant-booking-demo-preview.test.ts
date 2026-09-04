import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  user: { id: "user_1", isDemo: false } as { id: string; isDemo: boolean } | null,
  globalSuperAdmin: true,
  demoMode: false,
  business: { id: "biz_demo", name: "Demo-projekt", slug: "demo" } as {
    id: string;
    name: string;
    slug: string;
  } | null,
  findUniqueCalls: 0,
}));

vi.mock("@/lib/config", () => ({
  isDemoMode: () => hoisted.demoMode,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => hoisted.user,
  isGlobalSuperAdmin: async () => hoisted.globalSuperAdmin,
  requireSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/feature-access", () => ({
  RESTAURANT_BOOKING_FEATURE_KEY: "RESTAURANT_BOOKING",
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    business: {
      findUnique: async () => {
        hoisted.findUniqueCalls += 1;
        return hoisted.business;
      },
    },
  }),
}));

import { resolveRestaurantBookingPreviewBusiness } from "@/modules/restaurant-booking/demo-preview";

beforeEach(() => {
  hoisted.user = { id: "user_1", isDemo: false };
  hoisted.globalSuperAdmin = true;
  hoisted.demoMode = false;
  hoisted.business = { id: "biz_demo", name: "Demo-projekt", slug: "demo" };
  hoisted.findUniqueCalls = 0;
});

describe("Restaurant Booking preview tenant resolver", () => {
  it("resolves only the fixed Demo-projekt slug for a platform super admin", async () => {
    await expect(resolveRestaurantBookingPreviewBusiness("demo")).resolves.toEqual({
      id: "biz_demo",
      name: "Demo-projekt",
      slug: "demo",
    });
    expect(hoisted.findUniqueCalls).toBe(1);
  });

  it("does not allow the browser to select another business", async () => {
    await expect(resolveRestaurantBookingPreviewBusiness("customer-a")).resolves.toBeNull();
    expect(hoisted.findUniqueCalls).toBe(0);
  });

  it("rejects unauthenticated users", async () => {
    hoisted.user = null;
    await expect(resolveRestaurantBookingPreviewBusiness("demo")).resolves.toBeNull();
    expect(hoisted.findUniqueCalls).toBe(0);
  });

  it("rejects authenticated users who are not platform super admins", async () => {
    hoisted.globalSuperAdmin = false;
    await expect(resolveRestaurantBookingPreviewBusiness("demo")).resolves.toBeNull();
    expect(hoisted.findUniqueCalls).toBe(0);
  });

  it("does not expose the real preview flow in no-database demo mode", async () => {
    hoisted.demoMode = true;
    await expect(resolveRestaurantBookingPreviewBusiness("demo")).resolves.toBeNull();
    expect(hoisted.findUniqueCalls).toBe(0);
  });
});
