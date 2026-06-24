import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/payments";
import { confirmPaidBooking } from "@/lib/booking-confirm";

// Stripe signature verification uses Node crypto — force the Node runtime.
export const runtime = "nodejs";

/**
 * Stripe webhook. The SOURCE OF TRUTH for booking confirmation — client
 * redirects must never confirm a booking. The raw body is required to verify the
 * Stripe signature. Returns 400 only for missing/invalid signatures; every
 * handled or ignored event returns 200 so Stripe does not needlessly retry; a
 * 500 is returned on unexpected server errors so Stripe retries later.
 */
export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Raw body (do NOT parse as JSON — the signature is over the exact bytes).
  const rawBody = await req.text();

  const event = constructWebhookEvent(rawBody, signature);
  if (!event) {
    // Unconfigured or signature verification failed.
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await confirmPaidBooking(session);
    }
    // All other event types are intentionally ignored (200, no retry).
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    // Let Stripe retry on transient/server errors.
    return new Response("error", { status: 500 });
  }
}
