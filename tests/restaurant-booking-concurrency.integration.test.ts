import { config } from "dotenv";
import { describe, expect, it } from "vitest";

const TEST_PREFIX = "__RB_CONCURRENCY_TEST__";
const runAgainstDatabase = process.env.npm_lifecycle_event === "test:restaurant-concurrency";
const integrationDescribe = runAgainstDatabase ? describe : describe.skip;

function dateKey(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

integrationDescribe("Restaurant Booking real-DB concurrency", () => {
  it("allows only one booking to win when two requests race for the last table capacity", async () => {
    config({ path: ".env.local", quiet: true });
    config({ path: ".env", quiet: true });

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for the Restaurant Booking concurrency test.");
    }

    const [
      { getPrisma },
      { Prisma },
      { chooseRestaurantTables },
      { allocateRestaurantBookingSlot },
      { getRestaurantAvailabilityForBusiness },
    ] = await Promise.all([
      import("@/lib/prisma"),
      import("@/app/generated/prisma/client"),
      import("@/modules/restaurant-booking/table-assignment"),
      import("@/modules/restaurant-booking/booking-slot"),
      import("@/modules/restaurant-booking/availability"),
    ]);

    const prisma = getPrisma();
    const business = await prisma.business.findUnique({
      where: { slug: "demo" },
      select: { id: true, name: true },
    });
    if (!business) throw new Error("Demo-projekt (slug: demo) was not found.");

    async function cleanup() {
      const stale = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          guestName: { startsWith: TEST_PREFIX },
        },
        select: { id: true },
      });
      const bookingIds = stale.map((row) => row.id);
      if (bookingIds.length === 0) return;

      await prisma.$transaction(async (tx) => {
        await tx.restaurantBookingDetail.deleteMany({
          where: { businessId: business.id, bookingId: { in: bookingIds } },
        });
        await tx.booking.deleteMany({
          where: { businessId: business.id, id: { in: bookingIds } },
        });
      });
    }

    await cleanup();

    try {
      const settings = await prisma.restaurantBookingSettings.findUnique({
        where: { businessId: business.id },
        select: {
          timezone: true,
          bookingHorizonDays: true,
          maxPartySize: true,
          allowTableCombinations: true,
        },
      });
      if (!settings) throw new Error("Restaurant Booking settings are missing for Demo-projekt.");

      const tables = await prisma.restaurantTable.findMany({
        where: {
          businessId: business.id,
          active: true,
          OR: [{ zoneId: null }, { zone: { is: { active: true } } }],
        },
        select: {
          id: true,
          minSeats: true,
          maxSeats: true,
          combinationGroup: true,
        },
      });
      if (tables.length === 0) throw new Error("Demo-projekt has no active restaurant tables.");

      let partySize: number | null = null;
      let expectedTableIds: string[] | null = null;
      for (let size = settings.maxPartySize; size >= 1; size -= 1) {
        const firstAllocation = chooseRestaurantTables({
          tables,
          occupied: new Set(),
          partySize: size,
          allowCombinations: settings.allowTableCombinations,
        });
        if (!firstAllocation) continue;

        const secondAllocation = chooseRestaurantTables({
          tables,
          occupied: new Set(firstAllocation),
          partySize: size,
          allowCombinations: settings.allowTableCombinations,
        });
        if (!secondAllocation) {
          partySize = size;
          expectedTableIds = firstAllocation;
          break;
        }
      }

      if (!partySize || !expectedTableIds) {
        throw new Error(
          "Demo-projekt has no party size that consumes the last available table capacity; concurrency test cannot create a deterministic race.",
        );
      }

      const now = new Date();
      let targetStartAt: Date | null = null;
      for (let day = 1; day <= settings.bookingHorizonDays; day += 1) {
        const candidateDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
        const availability = await getRestaurantAvailabilityForBusiness({
          businessId: business.id,
          date: dateKey(candidateDate, settings.timezone),
          partySize,
          now,
        });
        const slot = availability.slots.find((item) => item.available);
        if (slot) {
          targetStartAt = new Date(slot.startAt);
          break;
        }
      }

      if (!targetStartAt) {
        throw new Error("No available Demo-projekt slot was found inside the booking horizon.");
      }

      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      async function createContendingBooking(label: string) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return await prisma.$transaction(
              async (tx) => {
                const allocation = await allocateRestaurantBookingSlot(tx, {
                  businessId: business.id,
                  partySize,
                  startAt: targetStartAt!,
                  windowMode: "PUBLIC",
                  now,
                });

                expect(new Set(allocation.tableIds)).toEqual(new Set(expectedTableIds!));

                const booking = await tx.booking.create({
                  data: {
                    businessId: business.id,
                    guestName: `${TEST_PREFIX}${runId}-${label}`,
                    guestEmail: null,
                    startAt: targetStartAt!,
                    endAt: allocation.endAt,
                    status: "PENDING",
                  },
                  select: { id: true },
                });
                const detail = await tx.restaurantBookingDetail.create({
                  data: {
                    businessId: business.id,
                    bookingId: booking.id,
                    guestPhone: null,
                    partySize,
                  },
                  select: { id: true },
                });
                await tx.bookingTable.createMany({
                  data: allocation.tableIds.map((tableId) => ({
                    businessId: business.id,
                    restaurantBookingId: detail.id,
                    tableId,
                  })),
                });
                return booking.id;
              },
              { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
            );
          } catch (error) {
            const code = error && typeof error === "object" && "code" in error
              ? String((error as { code?: unknown }).code ?? "")
              : "";
            if (code === "P2034" && attempt < 2) continue;
            throw error;
          }
        }
        throw new Error("Concurrency retry loop exhausted.");
      }

      const results = await Promise.allSettled([
        createContendingBooking("A"),
        createContendingBooking("B"),
      ]);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<string> => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const persisted = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          guestName: { startsWith: `${TEST_PREFIX}${runId}-` },
          status: { in: ["PENDING", "PAYMENT_PENDING", "CONFIRMED"] },
        },
        select: { id: true },
      });
      expect(persisted).toHaveLength(1);
    } finally {
      await cleanup();
    }
  }, 30_000);
});
