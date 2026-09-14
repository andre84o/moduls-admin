import {
  Home,
  CalendarDays,
  Users,
  Globe,
  Star,
  UtensilsCrossed,
  MapPinned,
} from "lucide-react";

/**
 * Admin section registry — plain data, NOT a client module, so it can be
 * imported by both the server (app/admin/page.tsx, the super layout) and the
 * client sidebar. Keeping it out of a "use client" file matters: a data export
 * from a client module is replaced with a client-reference proxy on the server
 * (its array methods disappear), which is exactly what breaks otherwise.
 */

export const ADMIN_SECTIONS = [
  { id: "properties", label: "Properties", icon: Home, module: "RENTAL", feature: null },
  { id: "bookings", label: "Bookings", icon: CalendarDays, module: "BOOKING", feature: null },
  { id: "floorPlan", label: "Floor plan", icon: MapPinned, module: null, feature: "RESTAURANT_BOOKING" },
  { id: "customers", label: "CRM", icon: Users, module: "CRM", feature: null },
  { id: "website", label: "Website", icon: Globe, module: "WEBSITE", feature: null },
  { id: "googleReviews", label: "Google Reviews", icon: Star, module: "WEBSITE", feature: null },
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed, module: "RESTAURANT", feature: null },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

/** Sections visible for the given enabled modules and paid feature entitlements. */
export function visibleAdminSections(
  enabledModules: string[],
  enabledFeatures: string[] = [],
) {
  return ADMIN_SECTIONS.filter(
    (section) =>
      (!section.module || enabledModules.includes(section.module)) &&
      (!section.feature || enabledFeatures.includes(section.feature)),
  );
}
