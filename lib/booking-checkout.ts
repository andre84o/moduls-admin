"use server";

/**
 * PUBLIC, SESSIONLESS booking checkout action.
 *
 * SECURITY / multi-tenant (CLAUDE.md):
 *  - This is a public flow with NO session. It MUST NOT use requireBusinessAccess
 *    or requireModule (both need a session and redirect). Instead the businessId
 *    is resolved SERVER-SIDE from the Property row — it is NEVER taken from the
 *    client. Module enablement is checked via isModuleEnabledForBusiness using
 *    that server-resolved businessId.
 *  - Price and availability are fully RECOMPUTED server-side; any client-supplied
 *    price is ignored and all guest/date input is revalidated.
 *  - The booking is created as PAYMENT_PENDING with a 30-minute hold. Only the
 *    (future) verified Stripe webhook will transition it to CONFIRMED.
 *  - No CRM, email, or UI work happens here — that is out of scope for this phase.
 */

import { headers } from "next/headers";
import type Stripe from "stripe";
import { getPrisma } from "./prisma";
import { isDemoMode, isPaymentConfigured } from "./config";
import { isModuleEnabledForBusiness } from "./modules";
import { createCheckoutSession } from "./payments";
import { parseDateOnly, computeNights, computeBookingPrice } from "./booking-pricing";
import { isPropertyAvailable } from "./booking-availability";

export type BookingCheckoutInput = {
  propertyId: string;
  checkIn: string; // "yyyy-mm-dd"
  checkOut: string; // "yyyy-mm-dd"
  adults: number;
  children: number;
  infants: number;
  pets: number;
  guestName: string;
  guestEmail?: string | null;
};

