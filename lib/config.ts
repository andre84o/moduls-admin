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

/**
 * Demo mode: no real database is configured yet. The admin UI stays browsable
 * with seeded demo data and a synthetic SUPER_ADMIN session. Server-side only.
 */
export function isDemoMode(): boolean {
  return !isDbConfigured();
}

export const DEMO_BUSINESS_ID = "demo-business";
