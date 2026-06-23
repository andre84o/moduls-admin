import "server-only";
import { getPrisma } from "./prisma";
import { requireBusinessAccess, type BusinessAccess } from "./auth";
import { writeAuditLog } from "./audit";
import {
  uploadBusinessFile,
  deleteBusinessFile,
  deleteAllBusinessFiles,
  signedUrlMap,
  signedUrlFor,
  classifyFile,
  type MediaVisibility,
} from "./storage";
import type { MemberRole } from "@/app/generated/prisma/enums";
import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Central media service — the one place the whole app uploads, lists and
 * deletes files (images + documents). Reusable from any feature: pass an
 * (ownerType, ownerId) pair to attach media to any whitelisted entity.
 *
 * SECURITY (CLAUDE.md, multi-tenant):
 *  - The businessId is always resolved server-side from the session +
 *    BusinessMember. It is never accepted from the client.
 *  - ownerType / ownerId / folder are untrusted input. ownerType is checked
 *    against OWNER_TYPES and ownerId is verified to belong to the resolved
 *    business BEFORE any create or list. folder is sanitized.
 *  - Visibility (public vs private storage) is decided server-side. Documents
 *    are always private. Private files are read through short-lived signed URLs.
 *  - Reads/deletes are always scoped by id + businessId — never id alone.
 *
 * Server-only: never import this into a client component.
 */

/** Serializable media row safe to pass to client components (no storage path). */
export type MediaItem = {
  id: string;
  kind: "IMAGE" | "DOCUMENT";
  visibility: MediaVisibility;
  folder: string;
  name: string | null;
  /** Public permanent URL, or a freshly minted signed URL for private files. */
  url: string | null;
  type: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  ownerType: string | null;
  ownerId: string | null;
  propertyId: string | null;
  createdAt: string;
};

const DEFAULT_ROLES: MemberRole[] = ["OWNER", "ADMIN", "STAFF"];

/**
 * Whitelist of attach targets. Each verifier confirms that `ownerId` belongs to
 * the resolved business — the guard against attaching/listing media against
 * another tenant's entity. Add new attachable entities here, never inline.
 */
const OWNER_TYPES: Record<
  string,
  (prisma: PrismaClient, businessId: string, ownerId: string) => Promise<boolean>
> = {
  Property: async (prisma, businessId, ownerId) =>
    Boolean(
      await prisma.property.findFirst({
        where: { id: ownerId, businessId },
        select: { id: true },
      }),
    ),
  Customer: async (prisma, businessId, ownerId) =>
    Boolean(
      await prisma.customer.findFirst({
        where: { id: ownerId, businessId },
        select: { id: true },
      }),
    ),
  Project: async (prisma, businessId, ownerId) =>
    Boolean(
      await prisma.project.findFirst({
        where: { id: ownerId, businessId },
        select: { id: true },
      }),
    ),
  // Business-level assets (logos, website media). ownerId must BE the business.
  Business: async (_prisma, businessId, ownerId) => ownerId === businessId,
};

/** ownerTypes whose images may live in the PUBLIC bucket (website-facing). */
const PUBLIC_OWNER_TYPES = new Set(["Property", "Business"]);
/** Folders whose images may live in the PUBLIC bucket. */
const PUBLIC_FOLDERS = new Set(["logos", "website", "public"]);

