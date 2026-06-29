"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "./auth";
import { getPrisma } from "./prisma";
import { writeAuditLog } from "./audit";
import { isDemoMode } from "./config";
import type { ProjectType } from "@/app/generated/prisma/enums";

/**
 * Toggle an optional module (WEBSITE / RENTAL / BOOKING / CRM) for a business.
 * SUPER_ADMIN only. Enabled = an ACTIVE Project row of that type exists;
 * disabling sets the row(s) to DISABLED and NEVER deletes. Media is core and not
 * toggleable.
 */

const TOGGLEABLE = new Set<ProjectType>(["WEBSITE", "RENTAL", "BOOKING", "CRM"]);

export async function setModuleEnabled(formData: FormData) {
  const user = await requireSuperAdmin();

  const businessId = String(formData.get("businessId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() as ProjectType;
  const enabled = String(formData.get("enabled") ?? "") === "true";

  // Whitelist: never allow toggling Media (core) or any non-module type.
  if (!businessId || !TOGGLEABLE.has(type)) return;

  if (isDemoMode()) return; // no-op in demo

  // businessId comes from the form ON PURPOSE: requireSuperAdmin grants
  // platform-level access, so a SUPER_ADMIN may legitimately target ANY business.
  const prisma = getPrisma();

  if (enabled) {
    // No unique (businessId,type) constraint exists, so flip existing rows ACTIVE
    // and only create one when none exist.
    const res = await prisma.project.updateMany({
      where: { businessId, type },
      data: { status: "ACTIVE" },
    });
    if (res.count === 0) {
      await prisma.project.create({
        data: { businessId, name: type, type, status: "ACTIVE" },
      });
    }
  } else {
    await prisma.project.updateMany({
      where: { businessId, type },
      data: { status: "DISABLED" },
    });
  }

  await writeAuditLog({
    businessId,
    userId: user.id,
    action: enabled ? "module.enabled" : "module.disabled",
    entityType: "Project",
    entityId: null,
    metadata: { type },
  });

  revalidatePath("/admin/super/modules");
}
