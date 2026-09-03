import "server-only";
import { requireModule, isModuleEnabledForBusiness } from "@/lib/modules";
import type { MemberRole } from "@/app/generated/prisma/enums";
import type { BusinessAccess } from "@/lib/auth";

/**
 * Admin guard: requires the RESTAURANT module to be enabled for the resolved
 * business. Use in admin server actions and protected server components.
 *
 * Wraps requireModule("RESTAURANT") — handles session, BusinessMember, role
 * check, and module check in one call. Returns the safe BusinessAccess.
 */
export async function requireRestaurantModule(opts?: {
  allowedRoles?: MemberRole[];
}): Promise<BusinessAccess> {
  return requireModule("RESTAURANT", opts);
}

/**
 * Public guard: checks RESTAURANT is enabled for an already server-resolved
 * businessId. Use in sessionless public flows (public form submissions, public
 * page rendering). The businessId MUST come from the server — never the client.
 */
export async function isRestaurantEnabled(businessId: string): Promise<boolean> {
  return isModuleEnabledForBusiness(businessId, "RESTAURANT");
}
