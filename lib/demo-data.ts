// Demo data used only when no real database is configured (demo mode), so the
// admin UI is fully browsable locally. Conceptually all scoped to the demo
// business. Replace by configuring DATABASE_URL + Supabase to go live.

import type {
  AdminProperty,
  AdminBooking,
  AdminCustomer,
  AdminService,
} from "@/app/admin/types";

function at(dayOffset: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Booking money below is in MINOR units (öre/cents), matching the schema.
export const demoProperties: AdminProperty[] = [
  {
    id: "demo-p1",
    title: "Casa del Sol",
    location: "Marbella, Spain",
    price: 320,
    bedrooms: 3,
    status: "PUBLISHED",
    pricePerNight: 32000,
    cleaningFee: 5000,
    currency: "eur",
    minNights: 3,
    maxGuests: 6,
    maxAdults: 4,
    maxChildren: 2,
    maxInfants: 1,
    maxPets: 1,
    petsAllowed: true,
    bufferDaysAfterCheckout: 1,
    cancellationDeadlineDays: 7,
    images: [],
  },
  {
    id: "demo-p2",
    title: "Villa Azul",
    location: "Nerja, Spain",
    price: 410,
    bedrooms: 4,
    status: "PUBLISHED",
    pricePerNight: 41000,
    cleaningFee: 7500,
    currency: "eur",
    minNights: 5,
    maxGuests: 8,
    maxAdults: 6,
    maxChildren: 2,
    maxInfants: 2,
    maxPets: 0,
    petsAllowed: false,
    bufferDaysAfterCheckout: 1,
    cancellationDeadlineDays: 14,
    images: [],
  },
  {
    id: "demo-p3",
    title: "Apartamento Centro",
    location: "Málaga, Spain",
    price: 150,
    bedrooms: 1,
    status: "DRAFT",
    pricePerNight: 15000,
    cleaningFee: 3000,
    currency: "eur",
    minNights: 2,
    maxGuests: 2,
    maxAdults: 2,
    maxChildren: 0,
    maxInfants: 0,
    maxPets: 0,
    petsAllowed: false,
    bufferDaysAfterCheckout: 0,
    cancellationDeadlineDays: null,
    images: [],
  },
];

export const demoCustomers: AdminCustomer[] = [
  {
    id: "demo-c1",
    number: 1,
    name: "Anna Lind",
    firstName: "Anna",
    lastName: "Lind",
    email: "anna@example.com",
    phone: "+46 70 111 22 33",
    mobile: "+46 70 111 22 33",
    address: "Storgatan 1",
    postalCode: "111 22",
    country: "Sweden",
    gender: "Female",
    note: "Returning guest — prefers Casa del Sol.",
    stage: "CUSTOMER",
    joinedAt: at(-40, 9).toISOString(),
  },
  {
    id: "demo-c2",
    number: 2,
    name: "Marco Rossi",
    firstName: "Marco",
    lastName: "Rossi",
    email: "marco@example.com",
    phone: null,
    mobile: null,
    address: null,
    postalCode: null,
    country: "Italy",
    gender: "Male",
    note: null,
    stage: "CONTACTED",
    joinedAt: at(-20, 9).toISOString(),
  },
  {
    id: "demo-c3",
    number: 3,
    name: "Sofia Berg",
    firstName: "Sofia",
    lastName: "Berg",
    email: "sofia@example.com",
    phone: null,
    mobile: null,
    address: null,
    postalCode: null,
    country: null,
    gender: null,
    note: null,
    stage: "LEAD",
    joinedAt: at(-5, 9).toISOString(),
  },
];

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