/** Strip a client-supplied folder to a safe slug (no traversal, no surprises). */
function sanitizeFolder(folder: string | null | undefined): string {
  const slug = (folder ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "general";
}

/**
 * Decide storage visibility server-side. Documents are always private; images
 * are public only in explicitly website-facing contexts. The client never gets
 * to make something public on its own.
 */
function decideVisibility(input: {
  kind: "IMAGE" | "DOCUMENT";
  ownerType: string | null;
  folder: string;
}): MediaVisibility {
  if (input.kind === "DOCUMENT") return "PRIVATE";
  if (input.ownerType && PUBLIC_OWNER_TYPES.has(input.ownerType)) return "PUBLIC";
  if (PUBLIC_FOLDERS.has(input.folder)) return "PUBLIC";
  return "PRIVATE";
}

/**
 * Validate an attach target. Throws on an unknown ownerType or an ownerId that
 * does not belong to the business. A bare ownerType with no ownerId is rejected.
 */
async function assertOwner(
  prisma: PrismaClient,
  businessId: string,
  ownerType: string | null,
  ownerId: string | null,
): Promise<void> {
  if (!ownerType && !ownerId) return; // unattached / general library item
  if (!ownerType || !ownerId) {
    throw new Error("Both ownerType and ownerId are required to attach media.");
  }
  const verify = OWNER_TYPES[ownerType];
  if (!verify) throw new Error(`Unknown media ownerType: ${ownerType}`);
  if (!(await verify(prisma, businessId, ownerId))) {
    throw new Error("Attach target does not belong to this business.");
  }
}

type MediaRow = {
  id: string;
  kind: "IMAGE" | "DOCUMENT";
  visibility: MediaVisibility;
  folder: string;
  name: string | null;
  url: string | null;
  path: string;
  type: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  ownerType: string | null;
  ownerId: string | null;
  propertyId: string | null;
  createdAt: Date;
};

function toMediaItem(row: MediaRow, signedUrl?: string | null): MediaItem {
  return {
    id: row.id,
    kind: row.kind,
    visibility: row.visibility,
    folder: row.folder,
    name: row.name,
    // PUBLIC files keep their permanent url; PRIVATE files only ever surface a
    // freshly signed, short-lived url (never a permanent public link).
    url: row.visibility === "PUBLIC" ? row.url : (signedUrl ?? null),
    type: row.type,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    propertyId: row.propertyId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Where-filter for scoping a media query to an attach target. */
export type MediaFilter = {
  kind?: "IMAGE" | "DOCUMENT";
  folder?: string;
  ownerType?: string;
  ownerId?: string;
  propertyId?: string;
};

/**
 * Upload a file and create its Media record, scoped to the caller's business.
 * Returns null in demo mode or when storage isn't configured.
 */
export async function createMediaRecord(opts: {
  file: File;
  folder?: string;
  alt?: string | null;
  ownerType?: string | null;
  ownerId?: string | null;
  propertyId?: string | null;
  allowedRoles?: MemberRole[];
  access?: BusinessAccess;
}): Promise<MediaItem | null> {
  const access =
    opts.access ??
    (await requireBusinessAccess({ allowedRoles: opts.allowedRoles ?? DEFAULT_ROLES }));

  if (access.isDemo) return null;

  const prisma = getPrisma();
  const businessId = access.businessId;

  const ownerType = opts.ownerType?.trim() || null;
  const ownerId = opts.ownerId?.trim() || null;
  const folder = sanitizeFolder(opts.folder);

  // Untrusted attach target: verify it belongs to this business.
  await assertOwner(prisma, businessId, ownerType, ownerId);

  // A typed Property attachment must also belong to this business.
  if (opts.propertyId) {
    const ok = await prisma.property.findFirst({
      where: { id: opts.propertyId, businessId },
      select: { id: true },
    });
    if (!ok) throw new Error("Property does not belong to this business.");
  }

  const kind = classifyFile(opts.file.type);
  const visibility = decideVisibility({ kind, ownerType, folder });

  const stored = await uploadBusinessFile({ businessId, file: opts.file, visibility });
  if (!stored) return null;

  const row = await prisma.media.create({
    data: {
      businessId,
      propertyId: opts.propertyId ?? null,
      ownerType,
      ownerId,
      kind: stored.kind,
      visibility: stored.visibility,
      folder,
      name: stored.name,
      url: stored.url,
      path: stored.path,
      type: stored.type,
      size: stored.size,
      width: stored.width,
      height: stored.height,
      alt: opts.alt?.trim() || null,
    },
  });

  await writeAuditLog({
    businessId,
    userId: access.userId,
    action: "media.uploaded",
    entityType: "Media",
    entityId: row.id,
    metadata: { kind: stored.kind, visibility: stored.visibility, folder },
  });

  // Hand back an immediately-usable url (signed for private).
  const signed =
    stored.visibility === "PRIVATE" ? await signedUrlFor("PRIVATE", row.path) : null;
  return toMediaItem(row, signed);
}

/** List media for the caller's business, optionally filtered by attach target. */
export async function listMedia(
  filter: MediaFilter = {},
  allowedRoles: MemberRole[] = DEFAULT_ROLES,
): Promise<MediaItem[]> {
  const access = await requireBusinessAccess({ allowedRoles });
  if (access.isDemo) return [];

  const prisma = getPrisma();

  // If filtering by an attach target, validate it against this business first.
  if (filter.ownerType || filter.ownerId) {
    await assertOwner(
      prisma,
      access.businessId,
      filter.ownerType ?? null,
      filter.ownerId ?? null,
    );
  }
  if (filter.propertyId) {
    const ok = await prisma.property.findFirst({
      where: { id: filter.propertyId, businessId: access.businessId },
      select: { id: true },
    });
    if (!ok) return [];
  }

  const rows = await prisma.media.findMany({
    where: {
      businessId: access.businessId,
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.folder ? { folder: sanitizeFolder(filter.folder) } : {}),
      ...(filter.ownerType ? { ownerType: filter.ownerType } : {}),
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Batch-sign all private files in one request.
  const privatePaths = rows
    .filter((r) => r.visibility === "PRIVATE")
    .map((r) => r.path);
  const signed = await signedUrlMap(privatePaths);

  return rows.map((r) =>
    toMediaItem(r, r.visibility === "PRIVATE" ? signed.get(r.path) : null),
  );
}

/** Convenience: all media attached to a given (whitelisted) entity. */
export function getMediaFor(
  ownerType: string,
  ownerId: string,
): Promise<MediaItem[]> {
  return listMedia({ ownerType, ownerId });
}

/**
 * Delete a media row + its stored file, scoped by id + businessId so a row from
 * another business can never be removed. Returns true if something was deleted.
 */
export async function deleteMediaRecord(
  id: string,
  allowedRoles: MemberRole[] = ["OWNER", "ADMIN"],
): Promise<boolean> {
  const access = await requireBusinessAccess({ allowedRoles });
  if (access.isDemo) return false;

  const prisma = getPrisma();

  // Resolve the file (path + bucket) scoped by businessId, then remove both.
  const media = await prisma.media.findFirst({
    where: { id, businessId: access.businessId },
    select: { id: true, path: true, visibility: true },
  });
  if (!media) return false;

  await deleteBusinessFile(media.visibility, media.path);
  await prisma.media.deleteMany({ where: { id, businessId: access.businessId } });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "media.deleted",
    entityType: "Media",
    entityId: id,
  });

  return true;
}

// ─── Full-tenant export / erasure (data portability + GDPR) ───────────────

/**
 * Export every media record for a business (metadata + signed download URLs).
 * Platform/owner operation — restricted to OWNER and SUPER_ADMIN.
 */
export async function exportBusinessMedia(): Promise<MediaItem[]> {
  return listMedia({}, ["OWNER", "SUPER_ADMIN"]);
}

/**
 * Permanently delete ALL media for a business: every stored file under
 * businesses/{businessId}/ in both buckets, then every Media row. Scoped by
 * businessId. Restricted to OWNER and SUPER_ADMIN. Returns counts.
 */
export async function purgeBusinessMedia(): Promise<{
  files: number;
  rows: number;
}> {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "SUPER_ADMIN"] });
  if (access.isDemo) return { files: 0, rows: 0 };

  const files = await deleteAllBusinessFiles(access.businessId);
  const { count } = await getPrisma().media.deleteMany({
    where: { businessId: access.businessId },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "media.purged",
    entityType: "Business",
    entityId: access.businessId,
    metadata: { files, rows: count },
  });

  return { files, rows: count };
}

export { classifyFile };
