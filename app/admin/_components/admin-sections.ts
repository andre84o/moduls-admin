import {
  Home,
  CalendarDays,
  Users,
  Globe,
  Star,
  UtensilsCrossed,
} from "lucide-react";

/**
 * Admin section registry — plain data, NOT a client module, so it can be
 * imported by both the server (app/admin/page.tsx, the super layout) and the
 * client sidebar. Keeping it out of a "use client" file matters: a data export
 * from a client module is replaced with a client-reference proxy on the server
 * (its array methods disappear), which is exactly what breaks otherwise.
 */

export const ADMIN_SECTIONS = [
  { id: "properties", label: "Properties", icon: Home, module: "RENTAL" },
  { id: "bookings", label: "Bookings", icon: CalendarDays, module: "BOOKING" },
  { id: "customers", label: "CRM", icon: Users, module: "CRM" },
  { id: "website", label: "Website", icon: Globe, module: "WEBSITE" },
  { id: "googleReviews", label: "Google Reviews", icon: Star, module: "WEBSITE" },
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed, module: "RESTAURANT" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

/** Sections visible for the given set of enabled modules (Overview is core). */
export function visibleAdminSections(enabledModules: string[]) {
  return ADMIN_SECTIONS.filter(
    (s) => !s.module || enabledModules.includes(s.module),
  );
}
