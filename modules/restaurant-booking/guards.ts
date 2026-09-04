import "server-only";

import { redirect } from "next/navigation";
import type { MemberRole } from "@/app/generated/prisma/enums";
import type { BusinessAccess } from "@/lib/auth";
import { RESTAURANT_BOOKING_FEATURE_KEY, hasBusinessFeatureAccess } from "@/lib/feature-access";
import { isModuleEnabled, isModuleEnabledForBusiness, requireModule } from "@/lib/modules";

/**
 * Admin security boundary for Restaurant Booking.
 * Requires the shared BOOKING engine, RESTAURANT, and the paid
 * RESTAURANT_BOOKING add-on for the server-resolved business.
 */
export async function requireRestaurantBooking(opts?: {
  allowedRoles?: MemberRole[];
}): Promise<BusinessAccess> {
  const access = await requireModule("BOOKING", opts);
  if (access.isDemo) return access;

  const [restaurantEnabled, featureEnabled] = await Promise.all([
    isModuleEnabled("RESTAURANT", access),
    hasBusinessFeatureAccess(access.businessId, RESTAURANT_BOOKING_FEATURE_KEY),
  ]);

  if (!restaurantEnabled || !featureEnabled) redirect("/admin");
  return access;
}

/** Public/sessionless capability check for a server-resolved businessId. */
export async function isRestaurantBookingEnabledForBusiness(
  businessId: string,
): Promise<boolean> {
  const [bookingEnabled, restaurantEnabled, featureEnabled] = await Promise.all([
    isModuleEnabledForBusiness(businessId, "BOOKING"),
    isModuleEnabledForBusiness(businessId, "RESTAURANT"),
    hasBusinessFeatureAccess(businessId, RESTAURANT_BOOKING_FEATURE_KEY),
  ]);
  return bookingEnabled && restaurantEnabled && featureEnabled;
}
