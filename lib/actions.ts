"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "./prisma";
import { requireBusinessAccess } from "./auth";
import { writeAuditLog } from "./audit";
import { notifyBooking } from "./email";
import { createMediaRecord, deleteMediaRecord } from "./media";
import type {
  BookingStatus,
  PropertyStatus,
} from "@/app/generated/prisma/enums";

/**
 * Mutating server actions for the admin. Every action resolves the SAFE
 * businessId via requireBusinessAccess and scopes writes by it. Updates and
 * deletes use updateMany/deleteMany with businessId so a row from another
 * business can never be touched. No-ops in demo mode.
 */

// ─── Properties (bostäder) ────────────────────────────────────────────

export async function createProperty(formData: FormData) {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "ADMIN"] });

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  if (!title || !location) return;

  const price = String(formData.get("price") ?? "");
  const bedrooms = String(formData.get("bedrooms") ?? "");

  if (access.isDemo) return;

  const created = await getPrisma().property.create({
    data: {
      businessId: access.businessId,
      title,
      location,
      price: price ? Number(price) : null,
      bedrooms: bedrooms ? Number(bedrooms) : null,
    },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "property.created",
    entityType: "Property",
    entityId: created.id,
  });
  revalidatePath("/admin");
}

export async function setPropertyStatus(id: string, status: PropertyStatus) {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "ADMIN"] });
  if (access.isDemo) return;

  await getPrisma().property.updateMany({
    where: { id, businessId: access.businessId },
    data: { status },
  });
  revalidatePath("/admin");
}

export async function deleteProperty(id: string) {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "ADMIN"] });
  if (access.isDemo) return;

  await getPrisma().property.deleteMany({
    where: { id, businessId: access.businessId },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "property.deleted",
    entityType: "Property",
    entityId: id,
  });
  revalidatePath("/admin");
}

// ─── Images ───────────────────────────────────────────────────────────

export async function uploadPropertyImage(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const file = formData.get("file");
  if (!propertyId || !(file instanceof File) || file.size === 0) return;

  // Attach via the central media service: it verifies the property belongs to
  // this business, compresses the image, stores it and writes the audit log.
  await createMediaRecord({
    file,
    propertyId,
    ownerType: "Property",
    ownerId: propertyId,
    folder: "properties",
    alt: String(formData.get("alt") ?? "") || null,
    allowedRoles: ["OWNER", "ADMIN", "STAFF"],
  });
  revalidatePath("/admin");
}

export async function deleteMedia(id: string) {
  await deleteMediaRecord(id);
  revalidatePath("/admin");
}

// ─── CRM ──────────────────────────────────────────────────────────────

/**
 * Create a new customer or update an existing one's contact details.
 * The freeform note is saved separately via updateCustomerNote(). Updates use
 * updateMany scoped by businessId so another business's row can't be touched.
 */
export async function upsertCustomer(formData: FormData) {
  const access = await requireBusinessAccess();

  const id = String(formData.get("id") ?? "").trim() || null;
  const firstName = String(formData.get("firstName") ?? "").trim() || null;
  const lastName = String(formData.get("lastName") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const mobile = String(formData.get("mobile") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const postalCode = String(formData.get("postalCode") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;

  // `name` is the canonical display name used elsewhere (e.g. bookings).
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!name) return; // a customer needs at least a first or last name

  const fields = {
    firstName,
    lastName,
    email,
    phone,
    mobile,
    address,
    postalCode,
    country,
    gender,
  };

  if (access.isDemo) return;

  if (id) {
    await getPrisma().customer.updateMany({
      where: { id, businessId: access.businessId },
      data: { name, ...fields },
    });
    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "customer.updated",
      entityType: "Customer",
      entityId: id,
    });
  } else {
    // Assign the next per-business customer number atomically. The unique
    // constraint on (businessId, number) is the final guard against races.
    const created = await getPrisma().$transaction(async (tx) => {
      const max = await tx.customer.aggregate({
        where: { businessId: access.businessId },
        _max: { number: true },
      });
      return tx.customer.create({
        data: {
          businessId: access.businessId,
          number: (max._max.number ?? 0) + 1,
          name,
          ...fields,
        },
      });
    });
    await writeAuditLog({
      businessId: access.businessId,
      userId: access.userId,
      action: "customer.created",
      entityType: "Customer",
      entityId: created.id,
    });
  }

  revalidatePath("/admin");
}

