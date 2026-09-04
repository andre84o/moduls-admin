import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { chooseRestaurantTables } from "./table-assignment";
import { addMinutes, safeTimezone, zonedParts } from "./time";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";

export const RESTAURANT_CAPACITY_STATUSES = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
] as const;

export type RestaurantSlotWindowMode = "PUBLIC" | "ADMIN";

export type RestaurantSlotAllocation = {
  endAt: Date;
  tableIds: string[];
  settings: {
    timezone: string;
    slotIntervalMin: number;
    defaultDurationMin: number;
    turnaroundMin: number;
    minLeadTimeMin: number;
    bookingHorizonDays: number;
    maxPartySize: number;
    confirmationMode: "AUTO_CONFIRM" | "REQUEST";
    allowTableCombinations: boolean;
  };
};

/**
 * Canonical transactional validator/allocator for one Restaurant Booking slot.
 *
 * Used by public creation, admin creation, rescheduling and reactivation so
 * those flows cannot drift into separate definitions of "available".
 * Throws stable error codes which callers translate into user-facing messages.
 */
export async function allocateRestaurantBookingSlot(
  tx: Prisma.TransactionClient,
  input: {
    businessId: string;
    partySize: number;
    startAt: Date;
    excludeBookingId?: string | null;
    windowMode: RestaurantSlotWindowMode;
    now?: Date;
  },
): Promise<RestaurantSlotAllocation> {
  const stored = await tx.restaurantBookingSettings.findUnique({
    where: { businessId: input.businessId },
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

  if (!Number.isInteger(input.partySize) || input.partySize < 1) {
    throw new Error("INVALID_PARTY_SIZE");
  }
  if (input.partySize > settings.maxPartySize) {
    throw new Error("PARTY_TOO_LARGE");
  }

  const now = input.now ?? new Date();
  if (input.windowMode === "PUBLIC") {
    const earliest = addMinutes(now, settings.minLeadTimeMin);
    const latest = addMinutes(now, settings.bookingHorizonDays * 24 * 60);
    if (input.startAt < earliest || input.startAt > latest) {
      throw new Error("OUTSIDE_WINDOW");
    }
  } else if (input.startAt <= now) {
    // Admin may make last-minute/far-future bookings, but not create or
    // reactivate a reservation in the past.
    throw new Error("OUTSIDE_WINDOW");
  }

  const local = zonedParts(input.startAt, settings.timezone);
  const endAt = addMinutes(input.startAt, settings.defaultDurationMin);
  const period = await tx.restaurantServicePeriod.findFirst({
    where: {
      businessId: input.businessId,
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
    where: {
      businessId: input.businessId,
      startAt: { lt: endAt },
      endAt: { gt: input.startAt },
    },
    select: { id: true },
  });
  if (blocked) throw new Error("BLOCKED");

  const tables = await tx.restaurantTable.findMany({
    where: {
      businessId: input.businessId,
      active: true,
      OR: [
        { zoneId: null },
        { zone: { is: { active: true } } },
      ],
    },
    select: {
      id: true,
      minSeats: true,
      maxSeats: true,
      combinationGroup: true,
    },
  });
  if (tables.length === 0) throw new Error("NO_TABLES");

  const overlapping = await tx.booking.findMany({
    where: {
      businessId: input.businessId,
      ...(input.excludeBookingId
        ? { id: { not: input.excludeBookingId } }
        : {}),
      status: { in: [...RESTAURANT_CAPACITY_STATUSES] },
      startAt: { lt: addMinutes(endAt, settings.turnaroundMin) },
      endAt: { gt: addMinutes(input.startAt, -settings.turnaroundMin) },
    },
    select: { id: true },
  });

  const overlappingIds = overlapping.map((booking) => booking.id);
  const details = overlappingIds.length
    ? await tx.restaurantBookingDetail.findMany({
        where: {
          businessId: input.businessId,
          bookingId: { in: overlappingIds },
        },
        select: {
          bookingId: true,
          tables: {
            where: { businessId: input.businessId },
            select: { tableId: true },
          },
        },
      })
    : [];

  const activeTableIds = new Set(tables.map((table) => table.id));
  const occupied = new Set<string>();
  for (const detail of details) {
    if (detail.tables.length === 0) throw new Error("UNASSIGNED_CONFLICT");
    for (const link of detail.tables) {
      if (!activeTableIds.has(link.tableId)) {
        // Existing active booking points at a table which is no longer usable.
        // Fail closed until admin fixes that reservation instead of silently
        // selling the same capacity twice.
        throw new Error("INVALID_EXISTING_ASSIGNMENT");
      }
      occupied.add(link.tableId);
    }
  }

  const tableIds = chooseRestaurantTables({
    tables,
    occupied,
    partySize: input.partySize,
    allowCombinations: settings.allowTableCombinations,
  });
  if (!tableIds) throw new Error("NO_CAPACITY");

  return { endAt, tableIds, settings };
}

export function restaurantSlotErrorMessage(code: string): string | null {
  const messages: Record<string, string> = {
    INVALID_PARTY_SIZE: "Invalid party size.",
    PARTY_TOO_LARGE: "Party size is too large.",
    OUTSIDE_WINDOW: "That time cannot be booked.",
    INVALID_SLOT: "That time is not a valid booking slot.",
    BLOCKED: "The restaurant is unavailable at that time.",
    NO_TABLES: "No tables are available.",
    UNASSIGNED_CONFLICT: "That time is no longer available.",
    INVALID_EXISTING_ASSIGNMENT: "That time has a table conflict that must be fixed by an administrator.",
    NO_CAPACITY: "That time is no longer available.",
  };
  return messages[code] ?? null;
}
