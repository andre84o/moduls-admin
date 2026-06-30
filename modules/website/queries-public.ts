import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isModuleEnabledForBusiness } from "@/lib/modules";
import { isDemoMode } from "@/lib/config";
import type { Section } from "@/components/sections/types";
import { mapPublishedSections, pickPublicBusinessId } from "./utils";

/**
 * PUBLIC, sessionless read layer for the Website content module.
 *
 * This powers the public site (e.g. the home page). It is deliberately separate
 * from modules/website/queries.ts, which is the ADMIN read layer and exposes
 * draftContent. This file NEVER reads or returns draftContent — public visitors
 * only ever see publishedContent of PUBLISHED pages and visible sections.
 *
 * Tenant safety (CLAUDE.md): there is no session here, so businessId is never
 * accepted from the client. We resolve the public businessId SERVER-SIDE FIRST
 * (PUBLIC_BUSINESS_ID, else the sole business), then scope the page query by
 * that businessId + key + PUBLISHED. We never resolve a published page by
 * key/status alone and then trust the matched row's businessId — in a shared
 * multi-tenant DB that would let any business's "home" satisfy the public site.
 *
 * Server-only: never import this into a client component.
 */

/**
 * Resolve the SAFE public businessId for sessionless rendering. Never accepts a
 * businessId from the client. Order: PUBLIC_BUSINESS_ID, else the only business
 * when exactly one exists, else null (we do not guess between many businesses).
 *
 * The businesses table is only read when no explicit tenant is configured, and
 * `take: 2` is enough to distinguish "exactly one" from "more than one".
 */
async function resolvePublicBusinessId(): Promise<string | null> {
  const explicit = process.env.PUBLIC_BUSINESS_ID?.trim();
  if (explicit) return explicit;

  const businesses = await getPrisma().business.findMany({
    select: { id: true },
    take: 2,
  });
  return pickPublicBusinessId(null, businesses.map((b) => b.id));
}

/**
 * Published, renderable sections for a public website page by stable key (e.g.
 * "home"). Returns null whenever there is nothing safe to render so the caller
 * falls back to config — specifically when:
 *  - there is no database (demo mode),
 *  - no public businessId can be safely resolved (zero/multiple businesses and
 *    no PUBLIC_BUSINESS_ID set — we never guess a tenant),
 *  - the WEBSITE module is disabled for the resolved business,
 *  - no PUBLISHED page with that key exists for the resolved business,
 *  - or no visible section has renderable publishedContent.
 *
 * Only publishedContent is selected — draftContent is never read here.
 */
export async function getPublishedPageSections(
  key: string,
): Promise<Section[] | null> {
  // No real database in demo mode — let the caller use the config fallback.
  if (isDemoMode()) return null;

  // Resolve the public tenant FIRST (server-side), then scope the page query by
  // it. We never trust a businessId taken from a page matched by key alone.
  const businessId = await resolvePublicBusinessId();
  if (!businessId) return null;

  // WEBSITE module must be enabled for the resolved business.
  if (!(await isModuleEnabledForBusiness(businessId, "WEBSITE"))) return null;

  const page = await getPrisma().websitePage.findFirst({
    // Always scoped by businessId — key is unique per business, so this can only
    // ever return THIS tenant's page, never another business's same-key page.
    where: { businessId, key, status: "PUBLISHED" },
    select: {
      sections: {
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        // Public render: published content only, never draftContent.
        select: { type: true, publishedContent: true },
      },
    },
  });
  if (!page) return null;

  const sections = mapPublishedSections(page.sections);
  return sections.length > 0 ? sections : null;
}

/** Published home sections, or null when the config fallback should be used. */
export function getPublishedHomeSections(): Promise<Section[] | null> {
  return getPublishedPageSections("home");
}
