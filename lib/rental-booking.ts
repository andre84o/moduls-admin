import "server-only";

import { redirect } from "next/navigation";
import type { MemberRole } from "@/app/generated/prisma/enums";
import type { BusinessAccess } from "./auth";
import { RENTAL_BOOKING_FEATURE_KEY, hasBusinessFeatureAccess } from "./feature-access";
import { isModuleEnabled, isModuleEnabledForBusiness, requireModule } from "./modules";

/** Admin gate for the Rental Booking product. */
export async function requireRentalBooking(opts?: {
  allowedRoles?: MemberRole[];
}): Promise<BusinessAccess> {
  const access = await requireModule("BOOKING", opts);
  if (access.isDemo) return access;

  const [rentalEnabled, featureEnabled] = await Promise.all([
    isModuleEnabled("RENTAL", access),
    hasBusinessFeatureAccess(access.businessId, RENTAL_BOOKING_FEATURE_KEY),
  ]);
  if (!rentalEnabled || !featureEnabled) redirect("/admin");
  return access;
}

/** Public/sessionless capability check for a server-resolved businessId. */
export async function isRentalBookingEnabledForBusiness(
  businessId: string,
): Promise<boolean> {
  const [bookingEnabled, rentalEnabled, featureEnabled] = await Promise.all([
    isModuleEnabledForBusiness(businessId, "BOOKING"),
    isModuleEnabledForBusiness(businessId, "RENTAL"),
    hasBusinessFeatureAccess(businessId, RENTAL_BOOKING_FEATURE_KEY),
  ]);
  return bookingEnabled && rentalEnabled && featureEnabled;
}
