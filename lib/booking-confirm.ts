import "server-only";
import type Stripe from "stripe";
import { getPrisma } from "./prisma";

export type ConfirmResult =
  | "CONFIRMED"    // newly confirmed by this call
  | "ALREADY"      // already confirmed (idempotent no-op)
  | "NOT_PENDING"  // booking exists but is not PAYMENT_PENDING (EXPIRED/CANCELLED/etc) — not confirmed
  | "NOT_FOUND"    // no booking matches this session id
  | "UNPAID"       // session is not paid — not confirmed
  | "NO_SESSION_ID"; // session has no id

/**
 * Confirm the PAYMENT_PENDING booking tied to a PAID Stripe Checkout session.
 *
 * SECURITY / correctness:
 *  - The booking is looked up by its UNIQUE stripeSessionId (set at checkout).
 *  - businessId is taken from the FOUND booking row (server source of truth),
 *    never from the Stripe event/client. The write is scoped by {id, businessId}.
 *  - Idempotent: the update is conditional on status PAYMENT_PENDING, so repeat
 *    webhook deliveries (Stripe retries / duplicates) match zero rows after the
 *    first confirm. Already-CONFIRMED → ALREADY. EXPIRED/CANCELLED → NOT_PENDING
 *    (never blindly confirmed). Unpaid sessions are never confirmed.
 *  - The webhook is the source of truth; client redirects must never confirm.
 */
export async function confirmPaidBooking(
  session: Stripe.Checkout.Session,
): Promise<ConfirmResult> {
  if (!session.id) return "NO_SESSION_ID";
  if (session.payment_status !== "paid") return "UNPAID";

  const prisma = getPrisma();

  const booking = await prisma.booking.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true, businessId: true, status: true },
  });
  if (!booking) return "NOT_FOUND";
  if (booking.status === "CONFIRMED") return "ALREADY";
  if (booking.status !== "PAYMENT_PENDING") return "NOT_PENDING";

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Conditional, business-scoped, atomic-ish update: only flips a row that is
  // still PAYMENT_PENDING. Concurrent deliveries that lose the race update 0 rows.
  const res = await prisma.booking.updateMany({
    where: { id: booking.id, businessId: booking.businessId, status: "PAYMENT_PENDING" },
    data: { status: "CONFIRMED", paid: true, stripePaymentIntentId: paymentIntentId },
  });

  return res.count === 1 ? "CONFIRMED" : "ALREADY";
}
