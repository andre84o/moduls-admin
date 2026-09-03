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

export const RESTAURANT_SECTION_TYPES = new Set([
  "restaurantHero",
  "restaurantStory",
  "restaurantSpecialties",
  "restaurantGallery",
  "restaurantFooter",
  "menuList",
  "contactInfo",
  "contactForm",
  "cateringHero",
  "cateringEditorial",
  "cateringMenus",
  "festEvent",
]);

export function isRestaurantSectionType(type: string): boolean {
  return RESTAURANT_SECTION_TYPES.has(type);
}
