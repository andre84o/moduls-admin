"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { writeAuditLog } from "@/lib/audit";
import { normalizeKey, normalizeSlug, nextSortOrder, planMissingSections } from "./utils";
import type { WebsiteContent } from "./types";
import { getHomeSections } from "@/config/home-sections";

/**
 * Mutating server actions for the Website content module.
 *
 * Every action resolves the SAFE businessId via requireModule("WEBSITE") — this
 * wraps requireBusinessAccess (session + role + tenant checks) AND blocks when
 * the WEBSITE module is disabled for the business. Updates and deletes use
 * updateMany/deleteMany filtered by businessId, so a row owned by another
 * business can never be read, written, or removed. businessId is NEVER taken
 * from the caller. All actions no-op in demo mode (no database).
 *
 * Draft vs published: the admin only ever edits `draftContent`. Publishing
 * copies draft -> published; the public renderer reads `publishedContent` only.
 */

const WEBSITE_WRITER_ROLES = ["OWNER", "ADMIN"] as const;

/**
 * Coerce a content value into a Prisma JSON input. A nullable Json column must
 * be cleared with the DbNull sentinel (not JS null), so absent/null content
 * maps to DbNull; any other JSON value passes through unchanged. Note: a JSON
 * literal `null` is normalised to SQL NULL (both read back as `null`).
 */
function toJsonInput(
  value: WebsiteContent | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

// ─── Pages ────────────────────────────────────────────────────────────

/**
 * Create a website page. `key` is normalised to a stable per-business token and
 * is unique within the business; a clash returns an error instead of throwing.
 * New pages start as DRAFT and are appended to the end of the page order.
 */
export async function createWebsitePage(input: {
  key: string;
  title: string;
  slug?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });

  const key = normalizeKey(input.key);
  const title = input.title.trim();
  if (!key) return { error: "A page key is required." };
  if (!title) return { error: "A page title is required." };
  const slug = normalizeSlug(input.slug);

  if (access.isDemo) return {};

  const prisma = getPrisma();

  // Append to the end of the existing page order for this business.
  const orders = await prisma.websitePage.findMany({
    where: { businessId: access.businessId },
    select: { sortOrder: true },
  });

  try {
    const created = await prisma.websitePage.create({
      data: {
        businessId: access.businessId,
        key,
        slug,
        title,
        sortOrder: nextSortOrder(orders.map((o) => o.sortOrder)),
      },
      select: { id: true },
    });

    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "website_page.created",
      entityType: "WebsitePage",
      entityId: created.id,
      metadata: { key },
    });
    revalidatePath("/admin");
    return { id: created.id };
  } catch (e) {
    // Unique (businessId, key) or (businessId, slug) collision — report which.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]) : [];
      if (target.some((t) => t.includes("slug"))) {
        return { error: "That slug is already in use." };
      }
      return { error: "A page with that key already exists." };
    }
    throw e;
  }
}

/**
 * Update a page's editable metadata and/or its page-level draft content. Only
 * provided fields are written. Scoped by businessId via updateMany.
 */
export async function updateWebsitePageDraft(input: {
  id: string;
  title?: string;
  slug?: string | null;
  draftContent?: WebsiteContent;
}): Promise<{ error?: string }> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  const id = input.id.trim();
  if (!id) return { error: "Missing page id." };
  if (access.isDemo) return {};

  const data: Prisma.WebsitePageUpdateManyMutationInput = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "A page title is required." };
    data.title = title;
  }
  if (input.slug !== undefined) data.slug = normalizeSlug(input.slug);
  if (input.draftContent !== undefined) data.draftContent = toJsonInput(input.draftContent);

  // count === 0 means the id is not in this business — never log a phantom edit.
  const { count } = await getPrisma().websitePage.updateMany({
    where: { id, businessId: access.businessId },
    data,
  });
  if (count === 0) return { error: "Page not found." };

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_page.draft_updated",
    entityType: "WebsitePage",
    entityId: id,
  });
  revalidatePath("/admin");
  return {};
}

/**
 * Publish a page: copy its draft content into published, mark it PUBLISHED, and
 * publish every section under it (draft -> published). All writes are scoped by
 * businessId and run in one transaction so the page never goes live partially.
 */
