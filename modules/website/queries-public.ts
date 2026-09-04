import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isModuleEnabledForBusiness } from "@/lib/modules";
import { isDemoMode } from "@/lib/config";
import {
  hasBusinessFeatureAccess,
  CATERING_FEATURE_KEY,
} from "@/lib/feature-access";
import type { Section } from "@/components/sections/types";
import { mapPublishedSections, pickPublicBusinessId } from "./utils";
import { getPublicGoogleReviews } from "./google-reviews/queries-public";
import {
  isRestaurantSectionType,
  isCateringSectionType,
} from "@/modules/restaurant/section-types";

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
  if (isDemoMode()) return null;

  const businessId = await resolvePublicBusinessId();
  if (!businessId) return null;

  if (!(await isModuleEnabledForBusiness(businessId, "WEBSITE"))) return null;

  const page = await getPrisma().websitePage.findFirst({
    where: { businessId, key, status: "PUBLISHED" },
    select: {
      sections: {
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { type: true, publishedContent: true },
      },
    },
  });
  if (!page) return null;

  // Only load Restaurant/Catering capability state when the page actually has
  // Restaurant-owned sections. Ordinary website pages should not pay for an
  // unrelated feature-access query.
  const hasRestaurantSections = page.sections.some((section) =>
    isRestaurantSectionType(section.type),
  );

  let restaurantEnabled = false;
  let cateringEnabled = false;
  if (hasRestaurantSections) {
    restaurantEnabled = await isModuleEnabledForBusiness(businessId, "RESTAURANT");
    if (
      restaurantEnabled &&
      page.sections.some((section) => isCateringSectionType(section.type))
    ) {
      cateringEnabled = await hasBusinessFeatureAccess(
        businessId,
        CATERING_FEATURE_KEY,
      );
    }
  }

  const visibleSections = page.sections.filter((section) => {
    if (!isRestaurantSectionType(section.type)) return true;
    if (!restaurantEnabled) return false;
    if (isCateringSectionType(section.type) && !cateringEnabled) return false;
    return true;
  });

  const sections = mapPublishedSections(visibleSections);
  const enriched = await injectGoogleReviews(businessId, sections);
  return enriched.length > 0 ? enriched : null;
}

async function injectGoogleReviews(
  businessId: string,
  sections: Section[],
): Promise<Section[]> {
  if (!sections.some((s) => s.type === "googleReviews")) return sections;

  const data = await getPublicGoogleReviews(businessId);
  return sections.map((section) =>
    section.type === "googleReviews"
      ? { ...section, props: { ...section.props, ...data } }
      : section,
  );
}

export function getPublishedHomeSections(): Promise<Section[] | null> {
  return getPublishedPageSections("home");
}

export async function withPublicGoogleReviews(
  sections: Section[],
): Promise<Section[]> {
  if (isDemoMode()) return sections;
  const businessId = await resolvePublicBusinessId();
  if (!businessId) return sections;
  return injectGoogleReviews(businessId, sections);
}
