"use client";

import { WebsiteSection } from "./website";
import type { AdminWebsitePageWithSections } from "@/modules/website/types";

/**
 * Restaurant admin section.
 *
 * Receives pages that have already been filtered to only contain restaurant-
 * specific sections (filtering happens in AdminShell). Editing uses the same
 * WebsiteSection editor as the Website tab — no new editor logic here.
 */
export function RestaurantSection({
  pages,
}: {
  pages: AdminWebsitePageWithSections[];
}) {
  if (pages.length === 0) {
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
      <WebsiteSection pages={pages} />
    </div>
  );
}
