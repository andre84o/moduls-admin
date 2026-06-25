/**
 * Serializable types for the Website content module. These mirror the Prisma
 * models but keep Prisma out of any client bundle (dates as ISO strings), the
 * same convention as app/admin/types.ts. Content is freeform JSON.
 */

export type WebsitePageStatus = "DRAFT" | "PUBLISHED";

/** A JSON-serializable value — the shape stored in draft/published content. */
export type WebsiteContent =
  | string
  | number
  | boolean
  | null
  | WebsiteContent[]
  | { [key: string]: WebsiteContent };

export type AdminWebsiteSection = {
  id: string;
  pageId: string;
  type: string;
  sortOrder: number;
  isVisible: boolean;
  draftContent: WebsiteContent;
  publishedContent: WebsiteContent;
  updatedAt: string;
};

export type AdminWebsitePage = {
  id: string;
  key: string;
  slug: string | null;
  title: string;
  status: WebsitePageStatus;
  sortOrder: number;
  draftContent: WebsiteContent;
  publishedContent: WebsiteContent;
  updatedAt: string;
};

/** A page together with its ordered sections — for the page editor view. */
export type AdminWebsitePageWithSections = AdminWebsitePage & {
  sections: AdminWebsiteSection[];
};
