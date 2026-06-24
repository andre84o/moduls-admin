import "server-only";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { getPrisma } from "./prisma";

/**
 * Server-only availability check for a property over a date range.
 *
 * SECURITY (CLAUDE.md, multi-tenant):
 *  - `businessId` and `propertyId` MUST be server-resolved (read from the
 *    Property row after verifying BusinessMember access). They are NEVER
 *    trusted from the client.
 *  - Every query below is scoped by `businessId`, so a request can never see
 *    or conflict with another tenant's bookings or blocked times.
 *
 * The `db` param accepts either the full PrismaClient or a `$transaction`
 * client (structural subset), so the caller can run this INSIDE a transaction
 * for race safety when creating/holding a booking.
 */

// Accepts either the full client or a $transaction client (structural subset).
type AvailabilityDb = Pick<PrismaClient, "booking" | "blockedTime">;

const addDays = (d: Date, n: number): Date =>
  new Date(d.getTime() + n * 86_400_000);

/**
 * True if the property has NO conflicting booking or blocked time for
 * [checkIn, checkOut). Two bookings need at least `bufferDays` empty days
 * between one's checkout and the other's check-in.
 *
 * businessId/propertyId MUST be server-resolved (from the Property row), never
 * trusted from the client.
 */
export async function isPropertyAvailable(args: {
  db: AvailabilityDb;
  businessId: string;
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  bufferDays: number;
  now: Date;
}): Promise<boolean> {
  const {
    db,
    businessId,
    propertyId,
    checkIn,
    checkOut,
    bufferDays,
    now,
  } = args;

  // ── BOOKINGS ────────────────────────────────────────────────────────
  // Coarse window widened by buffer; the precise gap check and hold-expiry
  // filtering are done in JS below.
  const bookings = await db.booking.findMany({
    where: {
      businessId,
      propertyId,
      status: { in: ["CONFIRMED", "PAYMENT_PENDING"] },
      startAt: { lt: addDays(checkOut, bufferDays) },
      endAt: { gt: addDays(checkIn, -bufferDays) },
    },
    select: { startAt: true, endAt: true, status: true, holdExpiresAt: true },
  });

  for (const b of bookings) {
    // Ignore expired PAYMENT_PENDING holds — those dates are released.
    if (
      b.status === "PAYMENT_PENDING" &&
      b.holdExpiresAt &&
      b.holdExpiresAt <= now
    ) {
      continue;
    }

    // Compatible iff there is a full buffer gap on either side.
    const compatible =
      addDays(b.endAt, bufferDays).getTime() <= checkIn.getTime() ||
      addDays(checkOut, bufferDays).getTime() <= b.startAt.getTime();

    if (!compatible) return false;
  }

  // ── BLOCKED TIMES ───────────────────────────────────────────────────
  // No buffer applied; exact range overlap. propertyId-specific OR
  // business-wide (propertyId null).
  const blocked = await db.blockedTime.findFirst({
    where: {
      businessId,
      OR: [{ propertyId }, { propertyId: null }],
      startAt: { lt: checkOut },
      endAt: { gt: checkIn },
    },
    select: { id: true },
  });

  if (blocked) return false;

  return true;
}

export type ReservedRange = { start: string; end: string }; // "yyyy-mm-dd", end exclusive

/**
 * Reserved/blocked date ranges for ONE property, for disabling dates in the
 * public calendar. Active bookings (CONFIRMED + non-expired PAYMENT_PENDING),
 * with their end extended by bufferDaysAfterCheckout, plus BlockedTime
 * (property-specific OR business-wide). businessId/propertyId are server-resolved
 * from the Property row. The backend remains the final authority on conflicts.
 */
export async function getReservedRanges(args: {
  businessId: string;
  propertyId: string;
  bufferDays: number;
  now?: Date;
}): Promise<ReservedRange[]> {
  const { businessId, propertyId, bufferDays } = args;
  const now = args.now ?? new Date();
  const prisma = getPrisma();
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      propertyId,
      status: { in: ["CONFIRMED", "PAYMENT_PENDING"] },
      endAt: { gt: now }, // only current/future occupancy matters
    },
    select: { startAt: true, endAt: true, status: true, holdExpiresAt: true },
  });

  const ranges: ReservedRange[] = [];
  for (const b of bookings) {
    if (b.status === "PAYMENT_PENDING" && b.holdExpiresAt && b.holdExpiresAt <= now) continue; // expired hold
    ranges.push({ start: toYmd(b.startAt), end: toYmd(addDays(b.endAt, bufferDays)) });
  }

  const blocked = await prisma.blockedTime.findMany({
    where: {
      businessId,
      OR: [{ propertyId }, { propertyId: null }],
      endAt: { gt: now },
    },
    select: { startAt: true, endAt: true },
  });
  for (const bt of blocked) {
    ranges.push({ start: toYmd(bt.startAt), end: toYmd(bt.endAt) });
  }

  return ranges;
}
