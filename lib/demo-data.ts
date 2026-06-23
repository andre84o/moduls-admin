// Demo data used only when no real database is configured (demo mode), so the
// admin UI is fully browsable locally. Conceptually all scoped to the demo
// business. Replace by configuring DATABASE_URL + Supabase to go live.

import type {
  AdminProperty,
  AdminBooking,
  AdminCustomer,
  AdminCustomerDetail,
  AdminService,
  CalendarEvent,
} from "@/app/admin/types";

function at(dayOffset: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export const demoProperties: AdminProperty[] = [
  {
    id: "demo-p1",
    title: "Casa del Sol",
    location: "Marbella, Spain",
    price: 320,
    bedrooms: 3,
    status: "PUBLISHED",
    images: [],
  },
  {
    id: "demo-p2",
    title: "Villa Azul",
    location: "Nerja, Spain",
    price: 410,
    bedrooms: 4,
    status: "PUBLISHED",
    images: [],
  },
  {
    id: "demo-p3",
    title: "Apartamento Centro",
    location: "Málaga, Spain",
    price: 150,
    bedrooms: 1,
    status: "DRAFT",
    images: [],
  },
];

export const demoCustomers: AdminCustomer[] = [
  { id: "demo-c1", name: "Anna Lind", email: "anna@example.com", phone: "+46 70 111 22 33", stage: "CUSTOMER", notesCount: 1 },
  { id: "demo-c2", name: "Marco Rossi", email: "marco@example.com", phone: null, stage: "CONTACTED", notesCount: 0 },
  { id: "demo-c3", name: "Sofia Berg", email: "sofia@example.com", phone: null, stage: "LEAD", notesCount: 0 },
];

export const demoCustomerDetails: Record<string, AdminCustomerDetail> = {
  "demo-c1": {
    ...demoCustomers[0],
    notes: [
      { id: "demo-n1", body: "Returning guest — prefers Casa del Sol.", createdAt: at(-10, 9).toISOString() },
    ],
  },
};

export const demoServices: AdminService[] = [
  { id: "demo-s1", name: "Cleaning", durationMin: 120, price: 60 },
  { id: "demo-s2", name: "Airport transfer", durationMin: 90, price: 80 },
];

export const demoBookings: AdminBooking[] = [
  {
    id: "demo-b1",
    guestName: "Anna Lind",
    guestEmail: "anna@example.com",
    startAt: at(2, 15).toISOString(),
    endAt: at(9, 11).toISOString(),
    status: "CONFIRMED",
    propertyTitle: "Casa del Sol",
    customerName: "Anna Lind",
    notes: null,
  },
  {
    id: "demo-b2",
    guestName: "Marco Rossi",
    guestEmail: "marco@example.com",
    startAt: at(5, 14).toISOString(),
    endAt: at(12, 11).toISOString(),
    status: "PENDING",
    propertyTitle: "Villa Azul",
    customerName: "Marco Rossi",
    notes: "Asked about a late checkout.",
  },
];

export const demoCalendar: CalendarEvent[] = [
  ...demoBookings.map((b) => ({
    id: b.id,
    kind: "booking" as const,
    title: `${b.propertyTitle ?? "Booking"} — ${b.guestName}`,
    startAt: b.startAt,
    endAt: b.endAt,
    status: b.status,
  })),
  {
    id: "demo-blk1",
    kind: "blocked" as const,
    title: "Maintenance",
    startAt: at(7, 8).toISOString(),
    endAt: at(7, 17).toISOString(),
  },
];
