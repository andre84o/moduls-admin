"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getRestaurantAvailabilityForBusiness } from "./availability";
import {
  RESTAURANT_CAPACITY_STATUSES,
  allocateRestaurantBookingSlot,
  restaurantSlotErrorMessage,
} from "./booking-slot";
import { resolveRestaurantBookingManagementScope } from "./management-access";
import { notifyRestaurantBookingEvent } from "./notifications";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";
import { safeTimezone } from "./time";

const MANAGEMENT_LINK_GRACE_MS = 24 * 60 * 60 * 1000;

function isManagementLinkExpired(endAt: Date, now = new Date()) {
  return now.getTime() >= endAt.getTime() + MANAGEMENT_LINK_GRACE_MS;
}

function isActiveStatus(status: string) {
  return RESTAURANT_CAPACITY_STATUSES.includes(
    status as (typeof RESTAURANT_CAPACITY_STATUSES)[number],
  );
}

function managementError(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return "Booking changed concurrently. Please try again.";
  }
  const code = error instanceof Error ? error.message : "";
  const slotMessage = restaurantSlotErrorMessage(code);
  if (slotMessage) return slotMessage;
  const messages: Record<string, string> = {
    BOOKING_NOT_FOUND: "This booking link is no longer valid.",
    BOOKING_INACTIVE: "This booking can no longer be changed.",
    BOOKING_EXPIRED: "This booking link has expired.",
  };
  return messages[code] ?? fallback;
}

export async function getRestaurantBookingManagement(token: string) {
  const scope = await resolveRestaurantBookingManagementScope(token);
  if (!scope) {
    return { ok: false as const, error: "This booking link is invalid." };
  }

  const prisma = getPrisma();
  const access = await prisma.restaurantBookingManagementToken.findUnique({
    where: {
      businessId_tokenHash: {
        businessId: scope.businessId,
        tokenHash: scope.tokenHash,
      },
    },
    select: {
      restaurantBooking: {
        select: { bookingId: true, partySize: true },
      },
    },
  });
  if (!access) return { ok: false as const, error: "This booking link is invalid." };

  const detail = access.restaurantBooking;
  const [booking, settings] = await Promise.all([
    prisma.booking.findFirst({
      where: { id: detail.bookingId, businessId: scope.businessId },
      select: {
        guestName: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    }),
    prisma.restaurantBookingSettings.findUnique({
      where: { businessId: scope.businessId },
      select: { timezone: true },
    }),
  ]);

  if (!booking) {
    return { ok: false as const, error: "This booking link is invalid." };
  }
  if (isManagementLinkExpired(booking.endAt)) {
    return { ok: false as const, error: "This booking link has expired." };
  }

  return {
    ok: true as const,
    booking: {
      businessName: scope.businessName,
      guestName: booking.guestName,
      partySize: detail.partySize,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
      timezone: safeTimezone(
        settings?.timezone ?? DEFAULT_RESTAURANT_BOOKING_SETTINGS.timezone,
      ),
      canManage: isActiveStatus(booking.status),
    },
  };
}

export async function getRestaurantBookingManagementAvailability(input: {
  token: string;
  date: string;
}) {
  const scope = await resolveRestaurantBookingManagementScope(input.token);
  if (!scope) {
    return { ok: false as const, error: "This booking link is invalid." };
  }

  const prisma = getPrisma();
  const access = await prisma.restaurantBookingManagementToken.findUnique({
    where: {
      businessId_tokenHash: {
        businessId: scope.businessId,
        tokenHash: scope.tokenHash,
      },
    },
    select: {
      restaurantBooking: {
        select: { bookingId: true, partySize: true },
      },
    },
  });
  if (!access) return { ok: false as const, error: "This booking link is invalid." };

  const detail = access.restaurantBooking;
  const booking = await prisma.booking.findFirst({
    where: { id: detail.bookingId, businessId: scope.businessId },
    select: { status: true, endAt: true },
  });
  if (!booking) {
    return { ok: false as const, error: "This booking link is invalid." };
  }
  if (isManagementLinkExpired(booking.endAt)) {
    return { ok: false as const, error: "This booking link has expired." };
  }
  if (!isActiveStatus(booking.status)) {
    return { ok: false as const, error: "This booking can no longer be changed." };
  }

  const availability = await getRestaurantAvailabilityForBusiness({
    businessId: scope.businessId,
    date: input.date,
    partySize: detail.partySize,
    excludeBookingId: detail.bookingId,
  });
  return { ok: true as const, availability };
}

export async function cancelRestaurantBookingByToken(token: string) {
  const scope = await resolveRestaurantBookingManagementScope(token);
  if (!scope) {
    return { ok: false as const, error: "This booking link is invalid." };
  }

  const prisma = getPrisma();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const access = await tx.restaurantBookingManagementToken.findUnique({
          where: {
            businessId_tokenHash: {
              businessId: scope.businessId,
              tokenHash: scope.tokenHash,
            },
          },
          select: {
            restaurantBooking: {
              select: { bookingId: true },
            },
          },
        });
        if (!access) throw new Error("BOOKING_NOT_FOUND");

        const detail = access.restaurantBooking;
        const booking = await tx.booking.findFirst({
          where: { id: detail.bookingId, businessId: scope.businessId },
          select: { status: true, endAt: true },
        });
        if (!booking) throw new Error("BOOKING_NOT_FOUND");
        if (isManagementLinkExpired(booking.endAt)) throw new Error("BOOKING_EXPIRED");
        if (booking.status === "CANCELLED") {
          return {
            businessId: scope.businessId,
            bookingId: detail.bookingId,
            changed: false,
          };
        }
        if (!isActiveStatus(booking.status)) throw new Error("BOOKING_INACTIVE");

        await tx.booking.updateMany({
          where: { id: detail.bookingId, businessId: scope.businessId },
          data: { status: "CANCELLED" },
        });
        return {
          businessId: scope.businessId,
          bookingId: detail.bookingId,
          changed: true,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.changed) {
      await writeAuditLog({
        businessId: result.businessId,
        action: "restaurant_booking.guest_cancelled",
        entityType: "Booking",
        entityId: result.bookingId,
        metadata: { source: "GUEST_MANAGEMENT" },
      });
      await notifyRestaurantBookingEvent({
        businessId: result.businessId,
        bookingId: result.bookingId,
        event: "CANCELLED",
      });
    }

    revalidatePath("/admin");
    revalidatePath(`/booking/manage/${token}`);
    return { ok: true as const, status: "CANCELLED" as const };
  } catch (error) {
    return {
      ok: false as const,
      error: managementError(error, "Could not cancel the booking."),
    };
  }
}

