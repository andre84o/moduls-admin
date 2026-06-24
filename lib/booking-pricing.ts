import "server-only";

/**
 * Pure booking pricing helpers. No DB, no I/O.
 *
 * Money is always in MINOR units (öre / cents) as integers. Dates are
 * date-only (check-in / check-out), normalized to UTC midnight.
 */

export type PriceBreakdown = {
  nights: number;
  pricePerNight: number; // minor units
  cleaningFee: number; // minor units
  total: number; // minor units
  currency: string;
};

/**
 * Parse a "yyyy-mm-dd" date-only string to a UTC-midnight Date. Returns null if
 * the string is malformed or not a real calendar date (e.g. "2026-02-31").
 */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));

  // Round-trip check: rejects overflowed dates like "2026-02-31".
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== m - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return d;
}

/** Whole nights between two UTC-midnight dates (checkOut - checkIn). */
export function computeNights(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

/**
 * Pure price calc from already-resolved settings.
 * total = nights * pricePerNight + cleaningFee (integer minor units).
 */
export function computeBookingPrice(args: {
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  currency: string;
}): PriceBreakdown {
  const { nights, pricePerNight, cleaningFee, currency } = args;

  return {
    nights,
    pricePerNight,
    cleaningFee,
    total: nights * pricePerNight + cleaningFee,
    currency,
  };
}