export type BookingCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createBookingCheckout(
  input: BookingCheckoutInput,
): Promise<BookingCheckoutResult> {
  // 1. Demo guard — no real bookings in demo mode.
  if (isDemoMode()) {
    return { ok: false, error: "Booking is not available in demo mode." };
  }

  // 2. Basic input validation (revalidated server-side; client is untrusted).
  if (typeof input.propertyId !== "string" || input.propertyId.length === 0) {
    return { ok: false, error: "Property is required." };
  }

  const guestName =
    typeof input.guestName === "string" ? input.guestName.trim() : "";
  if (guestName.length === 0) {
    return { ok: false, error: "Guest name is required." };
  }

  const checkIn = parseDateOnly(input.checkIn);
  const checkOut = parseDateOnly(input.checkOut);
  if (!checkIn || !checkOut) {
    return { ok: false, error: "Invalid dates." };
  }
  if (checkOut.getTime() <= checkIn.getTime()) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  // Check-in must not be in the past (UTC-midnight comparison, matching dates).
  const t = new Date();
  const today = new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()),
  );
  if (checkIn.getTime() < today.getTime()) {
    return { ok: false, error: "Check-in cannot be in the past." };
  }

  // Guest counts: coerce, floor, clamp negatives to 0.
  const adults = Math.max(0, Math.floor(Number(input.adults) || 0));
  const children = Math.max(0, Math.floor(Number(input.children) || 0));
  const infants = Math.max(0, Math.floor(Number(input.infants) || 0));
  const pets = Math.max(0, Math.floor(Number(input.pets) || 0));
  if (adults < 1) {
    return { ok: false, error: "At least one adult is required." };
  }

  // 3. Resolve the property SERVER-SIDE (only PUBLISHED). businessId comes from
  //    this row — never from the client.
  const prisma = getPrisma();
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, status: "PUBLISHED" },
    select: {
      id: true,
      businessId: true,
      title: true,
      pricePerNight: true,
      cleaningFee: true,
      currency: true,
      minNights: true,
      maxGuests: true,
      maxAdults: true,
      maxChildren: true,
      maxInfants: true,
      maxPets: true,
      petsAllowed: true,
      bufferDaysAfterCheckout: true,
      slug: true,
    },
  });
  if (!property) {
    return { ok: false, error: "Property not found." };
  }

  // 4. Module checks (public-safe, by server-resolved businessId).
  const [rental, booking] = await Promise.all([
    isModuleEnabledForBusiness(property.businessId, "RENTAL"),
    isModuleEnabledForBusiness(property.businessId, "BOOKING"),
  ]);
  if (!rental || !booking) {
    return { ok: false, error: "Booking is not available for this property." };
  }

  // 5. Bookable check.
  if (property.pricePerNight == null) {
    return { ok: false, error: "This property is not bookable yet." };
  }

  // 6. Minimum nights.
  const nights = computeNights(checkIn, checkOut);
  const minNights = property.minNights ?? 1;
  if (nights < minNights) {
    return { ok: false, error: `Minimum stay is ${minNights} night(s).` };
  }

  // 7. Guest caps (infants excluded from maxGuests, standard).
  if (property.maxAdults != null && adults > property.maxAdults) {
    return { ok: false, error: `This property allows up to ${property.maxAdults} adult(s).` };
  }
  if (property.maxChildren != null && children > property.maxChildren) {
    return { ok: false, error: `This property allows up to ${property.maxChildren} child(ren).` };
  }
  if (property.maxInfants != null && infants > property.maxInfants) {
    return { ok: false, error: `This property allows up to ${property.maxInfants} infant(s).` };
  }
  if (property.maxGuests != null && adults + children > property.maxGuests) {
    return { ok: false, error: `This property allows up to ${property.maxGuests} guests.` };
  }
  if (pets > 0 && !property.petsAllowed) {
    return { ok: false, error: "Pets are not allowed at this property." };
  }
  if (property.maxPets != null && pets > property.maxPets) {
    return { ok: false, error: `This property allows up to ${property.maxPets} pet(s).` };
  }

  // 8. Price (server-side, authoritative — any client price is ignored).
  const cleaningFee = property.cleaningFee ?? 0;
  const currency = property.currency ?? "sek";
  const price = computeBookingPrice({
    nights,
    pricePerNight: property.pricePerNight,
    cleaningFee,
    currency,
  });

  // 9. Payment must be configured BEFORE we create any booking.
  if (!isPaymentConfigured()) {
    return { ok: false, error: "Payments are not configured." };
  }

  // 10. Create the PAYMENT_PENDING hold inside a transaction with a race re-check.
  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
  let bookingId: string;
  try {
    bookingId = await prisma.$transaction(async (tx) => {
      const free = await isPropertyAvailable({
        db: tx,
        businessId: property.businessId,
        propertyId: property.id,
        checkIn,
        checkOut,
        bufferDays: property.bufferDaysAfterCheckout ?? 0,
        now,
      });
      if (!free) throw new Error("UNAVAILABLE");
      const created = await tx.booking.create({
        data: {
          businessId: property.businessId,
          propertyId: property.id,
          guestName: input.guestName.trim(),
          guestEmail: input.guestEmail?.trim() || null,
          startAt: checkIn,
          endAt: checkOut,
          status: "PAYMENT_PENDING",
          adults,
          children,
          infants,
          pets,
          nights: price.nights,
          pricePerNightSnapshot: price.pricePerNight,
          cleaningFeeSnapshot: price.cleaningFee,
          totalAmount: price.total,
          currency: price.currency,
          holdExpiresAt,
        },
        select: { id: true },
      });
      return created.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAVAILABLE")
      return { ok: false, error: "Those dates are no longer available." };
    throw e;
  }

  // 11. Build the Stripe line items (minor units; integers).
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: price.currency,
        product_data: { name: `${price.nights} night(s) — ${property.title}` },
        unit_amount: price.pricePerNight,
      },
      quantity: price.nights,
    },
  ];
  if (price.cleaningFee > 0) {
    lineItems.push({
      price_data: {
        currency: price.currency,
        product_data: { name: "Cleaning fee" },
        unit_amount: price.cleaningFee,
      },
      quantity: 1,
    });
  }

  // 12. Derive origin (Next 16 headers() is async).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (host ? `${proto}://${host}` : "http://localhost:3000");

  // 13. Create the Stripe Checkout session, with rollback on failure.
  let session;
  try {
    session = await createCheckoutSession({
      lineItems,
      successUrl: `${origin}/?booking=success`,
      cancelUrl: `${origin}/?booking=cancelled`,
      customerEmail: input.guestEmail?.trim() || null,
      metadata: { businessId: property.businessId, bookingId },
    });
  } catch {
    await prisma.booking.deleteMany({
      where: { id: bookingId, businessId: property.businessId },
    });
    return { ok: false, error: "Could not start payment. Please try again." };
  }
  if (session.status !== "CREATED" || !session.url) {
    await prisma.booking.deleteMany({
      where: { id: bookingId, businessId: property.businessId },
    });
    return { ok: false, error: "Payments are not configured." };
  }

  // 14. Persist the session id (scoped) + return the url.
  await prisma.booking.updateMany({
    where: { id: bookingId, businessId: property.businessId },
    data: { stripeSessionId: session.id },
  });
  return { ok: true, url: session.url };
}
