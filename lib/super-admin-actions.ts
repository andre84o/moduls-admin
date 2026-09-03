"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "./auth";
import { getPrisma } from "./prisma";
import { writeAuditLog } from "./audit";
import { isDemoMode } from "./config";
import {
  KNOWN_FEATURE_KEYS,
  CATERING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
} from "./feature-access";
import type { ProjectType } from "@/app/generated/prisma/enums";

/**
 * Toggle an optional module (WEBSITE / RENTAL / BOOKING / CRM / RESTAURANT) for
 * a business. SUPER_ADMIN only. Disabling preserves rows/data and only changes
 * Project.status.
 */
const TOGGLEABLE = new Set<ProjectType>([
  "WEBSITE",
  "RENTAL",
  "BOOKING",
  "CRM",
  "RESTAURANT",
]);

async function ensureModuleActive(businessId: string, type: ProjectType) {
  const prisma = getPrisma();
  const res = await prisma.project.updateMany({
    where: { businessId, type },
    data: { status: "ACTIVE" },
  });
  if (res.count === 0) {
    await prisma.project.create({
      data: { businessId, name: type, type, status: "ACTIVE" },
    });
  }
}

export async function setModuleEnabled(formData: FormData) {
  const user = await requireSuperAdmin();

  const businessId = String(formData.get("businessId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() as ProjectType;
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!businessId || !TOGGLEABLE.has(type)) return;
  if (isDemoMode()) return;

  const prisma = getPrisma();
  if (enabled) {
    await ensureModuleActive(businessId, type);
  } else {
    await prisma.project.updateMany({
      where: { businessId, type },
      data: { status: "DISABLED" },
    });

    // Restaurant Booking cannot remain granted when its booking engine or
    // Restaurant capability is explicitly disabled.
    if (type === "BOOKING" || type === "RESTAURANT") {
      await prisma.businessFeatureAccess.updateMany({
        where: {
          businessId,
          key: RESTAURANT_BOOKING_FEATURE_KEY,
        },
        data: { enabled: false },
      });
    }
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
  revalidatePath("/admin");
}

/**
 * Grant or revoke a paid add-on for a business. SUPER_ADMIN only.
 * Add-ons live in BusinessFeatureAccess and never become ProjectType values.
 */
export async function setBusinessFeatureAccess(input: {
  businessId: string;
  key: string;
  enabled: boolean;
}) {
  const user = await requireSuperAdmin();

  const businessId = input.businessId.trim();
  const key = input.key.trim();
  const enabled = Boolean(input.enabled);
  if (!businessId || !KNOWN_FEATURE_KEYS.has(key)) return;
  if (isDemoMode()) return;

  const prisma = getPrisma();

  if (enabled && key === RESTAURANT_BOOKING_FEATURE_KEY) {
    // Product rule: Restaurant Booking is an add-on to RESTAURANT, not a way to
    // silently turn RESTAURANT on. The Super Admin must enable RESTAURANT first.
    const restaurant = await prisma.project.findFirst({
      where: { businessId, type: "RESTAURANT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!restaurant) return;

    // BOOKING is the shared technical engine. Enabling Restaurant Booking makes
    // sure it is available, without changing RENTAL or any other product access.
    await ensureModuleActive(businessId, "BOOKING");
  }

  await prisma.businessFeatureAccess.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, enabled },
    update: { enabled },
  });

  await writeAuditLog({
    businessId,
    userId: user.id,
    action: enabled ? "feature.enabled" : "feature.disabled",
    entityType: "BusinessFeatureAccess",
    entityId: null,
    metadata: { key },
  });

  // When CATERING is enabled, seed a default cateringMenus section if none
  // exists so the admin sees it immediately without clicking "Add menu".
  if (enabled && key === CATERING_FEATURE_KEY) {
    const page = await prisma.websitePage.findFirst({
      where: { businessId },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });

    if (page) {
      const existing = await prisma.websiteSection.findFirst({
        where: { businessId, type: "cateringMenus" },
        select: { id: true },
      });

      if (!existing) {
        const orders = await prisma.websiteSection.findMany({
          where: { businessId, pageId: page.id },
          select: { sortOrder: true },
        });
        const maxOrder =
          orders.length > 0 ? Math.max(...orders.map((o) => o.sortOrder)) : -1;

        await prisma.websiteSection.create({
          data: {
            businessId,
            pageId: page.id,
            type: "cateringMenus",
            sortOrder: maxOrder + 1,
            draftContent: {},
            publishedContent: {},
          },
        });
      }
    }
  }

  revalidatePath("/admin/super/modules");
  revalidatePath("/admin");
}
