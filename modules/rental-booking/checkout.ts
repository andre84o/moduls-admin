"use server";

import { getPrisma } from "@/lib/prisma";
import {
  createBookingCheckout as createCoreBookingCheckout,
  type BookingCheckoutInput,
  type BookingCheckoutResult,
} from "@/lib/booking-checkout";
import { isRentalBookingEnabledForBusiness } from "@/lib/rental-booking";

/** Public Rental Booking checkout boundary. businessId is resolved from Property. */
export async function createRentalBookingCheckout(
  input: BookingCheckoutInput,
): Promise<BookingCheckoutResult> {
  const property = await getPrisma().property.findFirst({
    where: { id: input.propertyId },
    select: { businessId: true },
  });

  if (!property) {
    return { ok: false, error: "Property not found." };
  }

  const enabled = await isRentalBookingEnabledForBusiness(property.businessId);
  if (!enabled) {
    return { ok: false, error: "Booking is not available for this property." };
  }

  return createCoreBookingCheckout(input);
}
