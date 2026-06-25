# Stripe test-mode booking verification

A manual test harness for the real Stripe **test-mode** booking flow:
public Checkout → Stripe webhook → booking confirmation. It complements the
fully-mocked automated suite in `tests/payment-flow.e2e.test.ts` (run with
`npm test`), which already asserts every step below headlessly.

Use **Stripe test mode only**. Never put live keys or real secrets in the repo.

## 1. Required environment variables

Put these in `.env.local` (preferred) or `.env`. See `.env.example` for the
full list. Only the names are shown here — fill in your own test values.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | DB writes | Real Postgres (Supabase). Without it the app runs in demo mode and refuses bookings. |
| `DIRECT_URL` | migrations | Direct (non-pooled) connection for `prisma migrate`. |
| `STRIPE_SECRET_KEY` | Checkout + webhook | **Test** secret key (`sk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | webhook signature | The `whsec_...` printed by `stripe listen` (see step 4). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth/admin | Needed to run the admin to set up data. |
| `RESEND_API_KEY` | emails | Optional. Leave unset to **safely skip** sending (logged only). |
| `ADMIN_EMAIL` | emails | Optional fallback admin recipient. |
| `NEXT_PUBLIC_APP_URL` | redirect URLs | Optional; defaults to the request host / `http://localhost:3000`. |

The app gates payments on `isPaymentConfigured()` = both `STRIPE_SECRET_KEY`
**and** `STRIPE_WEBHOOK_SECRET` present (`lib/config.ts`). If either is missing,
`createBookingCheckout` returns "Payments are not configured." and writes nothing.

## 2. One-time setup

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # or: npx prisma db push   (apply the schema)
```

Ensure a test business exists with the **RENTAL**, **BOOKING** and **CRM**
modules enabled, plus one **PUBLISHED** property with valid booking settings
(pricePerNight, currency, minNights, guest caps). Either seed it
(`npm run db:seed`) or create it in the admin, then note the property `slug`.

## 3. Start the app + webhook forwarding

Three terminals:

```bash
# 1) App
npm run dev

# 2) Stripe CLI — forward test webhooks to the local route.
#    Copy the printed "whsec_..." into STRIPE_WEBHOOK_SECRET, then restart `npm run dev`.
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The webhook route is `app/api/webhooks/stripe/route.ts`; it handles
`checkout.session.completed` and `checkout.session.async_payment_succeeded`.

## 4. Run the flow (steps 5–7)

1. Open `http://localhost:3000/p/<slug>`.
2. Pick valid dates + guests within the property's limits and submit.
   - `createBookingCheckout` creates a **PAYMENT_PENDING** booking (30-min hold)
     and redirects to Stripe Checkout.
3. Pay with a Stripe test card: **`4242 4242 4242 4242`**, any future expiry,
   any CVC, any postal code.
4. Stripe sends `checkout.session.completed`; the CLI forwards it; the webhook
   calls `confirmPaidBooking`.

## 5. Verify the booking (steps 8–9)

The session id (`cs_test_...`) is printed by `stripe listen`, or read it from
the booking row.

```bash
npm run stripe:verify-booking -- --session cs_test_...
# or
npm run stripe:verify-booking -- --booking <bookingId>
```

Expected (exit code 0):

- `status` = **CONFIRMED** (was PAYMENT_PENDING)
- `paid` = **true**
- `stripePaymentIntentId` stored (present for a normal card payment)
- a **CRM customer** linked (created/updated, `stage = CUSTOMER`) — unless CRM is
  disabled for the business

## 6. Idempotency (step 11)

Re-deliver the same event and confirm it does not double-process:

```bash
stripe events resend <evt_id>          # same checkout.session.completed event
# then re-run the verify script — booking stays CONFIRMED exactly once
npm run stripe:verify-booking -- --session cs_test_...
```

`confirmPaidBooking` flips the row only while it is `PAYMENT_PENDING`
(status-conditional `updateMany`), so replays return `ALREADY` with no second
CRM upsert and no second email.

## 7. Overlap blocked after confirmation (step 12)

Start a second booking on the same property with overlapping dates (respecting
`bufferDaysAfterCheckout`). Checkout must fail server-side with a
"no longer available" error — `isPropertyAvailable` (`lib/booking-availability.ts`)
treats `CONFIRMED` and live `PAYMENT_PENDING` holds as blocking.

## 8. Emails (step 10)

- With `RESEND_API_KEY` set: confirmation emails are sent to the guest + admin.
- Without it: `sendNotification` returns `SKIPPED` and logs `[email skipped] ...`.
  Booking confirmation is **not** blocked either way (best-effort, errors caught).

## What the automated suite already proves (`npm test`)

`tests/payment-flow.e2e.test.ts` (mocked Prisma + Stripe + email) asserts:
PAYMENT_PENDING → CONFIRMED, `paid = true`, `stripePaymentIntentId` stored, CRM
upsert (and CRM skipped when disabled), email sent/skipped, duplicate-webhook
idempotency, overlapping-dates rejection, minNights and pets validation, and the
payments-not-configured rollback. This manual harness exercises the same paths
against the real Stripe test infrastructure.
