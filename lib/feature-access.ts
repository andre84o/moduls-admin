import "server-only";
import { getPrisma } from "./prisma";
import { isDemoMode } from "./config";

/**
 * Generic per-business paid feature / product access gate.
 *
 * Project rows represent broad capabilities such as WEBSITE, RENTAL,
 * RESTAURANT and the shared technical BOOKING engine. Product entitlements such
 * as RENTAL_BOOKING and RESTAURANT_BOOKING live here so turning one booking
 * product on never grants another one by accident.
 *
 * Tenant safety: callers resolve businessId server-side and pass it in. Access
 * is always scoped by (businessId, key).
 */

export const GOOGLE_REVIEWS_FEATURE_KEY = "GOOGLE_REVIEWS";
export const CATERING_FEATURE_KEY = "CATERING";
export const RENTAL_BOOKING_FEATURE_KEY = "RENTAL_BOOKING";
export const RESTAURANT_BOOKING_FEATURE_KEY = "RESTAURANT_BOOKING";

export const KNOWN_FEATURE_KEYS = new Set<string>([
  GOOGLE_REVIEWS_FEATURE_KEY,
  CATERING_FEATURE_KEY,
  RENTAL_BOOKING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
]);

export async function hasBusinessFeatureAccess(
  businessId: string,
  key: string,
): Promise<boolean> {
  if (isDemoMode()) return true;

  const row = await getPrisma().businessFeatureAccess.findUnique({
    where: { businessId_key: { businessId, key } },
    select: { enabled: true },
  });
  return row?.enabled ?? false;
}
