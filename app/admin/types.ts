// Serializable types passed from server components to the client sections.
// They mirror the Prisma models but keep Prisma out of the client bundle.
// Dates are passed as ISO strings.

export type BookingStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";
export type CustomerStage = "LEAD" | "CONTACTED" | "CUSTOMER";
export type PropertyStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminMediaItem = {
  id: string;
  url: string;
  alt: string | null;
};

export type AdminProperty = {
  id: string;
  title: string;
  location: string;
  price: number | null;
  bedrooms: number | null;
  status: PropertyStatus;
  // RENTAL booking settings. Money fields are in MINOR units (öre/cents).
  pricePerNight: number | null;
  cleaningFee: number | null;
  currency: string;
  minNights: number;
  maxGuests: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  maxInfants: number | null;
  maxPets: number | null;
  petsAllowed: boolean;
  bufferDaysAfterCheckout: number;
  cancellationDeadlineDays: number | null;
  images: AdminMediaItem[];
};

export type AdminBooking = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  // Linked customer details (scoped to the same business via the relation).
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  propertyTitle: string | null;
  startAt: string;
  endAt: string;
  // Stay length + guest breakdown.
  nights: number | null;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  status: BookingStatus;
  // Payment snapshot. totalAmount is in MINOR units (öre/cents).
  paid: boolean;
  totalAmount: number | null;
  currency: string;
  stripeSessionId: string | null;
  notes: string | null;
};

export type AdminCustomer = {
  id: string;
  number: number | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  postalCode: string | null;
  country: string | null;
  gender: string | null;
  note: string | null;
  stage: CustomerStage;
  joinedAt: string;
};

export type AdminService = {
  id: string;
  name: string;
  durationMin: number;
  price: number | null;
};

export type DashboardStats = {
  properties: number;
  bookings: number;
  customers: number;
  pendingBookings: number;
};

export type BusinessOption = {
  id: string;
  name: string;
  role: string;
};