export async function rescheduleRestaurantBookingByToken(input: {
  token: string;
  startAt: string;
}) {
  const scope = await resolveRestaurantBookingManagementScope(input.token);
  if (!scope) {
    return { ok: false as const, error: "This booking link is invalid." };
  }
  const requestedStart = new Date(input.startAt);
  if (Number.isNaN(requestedStart.getTime())) {
    return { ok: false as const, error: "Invalid booking time." };
  }

  const prisma = getPrisma();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const access = await tx.restaurantBookingManagementToken.findUnique({
            where: {
              businessId_tokenHash: {
                businessId: scope.businessId,
                tokenHash: scope.tokenHash,
              },
            },
            select: {
              restaurantBooking: {
                select: { id: true, bookingId: true, partySize: true },
              },
            },
          });
          if (!access) throw new Error("BOOKING_NOT_FOUND");

          const detail = access.restaurantBooking;
          const booking = await tx.booking.findFirst({
            where: { id: detail.bookingId, businessId: scope.businessId },
            select: { status: true, endAt: true },
          });
          if (!booking) throw new Error("BOOKING_NOT_FOUND");
          if (isManagementLinkExpired(booking.endAt)) throw new Error("BOOKING_EXPIRED");
          if (!isActiveStatus(booking.status)) throw new Error("BOOKING_INACTIVE");

          const allocation = await allocateRestaurantBookingSlot(tx, {
            businessId: scope.businessId,
            partySize: detail.partySize,
            startAt: requestedStart,
            excludeBookingId: detail.bookingId,
            windowMode: "PUBLIC",
          });

          await tx.booking.updateMany({
            where: { id: detail.bookingId, businessId: scope.businessId },
            data: { startAt: requestedStart, endAt: allocation.endAt },
          });
          await tx.bookingTable.deleteMany({
            where: {
              businessId: scope.businessId,
              restaurantBookingId: detail.id,
            },
          });
          await tx.bookingTable.createMany({
            data: allocation.tableIds.map((tableId) => ({
              businessId: scope.businessId,
              restaurantBookingId: detail.id,
              tableId,
            })),
          });

          return {
            businessId: scope.businessId,
            bookingId: detail.bookingId,
            startAt: requestedStart.toISOString(),
            endAt: allocation.endAt.toISOString(),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await writeAuditLog({
        businessId: result.businessId,
        action: "restaurant_booking.guest_rescheduled",
        entityType: "Booking",
        entityId: result.bookingId,
        metadata: { source: "GUEST_MANAGEMENT", startAt: result.startAt },
      });
      await notifyRestaurantBookingEvent({
        businessId: result.businessId,
        bookingId: result.bookingId,
        event: "RESCHEDULED",
      });
      revalidatePath("/admin");
      revalidatePath(`/booking/manage/${input.token}`);
      return { ok: true as const, startAt: result.startAt, endAt: result.endAt };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }
      return {
        ok: false as const,
        error: managementError(error, "Could not reschedule the booking."),
      };
    }
  }

  return { ok: false as const, error: "Could not reschedule the booking." };
}
