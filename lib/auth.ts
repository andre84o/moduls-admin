import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "./prisma";
import { createSupabaseServerClient } from "./supabase";
import { isDemoMode, isSupabaseConfigured, DEMO_BUSINESS_ID } from "./config";
import type { MemberRole } from "@/app/generated/prisma/enums";

/**
 * Authentication + the central authorization helper (requireBusinessAccess).
 *
 * Authentication is Supabase Auth; this module mirrors the Supabase user onto
 * the local `User` row and resolves the SAFE businessId from `BusinessMember`.
 * Never trust a businessId coming from the client without going through here.
 *
 * These are plain async helpers (not server actions). Form actions that mutate
 * the session live in ./auth-actions.ts.
 */

export const ACTIVE_BUSINESS_COOKIE = "active_business";

export type CurrentUser = {
  id: string;
  supabaseId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isDemo: boolean;
};

export type BusinessAccess = {
  businessId: string;
  userId: string;
  role: MemberRole;
  isDemo: boolean;
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
};

const DEMO_USER: CurrentUser = {
  id: "demo-user",
  supabaseId: "demo",
  email: "demo@admin.local",
  firstName: "Demo",
  lastName: "Admin",
  isDemo: true,
};

function demoMode(): boolean {
  return isDemoMode() || !isSupabaseConfigured();
}

/**
 * Resolve (and on first login, link/create) the local User for a Supabase
 * Auth user:
 *  1. Match by supabaseId (already linked).
 *  2. Else claim an existing local user with the same email — links supabaseId.
 *  3. Else create a new local user with NO business access (must be invited).
 * Access is never granted here; membership/roles stay explicit (see CLAUDE.md).
 */
async function resolveLocalUser(
  supabaseId: string,
  email: string | null,
  meta?: Record<string, unknown>,
) {
  const prisma = getPrisma();

  const linked = await prisma.user.findUnique({ where: { supabaseId } });
  if (linked) return linked;

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseId },
      });
    }
  }

  return prisma.user.create({
    data: {
      supabaseId,
      email: email ?? `${supabaseId}@noemail.local`,
      firstName: (meta?.first_name as string | undefined) ?? null,
      lastName: (meta?.last_name as string | undefined) ?? null,
    },
  });
}

/** The authenticated local user (mirrors Supabase Auth), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (demoMode()) return DEMO_USER;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await resolveLocalUser(
    user.id,
    user.email ?? null,
    user.user_metadata,
  );

  return {
    id: dbUser.id,
    supabaseId: dbUser.supabaseId,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    isDemo: false,
  };
});

/** Redirect to /login unless the request is authenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Businesses the current user may access — powers the business switcher. */
export const listUserBusinesses = cache(async (): Promise<BusinessSummary[]> => {
  if (demoMode()) {
    return [
      { id: DEMO_BUSINESS_ID, name: "Demo Estates", slug: "demo", role: "SUPER_ADMIN" },
    ];
  }

  const user = await getCurrentUser();
  if (!user) return [];

  const memberships = await getPrisma().businessMember.findMany({
    where: { userId: user.id },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.businessId,
    name: m.business.name,
    slug: m.business.slug,
    role: m.role,
  }));
});

/**
 * Whether the current user is a PLATFORM (global) SUPER_ADMIN — i.e. has a
 * SUPER_ADMIN BusinessMember row in ANY business. This is the same boundary
 * requireSuperAdmin enforces, exposed as a boolean so per-business helpers can
 * grant platform admins access to businesses they are not a member of. Demo mode
 * is always a platform admin (synthetic SUPER_ADMIN session).
 */
export const isGlobalSuperAdmin = cache(async (): Promise<boolean> => {
  if (demoMode()) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  const sa = await getPrisma().businessMember.findFirst({
    where: { userId: user.id, role: "SUPER_ADMIN" },
    select: { id: true },
  });
  return sa !== null;
});

