"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

export type ResetState = { error?: string } | undefined;

export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password.length < 8) {
    return { error: "Lösenordet måste vara minst 8 tecken." };
  }
  if (!/[A-Z]/.test(password)) {
    return { error: "Lösenordet måste innehålla minst 1 stor bokstav." };
  }
  if (password !== confirm) {
    return { error: "Lösenorden matchar inte." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Kunde inte uppdatera lösenordet. Försök igen." };
  }

  redirect("/admin");
}
