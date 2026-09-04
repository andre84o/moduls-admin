import "server-only";

import { getPrisma } from "@/lib/prisma";
import { requireRestaurantBooking } from "./guards";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";

export async function getRestaurantBookingSettings() {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return DEFAULT_RESTAURANT_BOOKING_SETTINGS;

  const row = await getPrisma().restaurantBookingSettings.findUnique({
    where: { businessId: access.businessId },
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

  return row ?? DEFAULT_RESTAURANT_BOOKING_SETTINGS;
}

export async function getRestaurantServicePeriods() {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return [];

  return getPrisma().restaurantServicePeriod.findMany({
    where: { businessId: access.businessId },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    select: { id: true, weekday: true, startMinute: true, endMinute: true },
  });
}

export async function getRestaurantBlockedPeriods() {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return [];

  return getPrisma().restaurantBlockedPeriod.findMany({
    where: { businessId: access.businessId },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, endAt: true, reason: true },
  });
}

export async function getRestaurantZonesWithTables() {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return [];

  return getPrisma().restaurantZone.findMany({
    where: { businessId: access.businessId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      sortOrder: true,
      tables: {
        where: { businessId: access.businessId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          minSeats: true,
          maxSeats: true,
          combinationGroup: true,
          active: true,
          sortOrder: true,
        },
      },
    },
  });
}

export async function getUnzonedRestaurantTables() {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return [];

  return getPrisma().restaurantTable.findMany({
    where: { businessId: access.businessId, zoneId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      minSeats: true,
      maxSeats: true,
      combinationGroup: true,
      active: true,
      sortOrder: true,
    },
  });
}

export async function getRestaurantBookings() {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return [];

  const prisma = getPrisma();
  const details = await prisma.restaurantBookingDetail.findMany({
    where: { businessId: access.businessId },
    select: {
      id: true,
      bookingId: true,
      guestPhone: true,
      partySize: true,
      tables: {
        where: { businessId: access.businessId },
        select: {
          table: {
            select: {
              id: true,
              businessId: true,
              name: true,
              minSeats: true,
              maxSeats: true,
              zone: { select: { id: true, businessId: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (details.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: access.businessId,
      id: { in: details.map((detail) => detail.bookingId) },
    },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      guestName: true,
      guestEmail: true,
      startAt: true,
      endAt: true,
      status: true,
      notes: true,
    },
  });

  const guestActivityLogs = await prisma.auditLog.findMany({
    where: {
      businessId: access.businessId,
      entityType: "Booking",
      entityId: { in: bookings.map((booking) => booking.id) },
      action: {
        in: [
          "restaurant_booking.guest_cancelled",
          "restaurant_booking.guest_rescheduled",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, action: true, createdAt: true },
  });

  const guestActivityByBooking = new Map<
    string,
    { type: "CANCELLED" | "RESCHEDULED"; at: string }
  >();
  for (const log of guestActivityLogs) {
    if (!log.entityId || guestActivityByBooking.has(log.entityId)) continue;
    guestActivityByBooking.set(log.entityId, {
      type:
        log.action === "restaurant_booking.guest_cancelled"
          ? "CANCELLED"
          : "RESCHEDULED",
      at: log.createdAt.toISOString(),
    });
  }

  const detailByBooking = new Map(details.map((detail) => [detail.bookingId, detail]));
  return bookings.map((booking) => {
    const detail = detailByBooking.get(booking.id)!;
    return {
      ...booking,
      guestPhone: detail.guestPhone,
      partySize: detail.partySize,
      guestActivity: guestActivityByBooking.get(booking.id) ?? null,
      tables: detail.tables
        .filter(
          (link) =>
            link.table.businessId === access.businessId &&
            (!link.table.zone || link.table.zone.businessId === access.businessId),
        )
        .map((link) => ({
          id: link.table.id,
          name: link.table.name,
          minSeats: link.table.minSeats,
          maxSeats: link.table.maxSeats,
          zone: link.table.zone
            ? { id: link.table.zone.id, name: link.table.zone.name }
            : null,
        })),
    };
  });
}