/**
 * Businesses shown in the admin business switcher. Regular users see only their
 * memberships. A PLATFORM SUPER_ADMIN sees EVERY business so they can pick any
 * one to manage — the documented cross-business exception (see CLAUDE.md); the
 * per-business data stays scoped once a business is active.
 */
export async function listSwitchableBusinesses(): Promise<BusinessSummary[]> {
  const own = await listUserBusinesses();
  if (demoMode() || !(await isGlobalSuperAdmin())) return own;

  // Platform-level access. Only SUPER_ADMIN may list all businesses.
  const all = await getPrisma().business.findMany({ orderBy: { name: "asc" } });
  return all.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    // Keep the real membership role where one exists; otherwise the effective
    // role for a business the admin manages by platform right is SUPER_ADMIN.
    role: own.find((o) => o.id === b.id)?.role ?? "SUPER_ADMIN",
  }));
}

/** Resolve the active businessId from the cookie, else the first membership. */
export async function getActiveBusinessId(): Promise<string | null> {
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  const businesses = await listUserBusinesses();

  // A cookie matching one of the user's own memberships always wins.
  if (preferred && businesses.some((b) => b.id === preferred)) return preferred;

  // Platform admins may pin ANY existing business as the active one.
  if (preferred && !demoMode() && (await isGlobalSuperAdmin())) {
    const exists = await getPrisma().business.findUnique({
      where: { id: preferred },
      select: { id: true },
    });
    if (exists) return preferred;
  }

  if (businesses.length > 0) return businesses[0].id;
  return null;
}

/**
 * Central authorization guard. Used by every admin route, server action and
 * protected server component. Verifies the Supabase session, the local user,
 * the BusinessMember row and the role, then returns the SAFE businessId.
 *
 * - Defaults to the user's active business when no businessId is passed.
 * - SUPER_ADMIN members get platform-level access (see CLAUDE.md).
 * - Rejects (redirects to /login) on any failed check.
 */
export async function requireBusinessAccess(opts?: {
  businessId?: string;
  allowedRoles?: MemberRole[];
}): Promise<BusinessAccess> {
  const allowed = opts?.allowedRoles ?? ["OWNER", "ADMIN", "STAFF"];

  if (demoMode()) {
    return {
      businessId: opts?.businessId ?? DEMO_BUSINESS_ID,
      userId: DEMO_USER.id,
      role: "SUPER_ADMIN",
      isDemo: true,
    };
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const businessId = opts?.businessId ?? (await getActiveBusinessId());
  if (!businessId) redirect("/login");

  const membership = await getPrisma().businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: user.id } },
  });

  // SUPER_ADMIN membership in THIS business → platform-level access.
  if (membership?.role === "SUPER_ADMIN") {
    return { businessId, userId: user.id, role: "SUPER_ADMIN", isDemo: false };
  }

  // Platform-level access. A global SUPER_ADMIN (SUPER_ADMIN in ANY business)
  // may act on ANY business, even without a membership row here — this is the
  // documented cross-business exception (see CLAUDE.md). The businessId is the
  // server-resolved active business and every downstream query stays scoped by
  // it; nothing is trusted from the client.
  if (await isGlobalSuperAdmin()) {
    return { businessId, userId: user.id, role: "SUPER_ADMIN", isDemo: false };
  }

  if (!membership || !allowed.includes(membership.role)) {
    redirect("/login");
  }

  return { businessId, userId: user.id, role: membership.role, isDemo: false };
}

/**
 * Platform-level guard. Only a SUPER_ADMIN BusinessMember may pass — this is
 * the boundary for cross-business / platform admin tools (see CLAUDE.md).
 * Demo mode allows (DEMO_USER is a synthetic SUPER_ADMIN). Blocks clearly:
 * redirect("/login") when unauthenticated, redirect("/admin") when authenticated
 * but not a platform admin.
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  if (demoMode()) return DEMO_USER;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // SUPER_ADMIN on ANY business grants platform-level access.
  const sa = await getPrisma().businessMember.findFirst({
    where: { userId: user.id, role: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (!sa) redirect("/admin");

  return user;
}
