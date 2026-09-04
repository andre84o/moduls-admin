import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  class KnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    KnownRequestError,
    businessId: "biz_a" as string | null,
    enabled: true,
    confirmationMode: "REQUEST" as "REQUEST" | "AUTO_CONFIRM",
    outcomes: [] as Array<"P2034" | "SUCCESS">,
    transactionCalls: 0,
    auditCalls: 0,
    notificationCalls: 0,
    bookingCreateCalls: 0,
    tableCreateCalls: 0,
  };
});

vi.mock("@/app/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: hoisted.KnownRequestError,
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));

vi.mock("@/lib/public-tenant", () => ({
  resolvePublicBusinessId: async () => hoisted.businessId,
}));

vi.mock("@/modules/restaurant-booking/guards", () => ({
  isRestaurantBookingEnabledForBusiness: async () => hoisted.enabled,
}));

vi.mock("@/modules/restaurant-booking/availability", () => ({
  getRestaurantAvailabilityForBusiness: vi.fn(),
}));

vi.mock("@/modules/restaurant-booking/booking-slot", () => ({
  allocateRestaurantBookingSlot: async () => ({
    endAt: new Date("2026-09-10T18:00:00.000Z"),
    tableIds: ["table_1"],
    settings: { confirmationMode: hoisted.confirmationMode },
  }),
  restaurantSlotErrorMessage: () => null,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: async () => {
    hoisted.auditCalls += 1;
  },
}));

vi.mock("@/modules/restaurant-booking/notifications", () => ({
  notifyRestaurantBookingEvent: async () => {
    hoisted.notificationCalls += 1;
  },
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      hoisted.transactionCalls += 1;
      const outcome = hoisted.outcomes.shift() ?? "SUCCESS";
      if (outcome === "P2034") {
        throw new hoisted.KnownRequestError("serialization conflict", "P2034");
      }

      const tx = {
        booking: {
          create: async () => {
            hoisted.bookingCreateCalls += 1;
            return { id: "booking_1" };
          },
        },
        restaurantBookingDetail: {
          create: async () => ({ id: "detail_1" }),
        },
        bookingTable: {
          createMany: async () => {
            hoisted.tableCreateCalls += 1;
            return { count: 1 };
          },
        },
      };
      return callback(tx);
    },
  }),
}));

import { createPublicRestaurantBooking } from "@/modules/restaurant-booking/public";

const input = {
  guestName: "Alex",
  guestEmail: "alex@example.com",
  guestPhone: "+46700000000",
  partySize: 2,
  startAt: "2026-09-10T17:00:00.000Z",
};

beforeEach(() => {
  hoisted.businessId = "biz_a";
  hoisted.enabled = true;
  hoisted.confirmationMode = "REQUEST";
  hoisted.outcomes = [];
  hoisted.transactionCalls = 0;
  hoisted.auditCalls = 0;
  hoisted.notificationCalls = 0;
  hoisted.bookingCreateCalls = 0;
  hoisted.tableCreateCalls = 0;
});

describe("public Restaurant Booking transaction", () => {
  it("retries serialization conflicts and succeeds on the third attempt", async () => {
    hoisted.outcomes = ["P2034", "P2034", "SUCCESS"];

    const result = await createPublicRestaurantBooking(input);

    expect(result).toEqual({ ok: true, bookingId: "booking_1", status: "PENDING" });
    expect(hoisted.transactionCalls).toBe(3);
    expect(hoisted.bookingCreateCalls).toBe(1);
    expect(hoisted.tableCreateCalls).toBe(1);
    expect(hoisted.auditCalls).toBe(1);
    expect(hoisted.notificationCalls).toBe(1);
  });

  it("stops after three serialization conflicts without writing audit or notifications", async () => {
    hoisted.outcomes = ["P2034", "P2034", "P2034"];

    const result = await createPublicRestaurantBooking(input);

    expect(result).toEqual({
      ok: false,
      error: "Could not create the booking. Please try another time.",
    });
    expect(hoisted.transactionCalls).toBe(3);
    expect(hoisted.bookingCreateCalls).toBe(0);
    expect(hoisted.auditCalls).toBe(0);
    expect(hoisted.notificationCalls).toBe(0);
  });

  it("uses AUTO_CONFIRM only after the transaction succeeds", async () => {
    hoisted.confirmationMode = "AUTO_CONFIRM";

    const result = await createPublicRestaurantBooking(input);

    expect(result).toEqual({ ok: true, bookingId: "booking_1", status: "CONFIRMED" });
    expect(hoisted.transactionCalls).toBe(1);
    expect(hoisted.notificationCalls).toBe(1);
  });

  it("does not touch the database when the feature is disabled", async () => {
    hoisted.enabled = false;

    const result = await createPublicRestaurantBooking(input);

    expect(result).toEqual({ ok: false, error: "Restaurant booking is not available." });
    expect(hoisted.transactionCalls).toBe(0);
  });

  it("does not touch the database when no public tenant can be resolved", async () => {
    hoisted.businessId = null;

    const result = await createPublicRestaurantBooking(input);

    expect(result).toEqual({ ok: false, error: "Restaurant booking is not available." });
    expect(hoisted.transactionCalls).toBe(0);
  });
});
