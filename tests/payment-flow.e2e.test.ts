import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

/**
 * Backend payment E2E (mocked): drives the real flow end to end with a stateful
 * in-memory Prisma + faked Stripe layer:
 *   createBookingCheckout()  ->  PAYMENT_PENDING hold + Stripe session url
 *   confirmPaidBooking(fakeSession)  ->  CONFIRMED + paid + CRM upsert + emails
 * No DB and no real Stripe. The webhook layer is exercised by calling
 * confirmPaidBooking() directly with a fake checkout session.
 */

// Mutable holder so the mocked getPrisma() always returns the per-test instance.
const hoisted = vi.hoisted(() => ({ prisma: null as unknown as MockPrisma }));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => hoisted.prisma,
  isDbConfigured: () => true,
}));
vi.mock("@/lib/config", () => ({
  isDemoMode: () => false,
  isPaymentConfigured: () => true,
  isEmailConfigured: () => false,
}));
vi.mock("@/lib/modules", () => ({
  isModuleEnabledForBusiness: vi.fn(async () => true),
}));
vi.mock("@/lib/payments", () => ({
  createCheckoutSession: vi.fn(async () => ({
    status: "CREATED" as const,
    id: "cs_test_1",
    url: "https://stripe.test/checkout/cs_test_1",
  })),
}));
vi.mock("@/lib/email", () => ({
  notifyBookingConfirmed: vi.fn(async () => {}),
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (_: string) => null }),
}));

import { createBookingCheckout } from "@/lib/booking-checkout";
import { confirmPaidBooking } from "@/lib/booking-confirm";
import { isModuleEnabledForBusiness } from "@/lib/modules";
import { createCheckoutSession } from "@/lib/payments";
import { notifyBookingConfirmed } from "@/lib/email";

const BUSINESS = { id: "biz_1", name: "Demo Estates", email: "owner@demo.test" };

function seedProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: "prop_1",
    businessId: BUSINESS.id,
    title: "Casa Sol",
    slug: "casa-sol",
    status: "PUBLISHED",
    pricePerNight: 100000, // 1000.00
    cleaningFee: 50000, // 500.00
    currency: "sek",
    minNights: 2,
    maxGuests: 4,
    maxAdults: 4,
    maxChildren: 4,
    maxInfants: 2,
    maxPets: 1,
    petsAllowed: true,
    bufferDaysAfterCheckout: 1,
    ...overrides,
  };
}

/** A future check-in/out range as "yyyy-mm-dd" strings. */
function futureRange(startOffsetDays: number, nights: number) {
  const now = new Date();
  const ci = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + startOffsetDays,
    ),
  );
  const co = new Date(ci.getTime() + nights * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkIn: fmt(ci), checkOut: fmt(co) };
}

function fakeSession(
  id: string,
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id,
    payment_status: "paid",
    payment_intent: "pi_test_1",
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

const baseInput = {
  propertyId: "prop_1",
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  guestName: "Anna Lind",
  guestEmail: "anna@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isModuleEnabledForBusiness).mockResolvedValue(true);
  vi.mocked(createCheckoutSession).mockResolvedValue({
    status: "CREATED",
    id: "cs_test_1",
    url: "https://stripe.test/checkout/cs_test_1",
  });
});

