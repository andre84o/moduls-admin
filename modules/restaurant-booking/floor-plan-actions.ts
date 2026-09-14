"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireRestaurantBooking } from "./guards";
import { isValidRestaurantFloorPlanItem } from "./floor-plan";
import type { RestaurantTableLayoutInput } from "./types";

const WRITER_ROLES = ["OWNER", "ADMIN"] as const;
const MAX_FLOOR_PLAN_ITEMS = 250;

export async function saveRestaurantFloorPlan(input: {
  items: RestaurantTableLayoutInput[];
}): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({
    allowedRoles: [...WRITER_ROLES],
  });
  if (access.isDemo) return {};

  if (input.items.length > MAX_FLOOR_PLAN_ITEMS) {
    return { error: `A floor plan can contain at most ${MAX_FLOOR_PLAN_ITEMS} tables.` };
  }

  const tableIds = input.items.map((item) => item.tableId.trim());
  if (new Set(tableIds).size !== tableIds.length) {
    return { error: "A table can only appear once on the floor plan." };
  }

  const normalized = input.items.map((item) => ({
    ...item,
    tableId: item.tableId.trim(),
  }));
  if (normalized.some((item) => !isValidRestaurantFloorPlanItem(item))) {
    return { error: "One or more floor plan items are invalid or outside the canvas." };
  }

  const prisma = getPrisma();
  const ownedTables = tableIds.length
    ? await prisma.restaurantTable.findMany({
        where: {
          businessId: access.businessId,
          id: { in: tableIds },
        },
        select: { id: true },
      })
    : [];

  if (ownedTables.length !== tableIds.length) {
    return { error: "One or more tables were not found for this business." };
  }

  await prisma.$transaction(async (tx) => {
    if (tableIds.length === 0) {
      await tx.restaurantTableLayout.deleteMany({
        where: { businessId: access.businessId },
      });
    } else {
      await tx.restaurantTableLayout.deleteMany({
        where: {
          businessId: access.businessId,
          tableId: { notIn: tableIds },
        },
      });
    }

    for (const item of normalized) {
      await tx.restaurantTableLayout.upsert({
        where: {
          businessId_tableId: {
            businessId: access.businessId,
            tableId: item.tableId,
          },
        },
        create: {
          businessId: access.businessId,
          tableId: item.tableId,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          shape: item.shape,
          rotation: item.rotation,
        },
        update: {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          shape: item.shape,
          rotation: item.rotation,
        },
      });
    }
  });

  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "restaurant_booking.floor_plan_updated",
    entityType: "RestaurantFloorPlan",
    entityId: null,
    metadata: { tableCount: normalized.length },
  });

  revalidatePath("/admin");
  return {};
}
