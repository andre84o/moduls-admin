import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./_components/login-form";

export default async function LoginPage() {
  // Real session validation (not just a cookie-presence guess like proxy.ts).
  // Only a verified, authenticated user is sent on to the admin — a stale or
  // invalid auth cookie falls through and the sign-in form is shown instead.
  const user = await getCurrentUser();
  if (user) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <LoginForm />
    </main>
  );
}
