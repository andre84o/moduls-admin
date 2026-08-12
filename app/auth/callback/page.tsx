"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function handle() {
      const params = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));

      const code = params.get("code");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (code) {
        // PKCE flow
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        window.location.href = error ? "/login?error=ogiltig-lank" : "/auth/reset-password";
      } else if (accessToken && refreshToken) {
        // Implicit flow (invite / magic link)
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.location.href = error ? "/login?error=ogiltig-lank" : "/auth/reset-password";
      } else {
        window.location.href = "/login?error=ogiltig-lank";
      }
    }

    handle();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loggar in&hellip;</p>
    </main>
  );
}
