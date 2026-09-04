import { describe, expect, it } from "vitest";
import { allocateRestaurantBookingSlot } from "@/modules/restaurant-booking/booking-slot";

const START = new Date("2026-09-10T17:00:00.000Z");
const NOW = new Date("2026-09-01T10:00:00.000Z");

type TableRow = {
  id: string;
  businessId: string;
  minSeats: number;
  maxSeats: number;
  combinationGroup: string | null;
  active: boolean;
  zoneActive: boolean;
};

type BookingRow = {
  id: string;
  businessId: string;
  status: string;
  startAt: Date;
  endAt: Date;
};

type DetailRow = {
  businessId: string;
  bookingId: string;
  tableIds: string[];
};

type BlockedRow = {
  businessId: string;
  startAt: Date;
  endAt: Date;
};

type Fixture = {
  businessId?: string;
  turnaroundMin?: number;
  tables?: TableRow[];
  bookings?: BookingRow[];
  details?: DetailRow[];
  blocked?: BlockedRow[];
};

function makeTx(fixture: Fixture = {}) {
  const businessId = fixture.businessId ?? "biz_a";
  const turnaroundMin = fixture.turnaroundMin ?? 0;
  const tables = fixture.tables ?? [
    {
      id: "table_a",
      businessId,
      minSeats: 1,
      maxSeats: 4,
      combinationGroup: null,
      active: true,
      zoneActive: true,
    },
  ];
  const bookings = fixture.bookings ?? [];
  const details = fixture.details ?? [];
  const blocked = fixture.blocked ?? [];
  const seenBusinessIds: string[] = [];

  const recordBusiness = (where: { businessId?: string }) => {
    if (where.businessId) seenBusinessIds.push(where.businessId);
  };

  const tx = {
    restaurantBookingSettings: {
      findUnique: async ({ where }: { where: { businessId: string } }) => {
        recordBusiness(where);
        return {
          timezone: "Europe/Stockholm",
          slotIntervalMin: 30,
          defaultDurationMin: 120,
          turnaroundMin,
          minLeadTimeMin: 60,
          bookingHorizonDays: 60,
          maxPartySize: 12,
          confirmationMode: "REQUEST",
          allowTableCombinations: true,
        };
      },
    },
    restaurantServicePeriod: {
      findFirst: async ({ where }: { where: { businessId: string } }) => {
        recordBusiness(where);
        return { startMinute: 17 * 60 };
      },
    },
    restaurantBlockedPeriod: {
      findFirst: async ({
        where,
      }: {
        where: {
          businessId: string;
          startAt: { lt: Date };
          endAt: { gt: Date };
        };
      }) => {
        recordBusiness(where);
        return (
          blocked.find(
            (row) =>
              row.businessId === where.businessId &&
              row.startAt < where.startAt.lt &&
              row.endAt > where.endAt.gt,
          ) ?? null
        );
      },
    },
    restaurantTable: {
      findMany: async ({ where }: { where: { businessId: string } }) => {
        recordBusiness(where);
        return tables
          .filter(
            (table) =>
              table.businessId === where.businessId &&
              table.active &&
              table.zoneActive,
          )
          .map(({ id, minSeats, maxSeats, combinationGroup }) => ({
            id,
            minSeats,
            maxSeats,
            combinationGroup,
          }));
      },
    },
    booking: {
      findMany: async ({
        where,
      }: {
        where: {
          businessId: string;
          id?: { not?: string };
          status: { in: string[] };
          startAt: { lt: Date };
          endAt: { gt: Date };
        };
      }) => {
        recordBusiness(where);
        return bookings
          .filter(
            (booking) =>
              booking.businessId === where.businessId &&
              booking.id !== where.id?.not &&
              where.status.in.includes(booking.status) &&
              booking.startAt < where.startAt.lt &&
              booking.endAt > where.endAt.gt,
          )
          .map(({ id }) => ({ id }));
      },
    },
    restaurantBookingDetail: {
      findMany: async ({
        where,
      }: {
        where: { businessId: string; bookingId: { in: string[] } };
      }) => {
        recordBusiness(where);
        return details
          .filter(
            (detail) =>
              detail.businessId === where.businessId &&
              where.bookingId.in.includes(detail.bookingId),
          )
          .map((detail) => ({
            bookingId: detail.bookingId,
            tables: detail.tableIds.map((tableId) => ({ tableId })),
          }));
      },
    },
  };

  return { tx, seenBusinessIds };
}

