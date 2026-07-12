import {
  getDashboardStats,
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
import { isGoogleReviewsConfigured } from "@/lib/config";
import { listUserBusinesses, getActiveBusinessId } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminPage() {
  // Each query verifies the session and scopes by the active businessId.
  // getWebsitePagesWithSections is itself gated by the WEBSITE module and
  // returns [] when it is disabled, so loading it here never leaks content.
  const [
    stats,
    properties,
    bookings,
    customers,
    websitePages,
    googleReviewSettings,
    googleReviewCache,
    googleReviewsAddOnEnabled,
    businesses,
    activeId,
    enabledModules,
  ] = await Promise.all([
    getDashboardStats(),
    getProperties(),
    getBookings(),
    getCustomers(),
    getWebsitePagesWithSections(),
    getGoogleReviewSettings(),
    getCachedGoogleReviewsAdmin(),
    isGoogleReviewsAddOnEnabled(),
    listUserBusinesses(),
    getActiveBusinessId(),
    getEnabledModules(),
  ]);

  // Server-side env check — the API key value is never sent to the client.
  const googleReviewsConfigured = isGoogleReviewsConfigured();

  return (
    <AdminShell
      stats={stats}
      properties={properties}
      bookings={bookings}
      customers={customers}
      websitePages={websitePages}
      googleReviewSettings={googleReviewSettings}
      googleReviewCache={googleReviewCache}
      googleReviewsConfigured={googleReviewsConfigured}
      googleReviewsAddOnEnabled={googleReviewsAddOnEnabled}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
      activeBusinessId={activeId}
      enabledModules={Array.from(enabledModules)}
    />
  );
}
