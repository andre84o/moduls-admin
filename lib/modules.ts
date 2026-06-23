import "server-only";
import { redirect } from "next/navigation";
import { ProjectType } from "@/app/generated/prisma/enums";
import type { MemberRole } from "@/app/generated/prisma/enums";
import { requireBusinessAccess, type BusinessAccess } from "./auth";
import { getPrisma } from "./prisma";

/**
 * Server-side module enablement boundary for the multi-tenant SaaS.
 *
 * A module is "enabled" for a business when there is a `Project` row for that
 * business with status ACTIVE — its `type` (CRM, BOOKING, WEBSITE, RENTAL,
 * ECOMMERCE, CUSTOM) is the module key. Different businesses can have different
 * modules enabled; this is the one place that decides.
 *
 * SECURITY (CLAUDE.md, multi-tenant):
 *  - The businessId is ALWAYS resolved server-side via requireBusinessAccess
 *    (session + BusinessMember). It is never accepted from the client. The
 *    optional `access` param only lets an already-validated caller (the loaders)
 *    reuse a server-produced BusinessAccess instead of re-resolving it.
 *  - Demo mode enables ALL modules (built from the enum so it never drifts).
 *
 * CORE vs MODULES: Media and Overview are CORE admin surfaces, available to
 * every business. They are intentionally NOT represented here and are never
 * gated through this boundary — only optional modules are.
 *
 * Server-only: never import this into a client component.
 */

/**
 * The set of modules enabled for the caller's business.
 *
 * Pass an already-resolved `access` to avoid re-resolving (loaders do this);
 * otherwise the SAFE access is resolved here. Demo mode returns every module.
 */
export async function getEnabledModules(
  access?: BusinessAccess,
): Promise<Set<ProjectType>> {
  const safe = access ?? (await requireBusinessAccess());

  // Demo mode: every module is enabled. Build from the enum values so this
  // never drifts if ProjectType changes.
  if (safe.isDemo) {
    return new Set(Object.values(ProjectType) as ProjectType[]);
  }

  const rows = await getPrisma().project.findMany({
    where: { businessId: safe.businessId, status: "ACTIVE" },
    select: { type: true },
  });

  return new Set(rows.map((r) => r.type));
}

/** Whether a single module is enabled for the caller's business. */
export async function isModuleEnabled(
  type: ProjectType,
  access?: BusinessAccess,
): Promise<boolean> {
  const enabled = await getEnabledModules(access);
  return enabled.has(type);
}

/**
 * Hard security boundary for module-specific routes and mutating server
 * actions. Resolves access, then blocks clearly (redirect to /admin) unless
 * the module is enabled for the resolved business. Returns the SAFE access.
 */
export async function requireModule(
  type: ProjectType,
  opts?: { allowedRoles?: MemberRole[] },
): Promise<BusinessAccess> {
  const access = await requireBusinessAccess(opts);

  // Demo mode has every module enabled.
  if (access.isDemo) return access;

  if (!(await isModuleEnabled(type, access))) {
    redirect("/admin");
  }

  return access;
}
