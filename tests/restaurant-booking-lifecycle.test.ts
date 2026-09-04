import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  access: { businessId: "biz_a", userId: "user_a", isDemo: false },
  bookingStatus: "CONFIRMED",
  bookingStartAt: new Date("2026-09-10T17:00:00.000Z"),
  allocationError: null as string | null,
  allocationTableIds: ["table_new"],
  allocationEndAt: new Date("2026-09-10T19:00:00.000Z"),
  updateManyCalls: [] as unknown[],
  deleteManyCalls: [] as unknown[],
  createManyCalls: [] as unknown[],
  allocationInputs: [] as unknown[],
  auditCalls: [] as unknown[],
  notificationCalls: [] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code = "";
    },
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));
vi.mock("@/modules/restaurant-booking/guards", () => ({
  requireRestaurantBooking: async () => hoisted.access,
}));
vi.mock("@/modules/restaurant-booking/booking-slot", () => ({
  RESTAURANT_CAPACITY_STATUSES: ["PENDING", "PAYMENT_PENDING", "CONFIRMED"],
  allocateRestaurantBookingSlot: async (_tx: unknown, input: unknown) => {
    hoisted.allocationInputs.push(input);
    if (hoisted.allocationError) throw new Error(hoisted.allocationError);
    return {
      tableIds: hoisted.allocationTableIds,
      endAt: hoisted.allocationEndAt,
      settings: { confirmationMode: "REQUEST" },
    };
  },
  restaurantSlotErrorMessage: (code: string) =>
    ({
      NO_CAPACITY: "That time is no longer available.",
      BLOCKED: "The restaurant is unavailable at that time.",
    })[code] ?? null,
}));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: async (input: unknown) => {
    hoisted.auditCalls.push(input);
  },
}));
vi.mock("@/modules/restaurant-booking/notifications", () => ({
  notifyRestaurantBookingEvent: async (input: unknown) => {
    hoisted.notificationCalls.push(input);
  },
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        restaurantBookingDetail: {
          findFirst: async ({ where }: { where: { businessId: string; bookingId: string } }) =>
            where.businessId === "biz_a" && where.bookingId === "booking_1"
              ? { id: "detail_1", partySize: 2 }
              : null,
        },
        booking: {
          findFirst: async ({ where }: { where: { businessId: string; id: string } }) =>
            where.businessId === "biz_a" && where.id === "booking_1"
              ? { status: hoisted.bookingStatus, startAt: hoisted.bookingStartAt }
              : null,
          updateMany: async (args: unknown) => {
            hoisted.updateManyCalls.push(args);
            return { count: 1 };
          },
        },
        bookingTable: {
          deleteMany: async (args: unknown) => {
            hoisted.deleteManyCalls.push(args);
            return { count: 1 };
          },
          createMany: async (args: unknown) => {
            hoisted.createManyCalls.push(args);
            return { count: 1 };
          },
        },
      };
      return callback(tx);
    },
  }),
}));

import {
  rescheduleRestaurantBooking,
  setManagedRestaurantBookingStatus,
} from "@/modules/restaurant-booking/lifecycle-actions";

beforeEach(() => {
  hoisted.bookingStatus = "CONFIRMED";
  hoisted.bookingStartAt = new Date("2026-09-10T17:00:00.000Z");
  hoisted.allocationError = null;
  hoisted.allocationTableIds = ["table_new"];
  hoisted.allocationEndAt = new Date("2026-09-10T19:00:00.000Z");
  hoisted.updateManyCalls = [];
  hoisted.deleteManyCalls = [];
  hoisted.createManyCalls = [];
  hoisted.allocationInputs = [];
  hoisted.auditCalls = [];
  hoisted.notificationCalls = [];
});

