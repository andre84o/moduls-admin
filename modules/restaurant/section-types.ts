/**
 * Canonical list of restaurant-specific website section types.
 *
 * Used for:
 *  - Server-side RESTAURANT module gating in website mutations
 *  - Public renderer filtering when RESTAURANT is disabled
 *  - Admin UI separation of Website vs Restaurant content views
 *
 * No "server-only" — safe to import in both server and client contexts.
 */

export const RESTAURANT_SECTION_TYPES = new Set<string>([
  "menuList",
  "cateringMenus",
  "cateringIntro",
]);

/** Section types that require the CATERING add-on to be enabled. */
export const CATERING_SECTION_TYPES = new Set<string>([
  "cateringMenus",
  "cateringIntro",
]);

export function isRestaurantSectionType(type: string): boolean {
  return RESTAURANT_SECTION_TYPES.has(type);
}

export function isCateringSectionType(type: string): boolean {
  return CATERING_SECTION_TYPES.has(type);
}