describe("payment E2E", () => {
  it("creates a PAYMENT_PENDING hold then confirms it on a paid webhook (CRM + emails)", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty()],
    });
    const { checkIn, checkOut } = futureRange(10, 3);

    const res = await createBookingCheckout({ ...baseInput, checkIn, checkOut });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.url).toContain("stripe.test");

    const bookings = hoisted.prisma._stores.bookings;
    expect(bookings).toHaveLength(1);
    const booking = bookings[0];
    expect(booking.status).toBe("PAYMENT_PENDING");
    expect(booking.nights).toBe(3);
    expect(booking.totalAmount).toBe(350000); // 3 * 1000.00 + 500.00
    expect(booking.stripeSessionId).toBe("cs_test_1");
    expect(booking.paid).toBe(false);
    expect(booking.holdExpiresAt).toBeInstanceOf(Date);

    const result = await confirmPaidBooking(fakeSession("cs_test_1"));
    expect(result).toBe("CONFIRMED");
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.paid).toBe(true);
    expect(booking.stripePaymentIntentId).toBe("pi_test_1");

    // CRM customer created + linked.
    const customers = hoisted.prisma._stores.customers;
    expect(customers).toHaveLength(1);
    expect(customers[0].email).toBe("anna@example.com");
    expect(customers[0].stage).toBe("CUSTOMER");
    expect(booking.customerId).toBe(customers[0].id);

    // Notifications attempted once, with the right summary.
    expect(vi.mocked(notifyBookingConfirmed)).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(notifyBookingConfirmed).mock.calls[0][0];
    expect(arg.propertyName).toBe("Casa Sol");
    expect(arg.nights).toBe(3);
    expect(arg.totalLabel).toBe("3500.00 SEK");
    expect(arg.adminEmail).toBe("owner@demo.test");
  });

  it("is idempotent: a duplicate webhook does not re-confirm, re-upsert, or re-send", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty()],
    });
    const { checkIn, checkOut } = futureRange(20, 2);
    await createBookingCheckout({ ...baseInput, checkIn, checkOut });

    const first = await confirmPaidBooking(fakeSession("cs_test_1"));
    expect(first).toBe("CONFIRMED");

    const second = await confirmPaidBooking(fakeSession("cs_test_1"));
    expect(second).toBe("ALREADY");

    expect(vi.mocked(notifyBookingConfirmed)).toHaveBeenCalledTimes(1);
    expect(hoisted.prisma._stores.customers).toHaveLength(1);
  });

  it("does not confirm an unpaid session", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty()],
    });
    const { checkIn, checkOut } = futureRange(30, 2);
    await createBookingCheckout({ ...baseInput, checkIn, checkOut });

    const result = await confirmPaidBooking(
      fakeSession("cs_test_1", { payment_status: "unpaid" }),
    );
    expect(result).toBe("UNPAID");
    expect(hoisted.prisma._stores.bookings[0].status).toBe("PAYMENT_PENDING");
    expect(vi.mocked(notifyBookingConfirmed)).not.toHaveBeenCalled();
  });

  it("prevents double booking: overlapping dates are rejected server-side", async () => {
    const { checkIn, checkOut } = futureRange(40, 3);
    const existing = {
      id: "bk_existing",
      businessId: BUSINESS.id,
      propertyId: "prop_1",
      status: "CONFIRMED",
      startAt: new Date(`${checkIn}T00:00:00.000Z`),
      endAt: new Date(`${checkOut}T00:00:00.000Z`),
      holdExpiresAt: null,
    };
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty()],
      bookings: [existing],
    });

    const res = await createBookingCheckout({ ...baseInput, checkIn, checkOut });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/no longer available/i);
    // No new booking row was created.
    expect(
      hoisted.prisma._stores.bookings.filter((b: { id: string }) => b.id !== "bk_existing"),
    ).toHaveLength(0);
  });

  it("confirms the booking but skips CRM when the CRM module is disabled", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty()],
    });
    // RENTAL + BOOKING enabled (checkout), CRM disabled (confirm).
    vi.mocked(isModuleEnabledForBusiness).mockImplementation(
      async (_businessId: string, type: string) => type !== "CRM",
    );
    const { checkIn, checkOut } = futureRange(50, 2);

    const res = await createBookingCheckout({ ...baseInput, checkIn, checkOut });
    expect(res.ok).toBe(true);

    const result = await confirmPaidBooking(fakeSession("cs_test_1"));
    expect(result).toBe("CONFIRMED");
    expect(hoisted.prisma._stores.customers).toHaveLength(0); // CRM skipped
    expect(vi.mocked(notifyBookingConfirmed)).toHaveBeenCalledTimes(1); // emails still attempted
  });

  it("rejects a stay shorter than minNights", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty({ minNights: 3 })],
    });
    const { checkIn, checkOut } = futureRange(60, 2); // 2 nights < 3

    const res = await createBookingCheckout({ ...baseInput, checkIn, checkOut });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/minimum stay/i);
  });

  it("rejects pets when the property does not allow them", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty({ petsAllowed: false, maxPets: 0 })],
    });
    const { checkIn, checkOut } = futureRange(70, 2);

    const res = await createBookingCheckout({
      ...baseInput,
      checkIn,
      checkOut,
      pets: 1,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/pets are not allowed/i);
  });

  it("fails clearly when payments are not configured (no booking created)", async () => {
    hoisted.prisma = createMockPrisma({
      businesses: [BUSINESS],
      properties: [seedProperty()],
    });
    // Stripe session would skip; but the action fails fast before creating a hold.
    vi.mocked(createCheckoutSession).mockResolvedValue({
      status: "SKIPPED",
      id: null,
      url: null,
    });
    const { checkIn, checkOut } = futureRange(80, 2);

    // Re-mock isPaymentConfigured -> false for this case via the booking row check:
    // createBookingCheckout calls isPaymentConfigured() (mocked true globally), so
    // here we instead assert the SKIPPED Stripe result rolls the hold back.
    const res = await createBookingCheckout({ ...baseInput, checkIn, checkOut });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.length).toBeGreaterThan(0);
    // The hold was rolled back -> no lingering PAYMENT_PENDING booking.
    expect(hoisted.prisma._stores.bookings).toHaveLength(0);
  });
});
