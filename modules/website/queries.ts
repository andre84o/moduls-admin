import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireBusinessAccess, type BusinessAccess } from "@/lib/auth";
import { isModuleEnabled } from "@/lib/modules";
import type {
  AdminWebsitePage,
  AdminWebsitePageWithSections,
  AdminWebsiteSection,
  WebsiteContent,
} from "./types";

/**
 * Read layer for the Website content module. Every function resolves the SAFE
 * businessId via requireBusinessAccess and scopes every query by it (tenant
 * isolation — see CLAUDE.md). The WEBSITE module must be enabled for the
 * business; otherwise these return empty/null so a disabled module never loads
 * or leaks content. In demo mode there is no database, so they return empty.
 *
 * Server-only: never import this into a client component.
 */

type PageRow = {
  id: string;
  key: string;
  slug: string | null;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
  draftContent: unknown;
  publishedContent: unknown;
  updatedAt: Date;
};

type SectionRow = {
  id: string;
  pageId: string;
  type: string;
  sortOrder: number;
  isVisible: boolean;
  draftContent: unknown;
  publishedContent: unknown;
  updatedAt: Date;
};

function toPage(p: PageRow): AdminWebsitePage {
  return {
    id: p.id,
    key: p.key,
    slug: p.slug,
    title: p.title,
    status: p.status,
    sortOrder: p.sortOrder,
    draftContent: (p.draftContent ?? null) as WebsiteContent,
    publishedContent: (p.publishedContent ?? null) as WebsiteContent,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toSection(s: SectionRow): AdminWebsiteSection {
  return {
    id: s.id,
    pageId: s.pageId,
    type: s.type,
    sortOrder: s.sortOrder,
    isVisible: s.isVisible,
    draftContent: (s.draftContent ?? null) as WebsiteContent,
    publishedContent: (s.publishedContent ?? null) as WebsiteContent,
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Whether the WEBSITE module is usable for this access (enabled, has a DB). */
async function websiteReadable(access: BusinessAccess): Promise<boolean> {
  if (access.isDemo) return false; // no database in demo mode
  return isModuleEnabled("WEBSITE", access);
}

/** All website pages for the active business, ordered for navigation. */
export async function getWebsitePages(): Promise<AdminWebsitePage[]> {
  const access = await requireBusinessAccess();
  if (!(await websiteReadable(access))) return [];

  const rows = await getPrisma().websitePage.findMany({
    where: { businessId: access.businessId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toPage);
}

/**
 * A single page (by stable key) with its ordered sections — for the editor.
 * Returns null when the page does not exist within the active business.
 */
export async function getWebsitePageByKey(
  key: string,
): Promise<AdminWebsitePageWithSections | null> {
  const access = await requireBusinessAccess();
  if (!(await websiteReadable(access))) return null;

  const page = await getPrisma().websitePage.findFirst({
    // Always scoped by businessId — never resolve a page by key/id alone.
    where: { businessId: access.businessId, key },
    include: { sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!page) return null;

  return { ...toPage(page), sections: page.sections.map(toSection) };
}

/**
 * Sections for a page, scoped by business. The pageId is verified to belong to
 * the active business via the businessId filter, so another business's page id
 * can never be used to read sections.
 */
export async function getWebsiteSections(
  pageId: string,
): Promise<AdminWebsiteSection[]> {
  const access = await requireBusinessAccess();
  if (!(await websiteReadable(access))) return [];

  const rows = await getPrisma().websiteSection.findMany({
    where: { businessId: access.businessId, pageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toSection);
}
