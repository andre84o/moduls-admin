import "server-only";
import { getPrisma } from "./prisma";
import { requireBusinessAccess } from "./auth";
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
  const [properties, bookings, customers, pendingBookings] = await Promise.all([
    prisma.property.count({ where }),
    prisma.booking.count({ where }),
    prisma.customer.count({ where }),
    prisma.booking.count({ where: { ...where, status: "PENDING" } }),
  ]);

  return { properties, bookings, customers, pendingBookings };
}

export async function getProperties(): Promise<AdminProperty[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoProperties;

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
    images: p.media.map((m) => ({ id: m.id, url: m.url, alt: m.alt })),
  }));
}

export async function getBookings(): Promise<AdminBooking[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoBookings;

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