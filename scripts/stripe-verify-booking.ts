import { config } from "dotenv";
// Next.js loads .env.local with priority over .env; mirror that order here.
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

/**
 * Verify the post-payment state of a booking after a REAL Stripe TEST-MODE
 * checkout + webhook. Reads the real database (no Stripe call) and asserts the
 * booking reflects the confirmed/paid state that the webhook
 * (lib/booking-confirm.ts) is supposed to write.
 *
 * Usage (after completing a test payment and letting the webhook arrive):
 *   npm run stripe:verify-booking -- --session cs_test_...
 *   npm run stripe:verify-booking -- --booking <bookingId>
 *
 * See scripts/stripe-test-mode.md for the full manual test harness.
 *
 * Read-only: it never writes to the database. Exit code is 0 only when the
 * booking is found AND CONFIRMED AND paid. The payment-intent and CRM links are
 * reported but do not gate the exit code (a session may legitimately have no
 * payment_intent, and CRM may be disabled for the business).
 */

function ok(label: string, cond: boolean, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

// Informational check — reports ✅/⚠️ but never fails the run.
function note(cond: boolean, pass: string, warn: string) {
  console.log(`${cond ? "✅" : "⚠️ "} ${cond ? pass : warn}`);
}

function info(label: string, value: string) {
  console.log(`   ${label}: ${value}`);
}

function parseArgs(argv: string[]): { session?: string; booking?: string } {
  const out: { session?: string; booking?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--session") out.session = argv[i + 1];
    else if (argv[i] === "--booking") out.booking = argv[i + 1];
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//i.test(url) || url.includes("[")) {
    console.error(
      "DATABASE_URL is not a valid connection string. Set it in .env.local / .env.",
    );
    process.exit(1);
  }

  const { session, booking: bookingId } = parseArgs(process.argv.slice(2));
  if (!session && !bookingId) {
    console.error(
      "Pass --session <cs_...> (Stripe Checkout Session id) or --booking <bookingId>.",
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    const booking = await prisma.booking.findUnique({
      where: session ? { stripeSessionId: session } : { id: bookingId! },
      include: { customer: true, property: { select: { title: true } } },
    });

    ok("booking found for the given reference", Boolean(booking));
    if (!booking) return;

    info("bookingId", booking.id);
    info("business", booking.businessId);
    info("property", booking.property?.title ?? "—");
    info(
      "dates",
      `${booking.startAt.toISOString().slice(0, 10)} -> ${booking.endAt
        .toISOString()
        .slice(0, 10)} (${booking.nights ?? "?"} nights)`,
    );
    info(
      "total",
      booking.totalAmount != null
        ? `${(booking.totalAmount / 100).toFixed(2)} ${booking.currency.toUpperCase()}`
        : "—",
    );

    // Step 8 — the gating assertions the webhook must satisfy.
    ok("status is CONFIRMED", booking.status === "CONFIRMED", `status=${booking.status}`);
    ok("paid is true", booking.paid === true, `paid=${booking.paid}`);

    // Step 8c — payment intent stored "if available" (informational).
    note(
      Boolean(booking.stripePaymentIntentId),
      `stripePaymentIntentId stored: ${booking.stripePaymentIntentId}`,
      "stripePaymentIntentId is null (acceptable only if the session had no payment_intent)",
    );

    // Step 9 — CRM customer created/updated and linked (informational: CRM may be disabled).
    note(
      Boolean(booking.customerId && booking.customer),
      `CRM customer linked: ${booking.customer?.name} <${booking.customer?.email ?? "no-email"}> stage=${booking.customer?.stage}`,
      "no CRM customer linked (expected only if CRM is disabled or the guest had no email)",
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `\n${process.exitCode ? "FAILED — booking is not in the expected confirmed/paid state." : "OK — booking is CONFIRMED and paid."}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