describe("Restaurant Booking lifecycle", () => {
  it("blocks rescheduling when the destination has no capacity", async () => {
    hoisted.allocationError = "NO_CAPACITY";

    const result = await rescheduleRestaurantBooking({
      bookingId: "booking_1",
      startAt: "2026-09-11T17:00:00.000Z",
    });

    expect(result).toEqual({ error: "That time is no longer available." });
    expect(hoisted.updateManyCalls).toHaveLength(0);
    expect(hoisted.deleteManyCalls).toHaveLength(0);
    expect(hoisted.createManyCalls).toHaveLength(0);
    expect(hoisted.auditCalls).toHaveLength(0);
    expect(hoisted.notificationCalls).toHaveLength(0);
  });

  it("reschedules atomically and reallocates tables", async () => {
    const result = await rescheduleRestaurantBooking({
      bookingId: "booking_1",
      startAt: "2026-09-11T17:00:00.000Z",
    });

    expect(result).toEqual({});
    expect(hoisted.allocationInputs).toHaveLength(1);
    expect(hoisted.allocationInputs[0]).toMatchObject({
      businessId: "biz_a",
      partySize: 2,
      excludeBookingId: "booking_1",
      windowMode: "ADMIN",
    });
    expect(hoisted.updateManyCalls).toHaveLength(1);
    expect(hoisted.deleteManyCalls).toHaveLength(1);
    expect(hoisted.createManyCalls).toHaveLength(1);
    expect(hoisted.createManyCalls[0]).toEqual({
      data: [
        {
          businessId: "biz_a",
          restaurantBookingId: "detail_1",
          tableId: "table_new",
        },
      ],
    });
    expect(hoisted.notificationCalls).toEqual([
      { businessId: "biz_a", bookingId: "booking_1", event: "RESCHEDULED" },
    ]);
  });

  it("cancels without reallocating and emits CANCELLED", async () => {
    const result = await setManagedRestaurantBookingStatus("booking_1", "CANCELLED");

    expect(result).toEqual({});
    expect(hoisted.allocationInputs).toHaveLength(0);
    expect(hoisted.deleteManyCalls).toHaveLength(0);
    expect(hoisted.createManyCalls).toHaveLength(0);
    expect(hoisted.updateManyCalls).toEqual([
      {
        where: { businessId: "biz_a", id: "booking_1" },
        data: { status: "CANCELLED" },
      },
    ]);
    expect(hoisted.notificationCalls).toEqual([
      { businessId: "biz_a", bookingId: "booking_1", event: "CANCELLED" },
    ]);
  });

  it("rechecks capacity before reactivation and leaves the booking untouched on conflict", async () => {
    hoisted.bookingStatus = "CANCELLED";
    hoisted.allocationError = "NO_CAPACITY";

    const result = await setManagedRestaurantBookingStatus("booking_1", "PENDING");

    expect(result).toEqual({ error: "That time is no longer available." });
    expect(hoisted.allocationInputs).toHaveLength(1);
    expect(hoisted.updateManyCalls).toHaveLength(0);
    expect(hoisted.deleteManyCalls).toHaveLength(0);
    expect(hoisted.createManyCalls).toHaveLength(0);
    expect(hoisted.auditCalls).toHaveLength(0);
    expect(hoisted.notificationCalls).toHaveLength(0);
  });

  it("reactivates only after successful capacity allocation", async () => {
    hoisted.bookingStatus = "CANCELLED";

    const result = await setManagedRestaurantBookingStatus("booking_1", "PENDING");

    expect(result).toEqual({});
    expect(hoisted.allocationInputs).toHaveLength(1);
    expect(hoisted.deleteManyCalls).toHaveLength(1);
    expect(hoisted.createManyCalls).toHaveLength(1);
    expect(hoisted.updateManyCalls).toEqual([
      {
        where: { businessId: "biz_a", id: "booking_1" },
        data: { status: "PENDING" },
      },
    ]);
    expect(hoisted.notificationCalls).toEqual([
      { businessId: "biz_a", bookingId: "booking_1", event: "REACTIVATED" },
    ]);
  });

  it("never finds or updates another tenant's booking", async () => {
    const result = await rescheduleRestaurantBooking({
      bookingId: "booking_from_biz_b",
      startAt: "2026-09-11T17:00:00.000Z",
    });

    expect(result).toEqual({ error: "Restaurant booking not found." });
    expect(hoisted.allocationInputs).toHaveLength(0);
    expect(hoisted.updateManyCalls).toHaveLength(0);
  });
});
