import "server-only";
import { requireSuperAdmin } from "./auth";
import { getPrisma } from "./prisma";
import { DEMO_BUSINESS_ID } from "./config";
import type { ProjectType } from "@/app/generated/prisma/enums";

/**
 * Platform-level reads for the SUPER_ADMIN module-management page. Only a
 * SUPER_ADMIN may use these (guarded via requireSuperAdmin). Cross-business by
 * design — this is the documented exception to per-business tenant scoping.
 */

const MANAGED_MODULES: ProjectType[] = ["WEBSITE", "RENTAL", "BOOKING", "CRM"];

export type BusinessModules = {
  id: string;
  name: string;
  slug: string;
  modules: { WEBSITE: boolean; RENTAL: boolean; BOOKING: boolean; CRM: boolean };
};

/** Every business with its WEBSITE/RENTAL/BOOKING/CRM enablement (ACTIVE Project = on). */
export async function getAllBusinessesWithModules(): Promise<BusinessModules[]> {
  const user = await requireSuperAdmin();

  if (user.isDemo) {
    // Demo: a sample list so the page is browsable without a database.
    return [
      { id: DEMO_BUSINESS_ID, name: "Demo Estates", slug: "demo",
        modules: { WEBSITE: false, RENTAL: true, BOOKING: true, CRM: false } },
      { id: "demo-business-2", name: "Acme Services", slug: "acme",
        modules: { WEBSITE: true, RENTAL: false, BOOKING: true, CRM: true } },
    ];
  }

  // Platform-level access. Only SUPER_ADMIN may view all businesses.
  const businesses = await getPrisma().business.findMany({
    orderBy: { name: "asc" },
    include: {
      projects: { where: { type: { in: MANAGED_MODULES } } },
    },
  });

  return businesses.map((b) => {
    const active = (t: ProjectType) =>
      b.projects.some((p) => p.type === t && p.status === "ACTIVE");
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      modules: {
        WEBSITE: active("WEBSITE"),
        RENTAL: active("RENTAL"),
        BOOKING: active("BOOKING"),
        CRM: active("CRM"),
      },
    };
  });
}
