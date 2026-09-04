"use server";

import type { BookingStatus } from "@/app/generated/prisma/enums";
import {
  createBooking as createCoreBooking,
  setBookingStatus as setCoreBookingStatus,
  deleteBooking as deleteCoreBooking,
  addBlockedTime as addCoreBlockedTime,
} from "@/lib/actions";
import { requireRentalBooking } from "@/lib/rental-booking";

/** Rental-specific admin action boundary. */
export async function createRentalBooking(formData: FormData) {
  await requireRentalBooking();
  return createCoreBooking(formData);
}

export async function setRentalBookingStatus(id: string, status: BookingStatus) {
  await requireRentalBooking();
  return setCoreBookingStatus(id, status);
}

export async function deleteRentalBooking(id: string) {
  await requireRentalBooking({ allowedRoles: ["OWNER", "ADMIN"] });
  return deleteCoreBooking(id);
}

export async function addRentalBlockedTime(formData: FormData) {
  await requireRentalBooking({ allowedRoles: ["OWNER", "ADMIN"] });
  return addCoreBlockedTime(formData);
}
