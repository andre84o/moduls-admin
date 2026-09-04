"use server";

import type { BookingStatus } from "@/app/generated/prisma/enums";
import {
  createBooking as createCoreBooking,
  setBookingStatus as setCoreBookingStatus,
  deleteBooking as deleteCoreBooking,
  addBlockedTime as addCoreBlockedTime,
} from "@/lib/actions";
import { getPrisma } from "@/lib/prisma";
import { requireRentalBooking } from "@/lib/rental-booking";

async function assertNotRestaurantBooking(id: string, businessId: string) {
  const restaurant = await getPrisma().restaurantBookingDetail.findFirst({
    where: { bookingId: id, businessId },
    select: { id: true },
  });
  if (restaurant) {
    throw new Error("Restaurant bookings must be changed from Restaurant Booking.");
  }
}

/** Rental-specific admin action boundary. */
export async function createRentalBooking(formData: FormData) {
  await requireRentalBooking();
  return createCoreBooking(formData);
}

export async function setRentalBookingStatus(id: string, status: BookingStatus) {
  const access = await requireRentalBooking();
  if (!access.isDemo) await assertNotRestaurantBooking(id, access.businessId);
  return setCoreBookingStatus(id, status);
}

export async function deleteRentalBooking(id: string) {
  const access = await requireRentalBooking({ allowedRoles: ["OWNER", "ADMIN"] });
  if (!access.isDemo) await assertNotRestaurantBooking(id, access.businessId);
  return deleteCoreBooking(id);
}

export async function addRentalBlockedTime(formData: FormData) {
  await requireRentalBooking({ allowedRoles: ["OWNER", "ADMIN"] });
  return addCoreBlockedTime(formData);
}
