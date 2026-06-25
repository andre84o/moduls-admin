import "server-only";
import { getPrisma } from "./prisma";
import { requireBusinessAccess } from "./auth";
import { listMedia, type MediaItem } from "./media";
import { getEnabledModules, isModuleEnabled } from "./modules";
import {
  demoProperties,
  demoBookings,
  demoCustomers,
  demoServices,
} from "./demo-data";
import type {
  AdminProperty,
  AdminBooking,
  AdminCustomer,
  AdminService,
  DashboardStats,
} from "@/app/admin/types";

/**
 * Read functions for the admin. Each one resolves the SAFE businessId via
 * requireBusinessAccess and scopes every query by it (tenant isolation).
 * In demo mode they return seeded demo data.
 */

export async function getDashboardStats(): Promise<DashboardStats> {
  const access = await requireBusinessAccess();
  if (access.isDemo) {
    return {
      properties: demoProperties.length,
      bookings: demoBookings.length,
      customers: demoCustomers.length,
      pendingBookings: demoBookings.filter((b) => b.status === "PENDING").length,
    };
  }

  const prisma = getPrisma();
  const where = { businessId: access.businessId };
  // Resolve enabled modules once so disabled-module data never leaks into the overview.
  const modules = await getEnabledModules(access);
  const [properties, bookings, customers, pendingBookings] = await Promise.all([
    // Counts are zeroed out when the owning module is disabled for this business.
    modules.has("RENTAL") ? prisma.property.count({ where }) : Promise.resolve(0),
    modules.has("BOOKING") ? prisma.booking.count({ where }) : Promise.resolve(0),
    modules.has("CRM") ? prisma.customer.count({ where }) : Promise.resolve(0),
    modules.has("BOOKING")
      ? prisma.booking.count({ where: { ...where, status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  return { properties, bookings, customers, pendingBookings };
}

export async function getProperties(): Promise<AdminProperty[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoProperties;
  // RENTAL module gate: return empty when the module is disabled for this business.
  if (!(await isModuleEnabled("RENTAL", access))) return [];

  const rows = await getPrisma().property.findMany({
    where: { businessId: access.businessId },
    orderBy: { createdAt: "desc" },
    include: { media: { orderBy: { createdAt: "asc" } } },
  });

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    location: p.location,
    price: p.price,
    bedrooms: p.bedrooms,
    status: p.status,
    pricePerNight: p.pricePerNight,
    cleaningFee: p.cleaningFee,
    currency: p.currency,
    minNights: p.minNights,
    maxGuests: p.maxGuests,
    maxAdults: p.maxAdults,
    maxChildren: p.maxChildren,
    maxInfants: p.maxInfants,
    maxPets: p.maxPets,
    petsAllowed: p.petsAllowed,
    bufferDaysAfterCheckout: p.bufferDaysAfterCheckout,
    cancellationDeadlineDays: p.cancellationDeadlineDays,
    // Property images are website-facing (PUBLIC) so they always carry a url.
    images: p.media
      .filter((m) => m.url)
      .map((m) => ({ id: m.id, url: m.url as string, alt: m.alt })),
  }));
}

export async function getBookings(): Promise<AdminBooking[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoBookings;
  // BOOKING module gate: return empty when the module is disabled for this business.
  if (!(await isModuleEnabled("BOOKING", access))) return [];

  const rows = await getPrisma().booking.findMany({
    where: { businessId: access.businessId },
    orderBy: { startAt: "desc" },
    include: { property: true, customer: true },
  });

  return rows.map((b) => ({
    id: b.id,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    propertyTitle: b.property?.title ?? null,
    customerName: b.customer?.name ?? null,
    notes: b.notes,
  }));
}

export async function getCustomers(): Promise<AdminCustomer[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoCustomers;
  // CRM module gate: return empty when the module is disabled for this business.
  if (!(await isModuleEnabled("CRM", access))) return [];

  const rows = await getPrisma().customer.findMany({
    where: { businessId: access.businessId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    name: c.name,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    address: c.address,
    postalCode: c.postalCode,
    country: c.country,
    gender: c.gender,
    note: c.note,
    stage: c.stage,
    joinedAt: c.createdAt.toISOString(),
  }));
}

/** All media for the active business — powers the central media library. */
export async function getMedia(): Promise<MediaItem[]> {
  return listMedia();
}

export async function getServices(): Promise<AdminService[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoServices;

  const rows = await getPrisma().service.findMany({
    where: { businessId: access.businessId },
    orderBy: { name: "asc" },
  });

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    durationMin: s.durationMin,
    price: s.price,
  }));
}