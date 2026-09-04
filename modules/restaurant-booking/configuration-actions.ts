"use server";

import {
  updateRestaurantTable,
  updateRestaurantZone,
} from "./actions";
import {
  createRestaurantBlockedPeriod,
  createRestaurantServicePeriod,
  deleteRestaurantBlockedPeriod,
  deleteRestaurantServicePeriod,
  previewRestaurantAvailability,
  saveRestaurantBookingTimezone,
} from "./schedule-actions";
import { requireRestaurantBooking } from "./guards";
import { getPrisma } from "@/lib/prisma";
import {
  findAnyFutureRestaurantBookingConflict,
  findBlockedRangeConflict,
  findFutureTableConflict,
  findFutureZoneConflict,
  findServicePeriodDeletionConflict,
  futureBookingConflictMessage,
} from "./conflicts";

const WRITER_ROLES = ["OWNER", "ADMIN"] as const;

export async function updateRestaurantZoneSafely(input: {
  id: string;
  name?: string;
  active?: boolean;
  sortOrder?: number;
}) {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};

  if (input.active === false) {
    const conflict = await findFutureZoneConflict({
      businessId: access.businessId,
      zoneId: input.id.trim(),
    });
    if (conflict) {
      return {
        error: futureBookingConflictMessage(
          "This zone cannot be disabled.",
          conflict,
        ),
      };
    }
  }

  return updateRestaurantZone(input);
}

export async function updateRestaurantTableSafely(input: {
  id: string;
  name?: string;
  zoneId?: string | null;
  minSeats?: number;
  maxSeats?: number;
  combinationGroup?: string | null;
  active?: boolean;
  sortOrder?: number;
}) {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};

  const id = input.id.trim();
  const current = await getPrisma().restaurantTable.findFirst({
    where: { businessId: access.businessId, id },
    select: {
      active: true,
      zoneId: true,
      minSeats: true,
      maxSeats: true,
      combinationGroup: true,
    },
  });
  if (!current) return { error: "Table not found." };

  const inventoryChanged =
    input.active === false ||
    (input.zoneId !== undefined && input.zoneId !== current.zoneId) ||
    (input.minSeats !== undefined && input.minSeats !== current.minSeats) ||
    (input.maxSeats !== undefined && input.maxSeats !== current.maxSeats) ||
    (input.combinationGroup !== undefined &&
      (input.combinationGroup?.trim() || null) !== current.combinationGroup);

  if (inventoryChanged) {
    const conflict = await findFutureTableConflict({
      businessId: access.businessId,
      tableId: id,
    });
    if (conflict) {
      return {
        error: futureBookingConflictMessage(
          "This table configuration cannot be changed while it is assigned to a future active booking.",
          conflict,
        ),
      };
    }
  }

  return updateRestaurantTable(input);
}

export async function saveRestaurantBookingTimezoneSafely(timezone: string) {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const current = await getPrisma().restaurantBookingSettings.findUnique({
    where: { businessId: access.businessId },
    select: { timezone: true },
  });
  const next = timezone.trim();
  if (current?.timezone && next !== current.timezone) {
    const conflict = await findAnyFutureRestaurantBookingConflict(access.businessId);
    if (conflict) {
      return {
        error: futureBookingConflictMessage(
          "Timezone cannot be changed while future active restaurant bookings exist.",
          conflict,
        ),
      };
    }
  }
  return saveRestaurantBookingTimezone(timezone);
}

export async function createRestaurantServicePeriodSafely(input: {
  weekday: number;
  startMinute: number;
  endMinute: number;
}) {
  return createRestaurantServicePeriod(input);
}

export async function deleteRestaurantServicePeriodSafely(id: string) {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const period = await getPrisma().restaurantServicePeriod.findFirst({
    where: { id: id.trim(), businessId: access.businessId },
    select: { weekday: true, startMinute: true, endMinute: true },
  });
  if (!period) return { error: "Service period not found." };
  const conflict = await findServicePeriodDeletionConflict({
    businessId: access.businessId,
    ...period,
  });
  if (conflict) {
    return {
      error: futureBookingConflictMessage(
        "This service period cannot be removed.",
        conflict,
      ),
    };
  }
  return deleteRestaurantServicePeriod(id);
}

export async function createRestaurantBlockedPeriodSafely(input: {
  startAt: string;
  endAt: string;
  reason?: string | null;
}) {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (!Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime())) {
    const conflict = await findBlockedRangeConflict({
      businessId: access.businessId,
      startAt,
      endAt,
    });
    if (conflict) {
      return {
        error: futureBookingConflictMessage(
          "This blocked period cannot be created.",
          conflict,
        ),
      };
    }
  }
  return createRestaurantBlockedPeriod(input);
}

export async function deleteRestaurantBlockedPeriodSafely(id: string) {
  return deleteRestaurantBlockedPeriod(id);
}

export async function previewRestaurantAvailabilitySafely(input: {
  date: string;
  partySize: number;
}) {
  return previewRestaurantAvailability(input);
}
