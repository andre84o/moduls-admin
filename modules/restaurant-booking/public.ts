import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { isRestaurantBookingEnabledForBusiness } from "./guards";
import { getRestaurantAvailabilityForBusiness } from "./availability";
import { resolvePublicBusinessId } from "@/lib/public-tenant";
import { chooseRestaurantTables } from "./table-assignment";
import { addMinutes, safeTimezone, zonedParts } from "./time";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";

const ACTIVE_STATUSES = ["PENDING", "PAYMENT_PENDING", "CONFIRMED"] as const;

function cleanText(value: string | null | undefined, max: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, max) : null;
}

export async function getPublicRestaurantAvailability(input: {
  date: string;
  partySize: number;
}) {
  const businessId = await resolvePublicBusinessId();
  if (!businessId) return null;
  return getRestaurantAvailabilityForBusiness({ businessId, ...input });
}

export async function createPublicRestaurantBooking(input: {
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  partySize: number;
  startAt: string;
  notes?: string | null;
}): Promise<
  | { ok: true; bookingId: string; status: "PENDING" | "CONFIRMED" }
  | { ok: false; error: string }
> {
  const businessId = await resolvePublicBusinessId();
  if (!businessId || !(await isRestaurantBookingEnabledForBusiness(businessId))) {
    return { ok: false, error: "Restaurant booking is not available." };
  }

  const guestName = input.guestName.trim();
  if (!guestName || guestName.length > 120) return { ok: false, error: "Guest name is required." };
  if (!Number.isInteger(input.partySize) || input.partySize < 1) return { ok: false, error: "Invalid party size." };

  const requestedStart = new Date(input.startAt);
  if (Number.isNaN(requestedStart.getTime())) return { ok: false, error: "Invalid booking time." };

  const prisma = getPrisma();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const stored = await tx.restaurantBookingSettings.findUnique({
          where: { businessId },
          select: {
            timezone: true,
            slotIntervalMin: true,
            defaultDurationMin: true,
            turnaroundMin: true,
            minLeadTimeMin: true,
            bookingHorizonDays: true,
            maxPartySize: true,
            confirmationMode: true,
            allowTableCombinations: true,
          },
        });
        const settings = stored
          ? { ...stored, timezone: safeTimezone(stored.timezone) }
          : DEFAULT_RESTAURANT_BOOKING_SETTINGS;

        if (input.partySize > settings.maxPartySize) throw new Error("PARTY_TOO_LARGE");

        const now = new Date();
        const earliest = addMinutes(now, settings.minLeadTimeMin);
        const latest = addMinutes(now, settings.bookingHorizonDays * 24 * 60);
        if (requestedStart < earliest || requestedStart > latest) throw new Error("OUTSIDE_WINDOW");

        const local = zonedParts(requestedStart, settings.timezone);
        const requestedEnd = addMinutes(requestedStart, settings.defaultDurationMin);
        const period = await tx.restaurantServicePeriod.findFirst({
          where: {
            businessId,
            weekday: local.weekday,
            startMinute: { lte: local.minute },
            endMinute: { gte: local.minute + settings.defaultDurationMin },
          },
          select: { startMinute: true },
        });
        if (!period || (local.minute - period.startMinute) % settings.slotIntervalMin !== 0) {
          throw new Error("INVALID_SLOT");
        }

        const blocked = await tx.restaurantBlockedPeriod.findFirst({
          where: { businessId, startAt: { lt: requestedEnd }, endAt: { gt: requestedStart } },
          select: { id: true },
        });
        if (blocked) throw new Error("BLOCKED");

        const tables = await tx.restaurantTable.findMany({
          where: { businessId, active: true },
          select: { id: true, minSeats: true, maxSeats: true, combinationGroup: true },
        });
        if (tables.length === 0) throw new Error("NO_TABLES");

        const details = await tx.restaurantBookingDetail.findMany({
          where: { businessId },
          select: {
            id: true,
            bookingId: true,
            tables: { where: { businessId }, select: { tableId: true } },
          },
        });
        const bookingIds = details.map((detail) => detail.bookingId);
        const overlapping = bookingIds.length
          ? await tx.booking.findMany({
              where: {
                businessId,
                id: { in: bookingIds },
                status: { in: [...ACTIVE_STATUSES] },
                startAt: { lt: addMinutes(requestedEnd, settings.turnaroundMin) },
                endAt: { gt: addMinutes(requestedStart, -settings.turnaroundMin) },
              },
              select: { id: true },
            })
          : [];

        const detailByBooking = new Map(details.map((detail) => [detail.bookingId, detail]));
        const occupied = new Set<string>();
        for (const booking of overlapping) {
          const detail = detailByBooking.get(booking.id);
          if (!detail || detail.tables.length === 0) throw new Error("UNASSIGNED_CONFLICT");
          for (const link of detail.tables) occupied.add(link.tableId);
        }

        const tableIds = chooseRestaurantTables({
          tables,
          occupied,
          partySize: input.partySize,
          allowCombinations: settings.allowTableCombinations,
        });
        if (!tableIds) throw new Error("NO_CAPACITY");

        const status = settings.confirmationMode === "AUTO_CONFIRM" ? "CONFIRMED" : "PENDING";
        const booking = await tx.booking.create({
          data: {
            businessId,
            guestName,
            guestEmail: cleanText(input.guestEmail, 200),
            startAt: requestedStart,
            endAt: requestedEnd,
            status,
            notes: cleanText(input.notes, 2000),
          },
          select: { id: true },
        });
        const detail = await tx.restaurantBookingDetail.create({
          data: {
            businessId,
            bookingId: booking.id,
            guestPhone: cleanText(input.guestPhone, 40),
            partySize: input.partySize,
          },
          select: { id: true },
        });
        await tx.bookingTable.createMany({
          data: tableIds.map((tableId) => ({
            businessId,
            restaurantBookingId: detail.id,
            tableId,
          })),
        });
        return { bookingId: booking.id, status } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await writeAuditLog({
        businessId,
        action: "restaurant_booking.public_created",
        entityType: "Booking",
        entityId: created.bookingId,
        metadata: { partySize: input.partySize, status: created.status },
      });
      return { ok: true, ...created };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) {
        continue;
      }
      const code = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        PARTY_TOO_LARGE: "Party size is too large.",
        OUTSIDE_WINDOW: "That time cannot be booked.",
        INVALID_SLOT: "That time is not a valid booking slot.",
        BLOCKED: "The restaurant is unavailable at that time.",
        NO_TABLES: "No tables are available.",
        UNASSIGNED_CONFLICT: "That time is no longer available.",
        NO_CAPACITY: "That time is no longer available.",
      };
      if (messages[code]) return { ok: false, error: messages[code] };
      return { ok: false, error: "Could not create the booking. Please try another time." };
    }
  }
  return { ok: false, error: "Could not create the booking. Please try again." };
}
