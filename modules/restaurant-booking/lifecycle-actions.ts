"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireRestaurantBooking } from "./guards";
import {
  RESTAURANT_CAPACITY_STATUSES,
  allocateRestaurantBookingSlot,
  restaurantSlotErrorMessage,
} from "./booking-slot";

const WRITER_ROLES = ["OWNER", "ADMIN"] as const;

type ManagedStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED";

function cleanText(value: string | null | undefined, max: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, max) : null;
}

function lifecycleError(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return "Booking changed concurrently. Please try again.";
  }
  const code = error instanceof Error ? error.message : "";
  const mapped = restaurantSlotErrorMessage(code);
  if (mapped) return mapped;
  const messages: Record<string, string> = {
    BOOKING_NOT_FOUND: "Restaurant booking not found.",
    BOOKING_INACTIVE: "Only an active booking can be rescheduled.",
  };
  return messages[code] ?? fallback;
}

export async function createManagedRestaurantBooking(input: {
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  partySize: number;
  startAt: string;
  notes?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};

  const guestName = input.guestName.trim();
  if (!guestName || guestName.length > 120) return { error: "Guest name is required." };
  const startAt = new Date(input.startAt);
  if (Number.isNaN(startAt.getTime())) return { error: "Invalid booking time." };

  const prisma = getPrisma();
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const allocation = await allocateRestaurantBookingSlot(tx, {
          businessId: access.businessId,
          partySize: input.partySize,
          startAt,
          windowMode: "ADMIN",
        });
        const booking = await tx.booking.create({
          data: {
            businessId: access.businessId,
            guestName,
            guestEmail: cleanText(input.guestEmail, 200),
            startAt,
            endAt: allocation.endAt,
            status: "CONFIRMED",
            notes: cleanText(input.notes, 2000),
          },
          select: { id: true },
        });
        const detail = await tx.restaurantBookingDetail.create({
          data: {
            businessId: access.businessId,
            bookingId: booking.id,
            guestPhone: cleanText(input.guestPhone, 40),
            partySize: input.partySize,
          },
          select: { id: true },
        });
        await tx.bookingTable.createMany({
          data: allocation.tableIds.map((tableId) => ({
            businessId: access.businessId,
            restaurantBookingId: detail.id,
            tableId,
          })),
        });
        return booking.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "restaurant_booking.booking_created",
      entityType: "Booking",
      entityId: created,
      metadata: { partySize: input.partySize, allocator: "canonical" },
    });
    revalidatePath("/admin");
    return { id: created };
  } catch (error) {
    return { error: lifecycleError(error, "Could not create the booking.") };
  }
}

export async function rescheduleRestaurantBooking(input: {
  bookingId: string;
  startAt: string;
}): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const bookingId = input.bookingId.trim();
  const startAt = new Date(input.startAt);
  if (!bookingId) return { error: "Missing booking id." };
  if (Number.isNaN(startAt.getTime())) return { error: "Invalid booking time." };

  const prisma = getPrisma();
  try {
    await prisma.$transaction(
      async (tx) => {
        const detail = await tx.restaurantBookingDetail.findFirst({
          where: { businessId: access.businessId, bookingId },
          select: { id: true, partySize: true },
        });
        if (!detail) throw new Error("BOOKING_NOT_FOUND");
        const booking = await tx.booking.findFirst({
          where: { businessId: access.businessId, id: bookingId },
          select: { status: true },
        });
        if (!booking) throw new Error("BOOKING_NOT_FOUND");
        if (!RESTAURANT_CAPACITY_STATUSES.includes(booking.status as (typeof RESTAURANT_CAPACITY_STATUSES)[number])) {
          throw new Error("BOOKING_INACTIVE");
        }

        const allocation = await allocateRestaurantBookingSlot(tx, {
          businessId: access.businessId,
          partySize: detail.partySize,
          startAt,
          excludeBookingId: bookingId,
          windowMode: "ADMIN",
        });

        await tx.booking.updateMany({
          where: { businessId: access.businessId, id: bookingId },
          data: { startAt, endAt: allocation.endAt },
        });
        await tx.bookingTable.deleteMany({
          where: { businessId: access.businessId, restaurantBookingId: detail.id },
        });
        await tx.bookingTable.createMany({
          data: allocation.tableIds.map((tableId) => ({
            businessId: access.businessId,
            restaurantBookingId: detail.id,
            tableId,
          })),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "restaurant_booking.rescheduled",
      entityType: "Booking",
      entityId: bookingId,
      metadata: { startAt: startAt.toISOString() },
    });
    revalidatePath("/admin");
    return {};
  } catch (error) {
    return { error: lifecycleError(error, "Could not reschedule the booking.") };
  }
}

export async function setManagedRestaurantBookingStatus(
  bookingId: string,
  status: ManagedStatus,
): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const id = bookingId.trim();
  if (!id) return { error: "Missing booking id." };

  const prisma = getPrisma();
  try {
    await prisma.$transaction(
      async (tx) => {
        const detail = await tx.restaurantBookingDetail.findFirst({
          where: { businessId: access.businessId, bookingId: id },
          select: { id: true, partySize: true },
        });
        if (!detail) throw new Error("BOOKING_NOT_FOUND");
        const booking = await tx.booking.findFirst({
          where: { businessId: access.businessId, id },
          select: { startAt: true, status: true },
        });
        if (!booking) throw new Error("BOOKING_NOT_FOUND");

        const currentBlocks = RESTAURANT_CAPACITY_STATUSES.includes(
          booking.status as (typeof RESTAURANT_CAPACITY_STATUSES)[number],
        );
        const nextBlocks = RESTAURANT_CAPACITY_STATUSES.includes(
          status as (typeof RESTAURANT_CAPACITY_STATUSES)[number],
        );

        if (!currentBlocks && nextBlocks) {
          const allocation = await allocateRestaurantBookingSlot(tx, {
            businessId: access.businessId,
            partySize: detail.partySize,
            startAt: booking.startAt,
            excludeBookingId: id,
            windowMode: "ADMIN",
          });
          await tx.bookingTable.deleteMany({
            where: { businessId: access.businessId, restaurantBookingId: detail.id },
          });
          await tx.bookingTable.createMany({
            data: allocation.tableIds.map((tableId) => ({
              businessId: access.businessId,
              restaurantBookingId: detail.id,
              tableId,
            })),
          });
        }

        await tx.booking.updateMany({
          where: { businessId: access.businessId, id },
          data: { status },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "restaurant_booking.status_changed",
      entityType: "Booking",
      entityId: id,
      metadata: { status, capacityRechecked: true },
    });
    revalidatePath("/admin");
    return {};
  } catch (error) {
    return { error: lifecycleError(error, "Could not change booking status.") };
  }
}