async function allocate(tx: unknown, businessId = "biz_a") {
  return allocateRestaurantBookingSlot(tx as never, {
    businessId,
    partySize: 2,
    startAt: START,
    windowMode: "ADMIN",
    now: NOW,
  });
}

describe("Restaurant Booking slot allocation with DB-shaped state", () => {
  it("rejects a fully booked slot", async () => {
    const { tx } = makeTx({
      bookings: [
        {
          id: "booking_1",
          businessId: "biz_a",
          status: "CONFIRMED",
          startAt: START,
          endAt: new Date("2026-09-10T19:00:00.000Z"),
        },
      ],
      details: [
        { businessId: "biz_a", bookingId: "booking_1", tableIds: ["table_a"] },
      ],
    });

    await expect(allocate(tx)).rejects.toThrow("NO_CAPACITY");
  });

  it("ignores CANCELLED bookings so cancellation frees capacity", async () => {
    const { tx } = makeTx({
      bookings: [
        {
          id: "booking_1",
          businessId: "biz_a",
          status: "CANCELLED",
          startAt: START,
          endAt: new Date("2026-09-10T19:00:00.000Z"),
        },
      ],
      details: [
        { businessId: "biz_a", bookingId: "booking_1", tableIds: ["table_a"] },
      ],
    });

    await expect(allocate(tx)).resolves.toMatchObject({ tableIds: ["table_a"] });
  });

  it("rejects slots inside a blocked period", async () => {
    const { tx } = makeTx({
      blocked: [
        {
          businessId: "biz_a",
          startAt: new Date("2026-09-10T16:30:00.000Z"),
          endAt: new Date("2026-09-10T17:30:00.000Z"),
        },
      ],
    });

    await expect(allocate(tx)).rejects.toThrow("BLOCKED");
  });

  it("applies turnaround to adjacent bookings", async () => {
    const { tx } = makeTx({
      turnaroundMin: 15,
      bookings: [
        {
          id: "booking_after",
          businessId: "biz_a",
          status: "CONFIRMED",
          startAt: new Date("2026-09-10T19:10:00.000Z"),
          endAt: new Date("2026-09-10T20:10:00.000Z"),
        },
      ],
      details: [
        { businessId: "biz_a", bookingId: "booking_after", tableIds: ["table_a"] },
      ],
    });

    await expect(allocate(tx)).rejects.toThrow("NO_CAPACITY");
  });

  it("keeps another tenant's bookings and tables out of the allocation", async () => {
    const { tx, seenBusinessIds } = makeTx({
      tables: [
        {
          id: "table_a",
          businessId: "biz_a",
          minSeats: 1,
          maxSeats: 4,
          combinationGroup: null,
          active: true,
          zoneActive: true,
        },
        {
          id: "table_b",
          businessId: "biz_b",
          minSeats: 1,
          maxSeats: 4,
          combinationGroup: null,
          active: true,
          zoneActive: true,
        },
      ],
      bookings: [
        {
          id: "booking_b",
          businessId: "biz_b",
          status: "CONFIRMED",
          startAt: START,
          endAt: new Date("2026-09-10T19:00:00.000Z"),
        },
      ],
      details: [
        { businessId: "biz_b", bookingId: "booking_b", tableIds: ["table_b"] },
      ],
    });

    const result = await allocate(tx, "biz_a");

    expect(result.tableIds).toEqual(["table_a"]);
    expect(seenBusinessIds.length).toBeGreaterThan(0);
    expect(seenBusinessIds.every((id) => id === "biz_a")).toBe(true);
  });
});
