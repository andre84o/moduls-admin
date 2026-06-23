
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection. Runs before cache on matching routes and only
 * checks for the presence of a Supabase auth cookie (no DB). The real
 * authorization happens server-side in requireBusinessAccess() (lib/auth.ts).
 *
 * When Supabase isn't configured the app runs in demo mode and /admin is open.
 */

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && /^https?:\/\//i.test(url) && !url.includes("["));
}

function hasSupabaseSession(req: NextRequest): boolean {
  // Supabase stores the session in cookies named sb-<ref>-auth-token(.N).
  return req.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

export default function proxy(req: NextRequest) {
  // Demo mode: no auth provider — leave routing untouched.
  if (!supabaseConfigured()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const signedIn = hasSupabaseSession(req);

  if (pathname.startsWith("/admin") && !signedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // NOTE: We deliberately do NOT redirect /login -> /admin here. Proxy only
  // sees whether an auth cookie *exists*, not whether it's valid. A stale or
  // invalid cookie would bounce /login -> /admin -> (getUser() fails) -> /login
  // forever (ERR_TOO_MANY_REDIRECTS). The real, validated "already signed in?"
  // check lives server-side in app/login/page.tsx via getCurrentUser().

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
