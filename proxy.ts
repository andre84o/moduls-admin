import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (ersätter middleware). Kör innan cache på matchade routes.
 *
 * Gör två saker:
 * 1. Refreshar Supabase-sessionen och synkar cookies (token-rotation).
 * 2. Optimistisk route-skydd: skyddar /admin om ingen auth-cookie finns.
 *    Den verkliga auktoriseringen sker server-side i requireBusinessAccess().
 */

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && /^https?:\/\//i.test(url) && !url.includes("["));
}

export default async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  // Demo mode: ingen auth-provider — lämna routing orörd.
  if (!supabaseConfigured()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshar access-token och synkar cookies. Använd getUser() — getSession()
  // validerar inte mot Supabase-servern och kan returnera stale data.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && !user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // NOTE: Vi redirectar medvetet INTE /login -> /admin här. Proxy kör
  // getUser() nu, men om redirect-kedjan av någon anledning bryts skulle en
  // loop kunna uppstå. Den validerade "redan inloggad?"-kontrollen lever
  // server-side i app/login/page.tsx via getCurrentUser().

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
