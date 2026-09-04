"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireRestaurantBooking } from "./guards";
import { getRestaurantAvailabilityForBusiness } from "./availability";

const WRITER_ROLES = ["OWNER", "ADMIN"] as const;

function wholeNumber(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function saveRestaurantBookingTimezone(timezone: string): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const value = timezone.trim();
  if (!value || value.length > 80 || !validTimezone(value)) return { error: "Invalid timezone." };
  await getPrisma().restaurantBookingSettings.upsert({
    where: { businessId: access.businessId },
    create: { businessId: access.businessId, timezone: value },
    update: { timezone: value },
  });
  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "restaurant_booking.timezone_updated",
    entityType: "RestaurantBookingSettings",
    entityId: null,
    metadata: { timezone: value },
  });
  revalidatePath("/admin");
  return {};
}

export async function createRestaurantServicePeriod(input: {
  weekday: number;
  startMinute: number;
  endMinute: number;
}): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  if (!wholeNumber(input.weekday, 0, 6)) return { error: "Invalid weekday." };
  if (!wholeNumber(input.startMinute, 0, 1439) || !wholeNumber(input.endMinute, 1, 1440)) {
    return { error: "Invalid service time." };
  }
  if (input.endMinute <= input.startMinute) return { error: "End time must be after start time." };

  const overlap = await getPrisma().restaurantServicePeriod.findFirst({
    where: {
      businessId: access.businessId,
      weekday: input.weekday,
      startMinute: { lt: input.endMinute },
      endMinute: { gt: input.startMinute },
    },
    select: { id: true },
  });
  if (overlap) return { error: "Service periods cannot overlap." };

  const row = await getPrisma().restaurantServicePeriod.create({
    data: { businessId: access.businessId, ...input },
    select: { id: true },
  });
  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "restaurant_booking.service_period_created",
    entityType: "RestaurantServicePeriod",
    entityId: row.id,
  });
  revalidatePath("/admin");
  return {};
}

export async function deleteRestaurantServicePeriod(id: string): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const result = await getPrisma().restaurantServicePeriod.deleteMany({
    where: { id: id.trim(), businessId: access.businessId },
  });
  if (result.count !== 1) return { error: "Service period not found." };
  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "restaurant_booking.service_period_deleted",
    entityType: "RestaurantServicePeriod",
    entityId: id,
  });
  revalidatePath("/admin");
  return {};
}

export async function createRestaurantBlockedPeriod(input: {
  startAt: string;
  endAt: string;
  reason?: string | null;
}): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return { error: "Choose a valid blocked period." };
  }
  const reason = input.reason?.trim().slice(0, 200) || null;
  const row = await getPrisma().restaurantBlockedPeriod.create({
    data: { businessId: access.businessId, startAt, endAt, reason },
    select: { id: true },
  });
  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "restaurant_booking.blocked_period_created",
    entityType: "RestaurantBlockedPeriod",
    entityId: row.id,
  });
  revalidatePath("/admin");
  return {};
}

export async function deleteRestaurantBlockedPeriod(id: string): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const result = await getPrisma().restaurantBlockedPeriod.deleteMany({
    where: { id: id.trim(), businessId: access.businessId },
  });
  if (result.count !== 1) return { error: "Blocked period not found." };
  await writeAuditLog({
    businessId: access.businessId,
    userId: access.userId,
    action: "restaurant_booking.blocked_period_deleted",
    entityType: "RestaurantBlockedPeriod",
    entityId: id,
  });
  revalidatePath("/admin");
  return {};
}

export async function previewRestaurantAvailability(input: {
  date: string;
  partySize: number;
}) {
  const access = await requireRestaurantBooking();
  if (access.isDemo) return { date: input.date, timezone: "Europe/Stockholm", partySize: input.partySize, slots: [] };
  return getRestaurantAvailabilityForBusiness({
    businessId: access.businessId,
    date: input.date,
    partySize: input.partySize,
  });
}
