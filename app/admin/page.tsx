import {
  getProperties,
  getBookings,
  getCustomers,
} from "@/lib/queries";
import { getWebsitePagesWithSections } from "@/modules/website/queries";
import {
  getGoogleReviewSettings,
  getCachedGoogleReviewsAdmin,
  isGoogleReviewsAddOnEnabled,
} from "@/modules/website/google-reviews/queries";
import { isCateringAddOnEnabled } from "@/modules/restaurant/queries";
import { isGoogleReviewsConfigured } from "@/lib/config";
import { listSwitchableBusinesses, getActiveBusinessId } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { AdminShell } from "./_components/admin-shell";
import {
  ADMIN_SECTIONS,
  type AdminSectionId,
} from "./_components/admin-sections";

/** Coerce the ?tab= query into a known section id (defaults to website). */
function tabToSection(tab: string | undefined): AdminSectionId {
  const match = ADMIN_SECTIONS.find((s) => s.id === tab);
  return match ? match.id : "website";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const initialSection = tabToSection((await searchParams).tab);
  // Each query verifies the session and scopes by the active businessId.
  // getWebsitePagesWithSections is itself gated by the WEBSITE module and
  // returns [] when it is disabled, so loading it here never leaks content.
  const [
    properties,
    bookings,
    customers,
    websitePages,
    googleReviewSettings,
    googleReviewCache,
    googleReviewsAddOnEnabled,
    cateringAddOnEnabled,
    businesses,
    activeId,
    enabledModules,
  ] = await Promise.all([
    getProperties(),
    getBookings(),
    getCustomers(),
    getWebsitePagesWithSections(),
    getGoogleReviewSettings(),
    getCachedGoogleReviewsAdmin(),
    isGoogleReviewsAddOnEnabled(),
    isCateringAddOnEnabled(),
    listSwitchableBusinesses(),
    getActiveBusinessId(),
    getEnabledModules(),
  ]);

  // Server-side env check — the API key value is never sent to the client.
  const googleReviewsConfigured = isGoogleReviewsConfigured();

  return (
    <AdminShell
      properties={properties}
      bookings={bookings}
      customers={customers}
      websitePages={websitePages}
      googleReviewSettings={googleReviewSettings}
      googleReviewCache={googleReviewCache}
      googleReviewsConfigured={googleReviewsConfigured}
      googleReviewsAddOnEnabled={googleReviewsAddOnEnabled}
      cateringAddOnEnabled={cateringAddOnEnabled}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
      activeBusinessId={activeId}
      enabledModules={Array.from(enabledModules)}
      initialSection={initialSection}
    />
  );
}
