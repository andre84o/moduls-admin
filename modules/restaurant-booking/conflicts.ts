import "server-only";

import { getPrisma } from "@/lib/prisma";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";
import { safeTimezone, zonedParts } from "./time";

const ACTIVE_STATUSES = ["PENDING", "PAYMENT_PENDING", "CONFIRMED"] as const;

type FutureRestaurantBooking = {
  id: string;
  guestName: string;
  startAt: Date;
  endAt: Date;
  partySize: number;
  tableIds: string[];
};

async function getFutureActiveRestaurantBookings(
  businessId: string,
  now = new Date(),
): Promise<FutureRestaurantBooking[]> {
  const prisma = getPrisma();
  const details = await prisma.restaurantBookingDetail.findMany({
    where: { businessId },
    select: {
      bookingId: true,
      partySize: true,
      tables: {
        where: { businessId },
        select: { tableId: true },
      },
    },
  });
  if (details.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      id: { in: details.map((detail) => detail.bookingId) },
      status: { in: [...ACTIVE_STATUSES] },
      endAt: { gt: now },
    },
    select: {
      id: true,
      guestName: true,
      startAt: true,
      endAt: true,
    },
  });

  const detailByBooking = new Map(details.map((detail) => [detail.bookingId, detail]));
  return bookings.map((booking) => {
    const detail = detailByBooking.get(booking.id)!;
    return {
      ...booking,
      partySize: detail.partySize,
      tableIds: detail.tables.map((link) => link.tableId),
    };
  });
}

function bookingLabel(booking: FutureRestaurantBooking) {
  return `${booking.guestName} (${booking.startAt.toISOString()})`;
}

export async function findAnyFutureRestaurantBookingConflict(businessId: string) {
  const [booking] = await getFutureActiveRestaurantBookings(businessId);
  return booking ?? null;
}

export async function findFutureZoneConflict(input: {
  businessId: string;
  zoneId: string;
}) {
  const tables = await getPrisma().restaurantTable.findMany({
    where: { businessId: input.businessId, zoneId: input.zoneId },
    select: { id: true },
  });
  if (tables.length === 0) return null;
  const tableIds = new Set(tables.map((table) => table.id));
  const bookings = await getFutureActiveRestaurantBookings(input.businessId);
  return bookings.find((booking) => booking.tableIds.some((tableId) => tableIds.has(tableId))) ?? null;
}

export async function findFutureTableConflict(input: {
  businessId: string;
  tableId: string;
}) {
  const bookings = await getFutureActiveRestaurantBookings(input.businessId);
  return bookings.find((booking) => booking.tableIds.includes(input.tableId)) ?? null;
}

export async function findServicePeriodDeletionConflict(input: {
  businessId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}) {
  const settings = await getPrisma().restaurantBookingSettings.findUnique({
    where: { businessId: input.businessId },
    select: { timezone: true },
  });
  const timezone = safeTimezone(settings?.timezone ?? DEFAULT_RESTAURANT_BOOKING_SETTINGS.timezone);
  const bookings = await getFutureActiveRestaurantBookings(input.businessId);
  return (
    bookings.find((booking) => {
      const local = zonedParts(booking.startAt, timezone);
      return (
        local.weekday === input.weekday &&
        local.minute >= input.startMinute &&
        local.minute < input.endMinute
      );
    }) ?? null
  );
}

export async function findBlockedRangeConflict(input: {
  businessId: string;
  startAt: Date;
  endAt: Date;
}) {
  const bookings = await getFutureActiveRestaurantBookings(input.businessId);
  return (
    bookings.find(
      (booking) => booking.startAt < input.endAt && booking.endAt > input.startAt,
    ) ?? null
  );
}

export function futureBookingConflictMessage(prefix: string, booking: FutureRestaurantBooking) {
  return `${prefix} It would affect the future active booking for ${bookingLabel(booking)}. Reschedule or cancel that booking first.`;
}