/** Save the freeform admin note for a customer (separate from contact details). */
export async function updateCustomerNote(formData: FormData) {
  const access = await requireBusinessAccess();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (access.isDemo) return;

  await getPrisma().customer.updateMany({
    where: { id, businessId: access.businessId },
    data: { note },
  });
  revalidatePath("/admin");
}

export async function deleteCustomer(id: string) {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "ADMIN"] });
  if (access.isDemo) return;

  await getPrisma().customer.deleteMany({
    where: { id, businessId: access.businessId },
  });
  revalidatePath("/admin");
}

// ─── Bookings + calendar ──────────────────────────────────────────────

export async function createBooking(formData: FormData) {
  const access = await requireBusinessAccess();

  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim() || null;
  const propertyId = String(formData.get("propertyId") ?? "") || null;
  const startRaw = String(formData.get("startAt") ?? "");
  const endRaw = String(formData.get("endAt") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!guestName || !startRaw || !endRaw) return;

  const startAt = new Date(startRaw);
  const endAt = new Date(endRaw);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return;
  if (endAt <= startAt) return; // validate range server-side

  if (access.isDemo) return;

  const prisma = getPrisma();

  // If a property is given, verify it belongs to this business.
  let propertyTitle: string | null = null;
  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, businessId: access.businessId },
      select: { title: true },
    });
    if (!property) return;
    propertyTitle = property.title;

    // Prevent double booking for the same property (server-side conflict check).
    const conflict = await prisma.booking.findFirst({
      where: {
        businessId: access.businessId,
        propertyId,
        status: { notIn: ["CANCELLED", "DECLINED"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (conflict) {
      return { error: "Those dates overlap an existing booking." };
    }
  }

  const created = await prisma.booking.create({
    data: {
      businessId: access.businessId,
      propertyId,
      guestName,
      guestEmail,
      startAt,
      endAt,
      notes,
    },
  });

  // Notify the customer and the business admin.
  const business = await prisma.business.findUnique({
    where: { id: access.businessId },
    select: { name: true, email: true },
  });
  await notifyBooking({
    businessId: access.businessId,
    businessName: business?.name ?? "Admin",
    adminEmail: business?.email ?? process.env.ADMIN_EMAIL ?? null,
    guestName,
    guestEmail,
    what: propertyTitle ?? "Booking",
    when: `${startAt.toLocaleString()} – ${endAt.toLocaleString()}`,
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "booking.created",
    entityType: "Booking",
    entityId: created.id,
  });
  revalidatePath("/admin");
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  const access = await requireBusinessAccess();
  if (access.isDemo) return;

  await getPrisma().booking.updateMany({
    where: { id, businessId: access.businessId },
    data: { status },
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "booking.status_changed",
    entityType: "Booking",
    entityId: id,
    metadata: { status },
  });
  revalidatePath("/admin");
}

export async function deleteBooking(id: string) {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "ADMIN"] });
  if (access.isDemo) return;

  await getPrisma().booking.deleteMany({
    where: { id, businessId: access.businessId },
  });
  revalidatePath("/admin");
}

export async function addBlockedTime(formData: FormData) {
  const access = await requireBusinessAccess({ allowedRoles: ["OWNER", "ADMIN"] });

  const startRaw = String(formData.get("startAt") ?? "");
  const endRaw = String(formData.get("endAt") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!startRaw || !endRaw) return;

  const startAt = new Date(startRaw);
  const endAt = new Date(endRaw);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return;
  if (endAt <= startAt) return;

  if (access.isDemo) return;

  await getPrisma().blockedTime.create({
    data: { businessId: access.businessId, startAt, endAt, reason },
  });
  revalidatePath("/admin");
}
