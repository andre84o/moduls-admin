import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isModuleEnabledForBusiness } from "@/lib/modules";
import { isDemoMode } from "@/lib/config";
import type { Section } from "@/components/sections/types";
import { mapPublishedSections } from "./utils";

/**
 * PUBLIC, sessionless read layer for the Website content module.
 *
 * This powers the public site (e.g. the home page). It is deliberately separate
 * from modules/website/queries.ts, which is the ADMIN read layer and exposes
 * draftContent. This file NEVER reads or returns draftContent — public visitors
 * only ever see publishedContent of PUBLISHED pages and visible sections.
 *
 * Tenant safety (CLAUDE.md): there is no session here, so businessId is never
 * accepted from the client. We resolve a published page first, take its
 * server-side businessId from the matched row, then verify the WEBSITE module is
 * enabled for THAT business — the same pattern as lib/public-property.ts.
 *
 * Server-only: never import this into a client component.
 */

/**
 * Published, renderable sections for a public website page by stable key (e.g.
 * "home"). Returns null whenever there is nothing safe to render so the caller
 * falls back to config — specifically when:
 *  - there is no database (demo mode),
 *  - no PUBLISHED page with that key exists,
 *  - the WEBSITE module is disabled for the page's business,
 *  - or no visible section has renderable publishedContent.
 *
 * Only publishedContent is selected — draftContent is never read here.
 */
export async function getPublishedPageSections(
  key: string,
): Promise<Section[] | null> {
  // No real database in demo mode — let the caller use the config fallback.
  if (isDemoMode()) return null;

  const page = await getPrisma().websitePage.findFirst({
    // key is unique per business; if two businesses both publish this key this
    // resolves to one arbitrarily (acceptable for now, mirrors getPublicProperty).
    where: { key, status: "PUBLISHED" },
    select: {
      businessId: true,
      sections: {
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        // Public render: published content only, never draftContent.
        select: { type: true, publishedContent: true },
      },
    },
  });
  if (!page) return null;

  // businessId comes from the matched row (server-side), never the client.
  if (!(await isModuleEnabledForBusiness(page.businessId, "WEBSITE"))) return null;

  const sections = mapPublishedSections(page.sections);
  return sections.length > 0 ? sections : null;
}

/** Published home sections, or null when the config fallback should be used. */
export function getPublishedHomeSections(): Promise<Section[] | null> {
  return getPublishedPageSections("home");
}