export async function publishWebsitePage(id: string): Promise<{ error?: string }> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  if (access.isDemo) return {};

  const prisma = getPrisma();
  const page = await prisma.websitePage.findFirst({
    where: { id, businessId: access.businessId },
    select: {
      draftContent: true,
      sections: { select: { id: true, draftContent: true } },
    },
  });
  if (!page) return { error: "Page not found." };

  await prisma.$transaction([
    prisma.websitePage.updateMany({
      where: { id, businessId: access.businessId },
      data: {
        status: "PUBLISHED",
        publishedContent: toJsonInput(page.draftContent as WebsiteContent),
      },
    }),
    ...page.sections.map((s) =>
      prisma.websiteSection.updateMany({
        where: { id: s.id, businessId: access.businessId },
        data: { publishedContent: toJsonInput(s.draftContent as WebsiteContent) },
      }),
    ),
  ]);

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_page.published",
    entityType: "WebsitePage",
    entityId: id,
    metadata: { sections: page.sections.length },
  });
  revalidatePath("/admin");
  return {};
}

/** Delete a page and (via cascade) its sections. Scoped by businessId. */
export async function deleteWebsitePage(id: string): Promise<void> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  if (access.isDemo) return;

  const { count } = await getPrisma().websitePage.deleteMany({
    where: { id, businessId: access.businessId },
  });
  if (count === 0) return; // foreign/unknown id — nothing deleted, nothing to log

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_page.deleted",
    entityType: "WebsitePage",
    entityId: id,
  });
  revalidatePath("/admin");
}

// ─── Sections ─────────────────────────────────────────────────────────

/**
 * Create a section on a page. The pageId is verified to belong to the active
 * business before anything is written, so a foreign page id is rejected. The
 * section is appended to the end of the page's section order.
 */
export async function createWebsiteSection(input: {
  pageId: string;
  type: string;
  draftContent?: WebsiteContent;
}): Promise<{ id?: string; error?: string }> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });

  const pageId = input.pageId.trim();
  const type = input.type.trim();
  if (!pageId) return { error: "Missing page id." };
  if (!type) return { error: "A section type is required." };
  if (access.isDemo) return {};

  const prisma = getPrisma();

  // Verify the page belongs to this business before attaching a section to it.
  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, businessId: access.businessId },
    select: { id: true },
  });
  if (!page) return { error: "Page not found." };

  const orders = await prisma.websiteSection.findMany({
    where: { businessId: access.businessId, pageId },
    select: { sortOrder: true },
  });

  const created = await prisma.websiteSection.create({
    data: {
      businessId: access.businessId,
      pageId,
      type,
      sortOrder: nextSortOrder(orders.map((o) => o.sortOrder)),
      draftContent: toJsonInput(input.draftContent),
    },
    select: { id: true },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_section.created",
    entityType: "WebsiteSection",
    entityId: created.id,
    metadata: { pageId, type },
  });
  revalidatePath("/admin");
  return { id: created.id };
}

/**
 * Update a section's draft content (and optionally its type/visibility). This
 * is the primary editor write. Only provided fields change. Scoped by
 * businessId via updateMany — the live `publishedContent` is left untouched
 * until the section (or its page) is published.
 */
export async function updateWebsiteSectionDraft(input: {
  id: string;
  draftContent?: WebsiteContent;
  type?: string;
  isVisible?: boolean;
}): Promise<{ error?: string }> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  const id = input.id.trim();
  if (!id) return { error: "Missing section id." };
  if (access.isDemo) return {};

  const data: Prisma.WebsiteSectionUpdateManyMutationInput = {};
  if (input.draftContent !== undefined) data.draftContent = toJsonInput(input.draftContent);
  if (input.type !== undefined) {
    const type = input.type.trim();
    if (!type) return { error: "A section type is required." };
    data.type = type;
  }
  if (input.isVisible !== undefined) data.isVisible = input.isVisible;

  const { count } = await getPrisma().websiteSection.updateMany({
    where: { id, businessId: access.businessId },
    data,
  });
  if (count === 0) return { error: "Section not found." };

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_section.draft_updated",
    entityType: "WebsiteSection",
    entityId: id,
  });
  revalidatePath("/admin");
  return {};
}

/** Show/hide a section. Scoped by businessId. */
export async function setWebsiteSectionVisibility(
  id: string,
  isVisible: boolean,
): Promise<void> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  if (access.isDemo) return;

  const { count } = await getPrisma().websiteSection.updateMany({
    where: { id, businessId: access.businessId },
    data: { isVisible },
  });
  if (count === 0) return; // foreign/unknown id — nothing changed

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_section.visibility_changed",
    entityType: "WebsiteSection",
    entityId: id,
    metadata: { isVisible },
  });
  revalidatePath("/admin");
}

/**
 * Publish a single section: copy its draft content into published. The draft is
 * read scoped by businessId first, so a foreign section id resolves to nothing
 * and nothing is written.
 */
