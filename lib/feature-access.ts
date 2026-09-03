import "server-only";
import { getPrisma } from "./prisma";
import { isDemoMode } from "./config";

/**
 * Generic per-business add-on / feature access gate.
 *
 * This is deliberately NOT a module (no ProjectType) — modules are the
 * WEBSITE/RENTAL/BOOKING/CRM product surfaces toggled via Project rows. Add-ons
 * are finer-grained PAID features layered on top of a module (e.g. Google
 * Reviews inside WEBSITE) and are granted per business by a SUPER_ADMIN through
 * BusinessFeatureAccess.
 *
 * Tenant safety (CLAUDE.md): callers resolve the businessId server-side (session
 * for admin, resolved public tenant for public) and pass it in. Access is scoped
 * by (businessId, key); one business's grant never affects another's.
 *
 * Server-only: never import this into a client component.
 */

/** Canonical add-on keys. Add new paid add-ons here — never a ProjectType. */
export const GOOGLE_REVIEWS_FEATURE_KEY = "GOOGLE_REVIEWS";
export const CATERING_FEATURE_KEY = "CATERING";
export const RESTAURANT_BOOKING_FEATURE_KEY = "RESTAURANT_BOOKING";

/** Every add-on key the platform recognizes (whitelist for the admin toggle). */
export const KNOWN_FEATURE_KEYS = new Set<string>([
  GOOGLE_REVIEWS_FEATURE_KEY,
  CATERING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
]);

/**
 * Whether an add-on is enabled for a business. Defaults to false (add-ons are
 * off until a SUPER_ADMIN grants them). Demo mode enables every add-on so the
 * demo admin stays fully browsable without a database, mirroring module gating.
 * The businessId MUST be server-resolved — never a client value.
 */
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
