import "server-only";
import { getPrisma } from "./prisma";
import { requireBusinessAccess } from "./auth";
import {
  demoProperties,
  demoBookings,
  demoCustomers,
  demoCustomerDetails,
  demoServices,
  demoCalendar,
} from "./demo-data";
import type {
  AdminProperty,
  AdminBooking,
  AdminCustomer,
  AdminCustomerDetail,
  AdminService,
  CalendarEvent,
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
    include: { _count: { select: { notes: true } } },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    stage: c.stage,
    notesCount: c._count.notes,
  }));
}

export async function getCustomerDetail(
  customerId: string,
): Promise<AdminCustomerDetail | null> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoCustomerDetails[customerId] ?? null;

  // Scoped by businessId — never load another business's customer.
  const c = await getPrisma().customer.findFirst({
    where: { id: customerId, businessId: access.businessId },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      _count: { select: { notes: true } },
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    stage: c.stage,
    notesCount: c._count.notes,
    notes: c.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
  };
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

export async function getCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEvent[]> {
  const access = await requireBusinessAccess();
  if (access.isDemo) return demoCalendar;

  const prisma = getPrisma();
  const businessId = access.businessId;

  const [bookings, blocked] = await Promise.all([
    prisma.booking.findMany({
      where: {
        businessId,
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
        status: { not: "CANCELLED" },
      },
      include: { property: true },
    }),
    prisma.blockedTime.findMany({
      where: {
        businessId,
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
      },
    }),
  ]);

  return [
    ...bookings.map((b) => ({
      id: b.id,
      kind: "booking" as const,
      title: `${b.property?.title ?? "Booking"} — ${b.guestName}`,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
    })),
    ...blocked.map((t) => ({
      id: t.id,
      kind: "blocked" as const,
      title: t.reason ?? "Blocked",
      startAt: t.startAt.toISOString(),
      endAt: t.endAt.toISOString(),
    })),
  ];
}
