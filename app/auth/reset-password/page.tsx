import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ResetPasswordForm } from "./_components/reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card px-7 py-9 shadow-sm sm:px-9 sm:py-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sätt lösenord
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Välj ett lösenord för ditt konto.
          </p>
          <div className="mt-6">
            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
