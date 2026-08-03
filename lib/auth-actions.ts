"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase";
import { isSupabaseConfigured, isDemoMode } from "./config";
import {
  ACTIVE_BUSINESS_COOKIE,
  listUserBusinesses,
  isGlobalSuperAdmin,
} from "./auth";
import { getPrisma } from "./prisma";

/**
 * Session mutations (server actions). Real auth runs through Supabase Auth;
 * in demo mode (no Supabase) the login screen simply lets you in.
 */

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Demo mode: no real auth — go straight to the admin.
  if (isDemoMode() || !isSupabaseConfigured()) {
    redirect("/admin");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}

export async function logout() {
  if (isSupabaseConfigured() && !isDemoMode()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/**
 * Switch the active business. Regular users may only switch to a business they
 * belong to. A PLATFORM SUPER_ADMIN may switch to ANY existing business — the
 * documented cross-business exception (see CLAUDE.md), checked server-side.
 */
export async function switchBusiness(businessId: string) {
  const businesses = await listUserBusinesses();
  let permitted = businesses.some((b) => b.id === businessId);

  if (!permitted && !isDemoMode() && (await isGlobalSuperAdmin())) {
    // Platform-level access. Only SUPER_ADMIN may target a non-member business.
    const exists = await getPrisma().business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    permitted = exists !== null;
  }
  if (!permitted) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/admin");
}
