import "server-only";
import { requireBusinessAccess } from "@/lib/auth";
import { isModuleEnabled } from "@/lib/modules";
import { hasBusinessFeatureAccess, CATERING_FEATURE_KEY } from "@/lib/feature-access";

/**
 * Whether the Catering sections should be shown for the active business.
 * True only when the RESTAURANT module is enabled AND the CATERING add-on is
 * granted. Demo mode enables every add-on so the demo admin is fully browsable.
 */
export async function isCateringAddOnEnabled(): Promise<boolean> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return true;
  if (!(await isModuleEnabled("RESTAURANT", access))) return false;
  return hasBusinessFeatureAccess(access.businessId, CATERING_FEATURE_KEY);
}
