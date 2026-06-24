import "server-only";
import Stripe from "stripe";
import { isPaymentConfigured } from "./config";

/**
 * Server-only Stripe payment infrastructure.
 *
 * This is flag-gated by isPaymentConfigured() (a config check for
 * STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) — it is NOT a ProjectType module.
 * Secrets are server-only and are never exposed to the client.
 *
 * These helpers are pure infrastructure: they are NOT yet wired into any
 * booking flow, server action, or route. Like lib/email.ts and lib/storage.ts,
 * everything degrades gracefully — when Stripe is unconfigured the helpers are a
 * no-op (returning a SKIPPED sentinel or null) instead of throwing.
 */

let stripe: Stripe | null = null;

/**
 * Lazy, cached Stripe client. Returns null when payments are unconfigured.
 * Never constructs at import time and never throws.
 */
export function getStripe(): Stripe | null {
  if (!isPaymentConfigured()) return null;
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
  return stripe;
}

export type CheckoutResult =
  | { status: "CREATED"; id: string; url: string | null }
  | { status: "SKIPPED"; id: null; url: null };

/**
 * Create a Stripe Checkout Session. Infra only — not wired into any flow.
 * When Stripe is unconfigured this is a no-op returning a SKIPPED sentinel.
 */
export async function createCheckoutSession(params: {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  successUrl: string;
  cancelUrl: string;
  mode?: Stripe.Checkout.SessionCreateParams.Mode; // default "payment"
  customerEmail?: string | null;
  metadata?: Record<string, string>;
}): Promise<CheckoutResult> {
  const client = getStripe();
  if (!client) {
    console.info("[payment skipped] Stripe unconfigured; checkout session not created");
    return { status: "SKIPPED", id: null, url: null };
  }

  const session = await client.checkout.sessions.create({
    mode: params.mode ?? "payment",
    line_items: params.lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail ?? undefined,
    metadata: params.metadata,
  });

  return { status: "CREATED", id: session.id, url: session.url };
}

/**
 * Verify and parse a Stripe webhook payload. Returns null when Stripe is
 * unconfigured or when the signature is invalid. Never throws.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event | null {
  const client = getStripe();
  if (!client) return null;

  try {
    return client.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (e) {
    console.error(
      `[payment webhook] signature verification failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
