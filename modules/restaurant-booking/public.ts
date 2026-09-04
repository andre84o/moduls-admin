import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { isRestaurantBookingEnabledForBusiness } from "./guards";
import { getRestaurantAvailabilityForBusiness } from "./availability";
import { resolvePublicBusinessId } from "@/lib/public-tenant";
import {
  allocateRestaurantBookingSlot,
  restaurantSlotErrorMessage,
} from "./booking-slot";
import { notifyRestaurantBookingEvent } from "./notifications";

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

export async function createRestaurantBookingForBusiness(input: {
  businessId: string;
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
  const businessId = input.businessId.trim();
  if (!businessId || !(await isRestaurantBookingEnabledForBusiness(businessId))) {
    return { ok: false, error: "Restaurant booking is not available." };
  }

  const guestName = input.guestName.trim();
  if (!guestName || guestName.length > 120) {
    return { ok: false, error: "Guest name is required." };
  }
  if (!Number.isInteger(input.partySize) || input.partySize < 1) {
    return { ok: false, error: "Invalid party size." };
  }

  const requestedStart = new Date(input.startAt);
  if (Number.isNaN(requestedStart.getTime())) {
    return { ok: false, error: "Invalid booking time." };
  }

  const prisma = getPrisma();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await prisma.$transaction(
        async (tx) => {
          const allocation = await allocateRestaurantBookingSlot(tx, {
            businessId,
            partySize: input.partySize,
            startAt: requestedStart,
            windowMode: "PUBLIC",
          });

          const status =
            allocation.settings.confirmationMode === "AUTO_CONFIRM"
              ? "CONFIRMED"
              : "PENDING";
          const booking = await tx.booking.create({
            data: {
              businessId,
              guestName,
              guestEmail: cleanText(input.guestEmail, 200),
              startAt: requestedStart,
              endAt: allocation.endAt,
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
            data: allocation.tableIds.map((tableId) => ({
              businessId,
              restaurantBookingId: detail.id,
              tableId,
            })),
          });
          return { bookingId: booking.id, status } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await writeAuditLog({
        businessId,
        action: "restaurant_booking.public_created",
        entityType: "Booking",
        entityId: created.bookingId,
        metadata: { partySize: input.partySize, status: created.status },
      });
      await notifyRestaurantBookingEvent({
        businessId,
        bookingId: created.bookingId,
        event: "CREATED",
      });
      return { ok: true, ...created };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }
      const message = restaurantSlotErrorMessage(
        error instanceof Error ? error.message : "",
      );
      if (message) return { ok: false, error: message };
      return {
        ok: false,
        error: "Could not create the booking. Please try another time.",
      };
    }
  }
  return { ok: false, error: "Could not create the booking. Please try again." };
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
  if (!businessId) {
    return { ok: false, error: "Restaurant booking is not available." };
  }
  return createRestaurantBookingForBusiness({ businessId, ...input });
}
