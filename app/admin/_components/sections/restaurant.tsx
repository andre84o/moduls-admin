"use client";

import { WebsiteSection } from "./website";
import type { AdminWebsitePageWithSections } from "@/modules/website/types";

/**
 * Restaurant-specific section types stored in website_sections.
 * Used to filter which website pages are surfaced in the Restaurant tab.
 * Generic section types (hero, featureGrid, siteHeader, siteFooter, …)
 * are intentionally excluded — those belong to the Website tab.
 */
const RESTAURANT_SECTION_TYPES = new Set([
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

function hasRestaurantSection(page: AdminWebsitePageWithSections): boolean {
  return page.sections.some((s) => RESTAURANT_SECTION_TYPES.has(s.type));
}

/**
 * Restaurant admin section.
 *
 * Renders a focused view of website pages that contain at least one
 * restaurant-specific section type. Editing is handled by the same
 * WebsiteSection editor used in the Website tab — no new editor logic.
 *
 * Data never re-fetched here; pages come from the server-loaded
 * websitePages already in AdminShell (WEBSITE module gated).
 * RESTAURANT module gating is enforced by the sidebar visibility
 * (admin-sections.ts) and by proxy.ts / requireRestaurantModule()
 * on all restaurant-specific server actions.
 */
export function RestaurantSection({
  pages,
}: {
  pages: AdminWebsitePageWithSections[];
}) {
  const restaurantPages = pages.filter(hasRestaurantSection);

  if (restaurantPages.length === 0) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Restaurant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage menus, sections, and restaurant content.
          </p>
        </header>
        <p className="py-12 text-center text-sm text-muted-foreground">
          No restaurant pages found. Add a restaurant section (e.g. Menu list)
          to a website page to see it here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Restaurant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage menus, sections, and restaurant content.
        </p>
      </header>
      <WebsiteSection pages={restaurantPages} />
    </div>
  );
}
