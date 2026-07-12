import { isDbConfigured } from "./prisma";

/**
 * Central feature/availability flags. Each integration degrades gracefully when
 * its credentials are missing, so the app builds and runs locally without them.
 */

export { isDbConfigured };

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(
    url &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      /^https?:\/\//i.test(url) &&
      !url.includes("["),
  );
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function isPaymentConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Google Reviews integration is configured only when a server-side Places API
 * key is present. The key (GOOGLE_PLACES_API_KEY) is read server-side only and
 * is never exposed to the client — this flag just gates whether a sync can run.
 */
export function isGoogleReviewsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

/**
 * Demo mode: no real database is configured yet. The admin UI stays browsable
 * with seeded demo data and a synthetic SUPER_ADMIN session. Server-side only.
 */
export function isDemoMode(): boolean {
  return !isDbConfigured();
}

export const DEMO_BUSINESS_ID = "demo-business";