export async function publishWebsiteSection(id: string): Promise<{ error?: string }> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  if (access.isDemo) return {};

  const prisma = getPrisma();
  const section = await prisma.websiteSection.findFirst({
    where: { id, businessId: access.businessId },
    select: { draftContent: true },
  });
  if (!section) return { error: "Section not found." };

  await prisma.websiteSection.updateMany({
    where: { id, businessId: access.businessId },
    data: { publishedContent: toJsonInput(section.draftContent as WebsiteContent) },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_section.published",
    entityType: "WebsiteSection",
    entityId: id,
  });
  revalidatePath("/admin");
  return {};
}

/** Delete a section. Scoped by businessId. */
export async function deleteWebsiteSection(id: string): Promise<void> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  if (access.isDemo) return;

  const { count } = await getPrisma().websiteSection.deleteMany({
    where: { id, businessId: access.businessId },
  });
  if (count === 0) return; // foreign/unknown id — nothing deleted

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "website_section.deleted",
    entityType: "WebsiteSection",
    entityId: id,
  });
  revalidatePath("/admin");
}

// ─── Seeding ──────────────────────────────────────────────────────────

export type SyncHomeResult = {
  createdPage: boolean;
  createdSections: number;
  skippedSections: number;
  error?: string;
};

/**
 * CREATE-MISSING-ONLY seed of the default Home page from config. Initializes the
 * WebsitePage with key "home" and its default sections from getHomeSections() so
 * the admin editor starts with editable content. Each config section's props are
 * stored as BOTH draftContent and publishedContent on first creation.
 *
 * Safety:
 *  - Never overwrites: an existing home page keeps its status/content untouched;
 *    only sections whose `type` is genuinely missing are created (see
 *    planMissingSections). Re-running only restores missing defaults.
 *  - No deletes. Writes only website_pages / website_sections, scoped to the
 *    server-resolved businessId (never trusted from the client). WEBSITE module
 *    guard enforced via requireModule. Page create + section creates run in one
 *    transaction so a page is never left half-seeded.
 *  - A freshly created page is PUBLISHED so its seeded publishedContent goes
 *    live — output is identical to the config the public home already renders.
 */
export async function syncDefaultHomeWebsiteContent(): Promise<SyncHomeResult> {
  const access = await requireModule("WEBSITE", { allowedRoles: [...WEBSITE_WRITER_ROLES] });
  if (access.isDemo) {
    return { createdPage: false, createdSections: 0, skippedSections: 0 };
  }

  // Config is the seed source. props are plain JSON (Phase 8F confirmed the
  // shape matches each section's renderer props and the editor's field shape).
  const configSections = getHomeSections().map((s) => ({
    type: s.type,
    content: s.props as WebsiteContent,
  }));

  const prisma = getPrisma();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Resolve the home page within THIS business, with its existing sections.
      const existingPage = await tx.websitePage.findFirst({
        where: { businessId: access.businessId, key: "home" },
        select: {
          id: true,
          sections: { select: { type: true, sortOrder: true } },
        },
      });

      let pageId: string;
      let createdPage = false;
      let existingSections: { type: string; sortOrder: number }[];

      if (existingPage) {
        pageId = existingPage.id;
        existingSections = existingPage.sections;
      } else {
        // Append the new page after any existing pages in this business.
        const orders = await tx.websitePage.findMany({
          where: { businessId: access.businessId },
          select: { sortOrder: true },
        });
        const created = await tx.websitePage.create({
          data: {
            businessId: access.businessId,
            key: "home",
            title: "Home",
            status: "PUBLISHED",
            sortOrder: nextSortOrder(orders.map((o) => o.sortOrder)),
          },
          select: { id: true },
        });
        pageId = created.id;
        createdPage = true;
        existingSections = [];
      }

      const plan = planMissingSections(configSections, existingSections);
      for (const s of plan) {
        await tx.websiteSection.create({
          data: {
            businessId: access.businessId,
            pageId,
            type: s.type,
            sortOrder: s.sortOrder,
            isVisible: true,
            draftContent: toJsonInput(s.content),
            publishedContent: toJsonInput(s.content),
          },
        });
      }

      return {
        pageId,
        createdPage,
        createdSections: plan.length,
        skippedSections: configSections.length - plan.length,
      };
    });

    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "website_home.seeded",
      entityType: "WebsitePage",
      entityId: result.pageId,
      metadata: {
        createdPage: result.createdPage,
        createdSections: result.createdSections,
        skippedSections: result.skippedSections,
      },
    });
    revalidatePath("/admin");
    return {
      createdPage: result.createdPage,
      createdSections: result.createdSections,
      skippedSections: result.skippedSections,
    };
  } catch (e) {
    // Concurrent seed created the home page first (unique businessId+key) — not
    // an error worth surfacing as a crash; report it cleanly.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        createdPage: false,
        createdSections: 0,
        skippedSections: configSections.length,
        error: "Home content already exists — nothing to create.",
      };
    }
    throw e;
  }
}
