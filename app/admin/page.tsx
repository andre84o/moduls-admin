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
import {
  getRestaurantBookingSettings,
  getRestaurantZonesWithTables,
  getUnzonedRestaurantTables,
  getRestaurantBookings,
  getRestaurantServicePeriods,
  getRestaurantBlockedPeriods,
} from "@/modules/restaurant-booking/queries";
import { isRestaurantBookingEnabledForBusiness } from "@/modules/restaurant-booking/guards";
import { isRentalBookingEnabledForBusiness } from "@/lib/rental-booking";
import {
  DEFAULT_RESTAURANT_BOOKING_SETTINGS,
  type AdminRestaurantBlockedPeriod,
  type AdminRestaurantBooking,
  type AdminRestaurantServicePeriod,
  type AdminRestaurantTable,
  type AdminRestaurantZone,
} from "@/modules/restaurant-booking/types";
import { isGoogleReviewsConfigured } from "@/lib/config";
import { listSwitchableBusinesses, getActiveBusinessId } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { AdminShell } from "./_components/admin-shell";
import {
  ADMIN_SECTIONS,
  type AdminSectionId,
} from "./_components/admin-sections";

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

  const [rentalBookingEnabled, restaurantBookingEnabled] = activeId
    ? await Promise.all([
        isRentalBookingEnabledForBusiness(activeId),
        isRestaurantBookingEnabledForBusiness(activeId),
      ])
    : [false, false];

  let restaurantBookingSettings = DEFAULT_RESTAURANT_BOOKING_SETTINGS;
  let restaurantZones: AdminRestaurantZone[] = [];
  let unzonedRestaurantTables: AdminRestaurantTable[] = [];
  let restaurantBookings: AdminRestaurantBooking[] = [];
  let restaurantServicePeriods: AdminRestaurantServicePeriod[] = [];
  let restaurantBlockedPeriods: AdminRestaurantBlockedPeriod[] = [];

  if (restaurantBookingEnabled) {
    const [settings, zones, unzoned, restaurantRows, servicePeriods, blockedPeriods] = await Promise.all([
      getRestaurantBookingSettings(),
      getRestaurantZonesWithTables(),
      getUnzonedRestaurantTables(),
      getRestaurantBookings(),
      getRestaurantServicePeriods(),
      getRestaurantBlockedPeriods(),
    ]);

    restaurantBookingSettings = settings;
    restaurantZones = zones.map((zone) => ({
      ...zone,
      tables: zone.tables.map((table) => ({ ...table, zoneId: zone.id })),
    }));
    unzonedRestaurantTables = unzoned.map((table) => ({ ...table, zoneId: null }));
    restaurantBookings = restaurantRows.map((booking) => ({
      ...booking,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
    }));
    restaurantServicePeriods = servicePeriods;
    restaurantBlockedPeriods = blockedPeriods.map((period) => ({
      ...period,
      startAt: period.startAt.toISOString(),
      endAt: period.endAt.toISOString(),
    }));
  }

  const restaurantBookingIds = new Set(restaurantBookings.map((booking) => booking.id));
  const nonRestaurantBookings = restaurantBookingEnabled
    ? bookings.filter((booking) => !restaurantBookingIds.has(booking.id))
    : bookings;

  const googleReviewsConfigured = isGoogleReviewsConfigured();

  return (
    <AdminShell
      properties={properties}
      bookings={nonRestaurantBookings}
      customers={customers}
      websitePages={websitePages}
      googleReviewSettings={googleReviewSettings}
      googleReviewCache={googleReviewCache}
      googleReviewsConfigured={googleReviewsConfigured}
      googleReviewsAddOnEnabled={googleReviewsAddOnEnabled}
      cateringAddOnEnabled={cateringAddOnEnabled}
      rentalBookingEnabled={rentalBookingEnabled}
      restaurantBookingEnabled={restaurantBookingEnabled}
      restaurantBookingSettings={restaurantBookingSettings}
      restaurantZones={restaurantZones}
      unzonedRestaurantTables={unzonedRestaurantTables}
      restaurantBookings={restaurantBookings}
      restaurantServicePeriods={restaurantServicePeriods}
      restaurantBlockedPeriods={restaurantBlockedPeriods}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
      activeBusinessId={activeId}
      enabledModules={Array.from(enabledModules)}
      initialSection={initialSection}
    />
  );
}
