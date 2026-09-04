"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "./auth";
import { getPrisma } from "./prisma";
import { writeAuditLog } from "./audit";
import { isDemoMode } from "./config";
import {
  KNOWN_FEATURE_KEYS,
  CATERING_FEATURE_KEY,
  RENTAL_BOOKING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
} from "./feature-access";
import type { ProjectType } from "@/app/generated/prisma/enums";

/**
 * Toggle a customer-facing module. BOOKING is intentionally excluded because
 * it is the shared technical engine behind booking products, not a sellable
 * product by itself.
 */
const TOGGLEABLE = new Set<ProjectType>([
  "WEBSITE",
  "RENTAL",
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

    // A product entitlement cannot remain enabled after its parent capability
    // has been explicitly disabled.
    if (type === "RENTAL") {
      await prisma.businessFeatureAccess.updateMany({
        where: { businessId, key: RENTAL_BOOKING_FEATURE_KEY },
        data: { enabled: false },
      });
    }
    if (type === "RESTAURANT") {
      await prisma.businessFeatureAccess.updateMany({
        where: {
          businessId,
          key: { in: [CATERING_FEATURE_KEY, RESTAURANT_BOOKING_FEATURE_KEY] },
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

/** Grant or revoke a paid product/add-on for a business. SUPER_ADMIN only. */
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

  if (enabled && key === RENTAL_BOOKING_FEATURE_KEY) {
    const rental = await prisma.project.findFirst({
      where: { businessId, type: "RENTAL", status: "ACTIVE" },
      select: { id: true },
    });
    if (!rental) return;
    await ensureModuleActive(businessId, "BOOKING");
  }

  if (enabled && key === RESTAURANT_BOOKING_FEATURE_KEY) {
    const restaurant = await prisma.project.findFirst({
      where: { businessId, type: "RESTAURANT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!restaurant) return;
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
