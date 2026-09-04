"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireRestaurantBooking } from "./guards";
import {
  DEFAULT_RESTAURANT_BOOKING_SETTINGS,
  type RestaurantBookingSettingsInput,
  type RestaurantTableInput,
} from "./types";

const WRITER_ROLES = ["OWNER", "ADMIN"] as const;
const ACTIVE_TABLE_BLOCKING_STATUSES = ["PENDING", "PAYMENT_PENDING", "CONFIRMED"] as const;

function wholeNumber(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function cleanText(value: string | null | undefined, max: number): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  return text.slice(0, max);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function validateSettings(input: RestaurantBookingSettingsInput): string | null {
  if (!wholeNumber(input.slotIntervalMin, 5, 120)) return "Slot interval must be 5–120 minutes.";
  if (!wholeNumber(input.defaultDurationMin, 15, 480)) return "Booking duration must be 15–480 minutes.";
  if (!wholeNumber(input.turnaroundMin, 0, 180)) return "Turnaround must be 0–180 minutes.";
  if (!wholeNumber(input.minLeadTimeMin, 0, 10_080)) return "Lead time must be 0–10080 minutes.";
  if (!wholeNumber(input.bookingHorizonDays, 1, 365)) return "Booking horizon must be 1–365 days.";
  if (!wholeNumber(input.maxPartySize, 1, 100)) return "Max party size must be 1–100.";
  if (input.confirmationMode !== "AUTO_CONFIRM" && input.confirmationMode !== "REQUEST") return "Invalid confirmation mode.";
  return null;
}

async function getSettingsForBusiness(
  db: Pick<ReturnType<typeof getPrisma>, "restaurantBookingSettings">,
  businessId: string,
) {
  return (
    (await db.restaurantBookingSettings.findUnique({
      where: { businessId },
      select: {
        slotIntervalMin: true,
        defaultDurationMin: true,
        turnaroundMin: true,
        minLeadTimeMin: true,
        bookingHorizonDays: true,
        maxPartySize: true,
        confirmationMode: true,
        allowTableCombinations: true,
      },
    })) ?? DEFAULT_RESTAURANT_BOOKING_SETTINGS
  );
}

export async function saveRestaurantBookingSettings(input: RestaurantBookingSettingsInput): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const error = validateSettings(input);
  if (error) return { error };

  await getPrisma().restaurantBookingSettings.upsert({
    where: { businessId: access.businessId },
    create: { businessId: access.businessId, ...input },
    update: input,
  });

  await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.settings_updated", entityType: "RestaurantBookingSettings", entityId: null });
  revalidatePath("/admin");
  return {};
}

export async function createRestaurantZone(input: { name: string; sortOrder?: number }): Promise<{ id?: string; error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const name = input.name.trim();
  if (!name || name.length > 80) return { error: "Zone name is required (max 80 characters)." };
  const sortOrder = input.sortOrder ?? 0;
  if (!wholeNumber(sortOrder, -10_000, 10_000)) return { error: "Invalid sort order." };

  try {
    const row = await getPrisma().restaurantZone.create({ data: { businessId: access.businessId, name, sortOrder }, select: { id: true } });
    await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.zone_created", entityType: "RestaurantZone", entityId: row.id });
    revalidatePath("/admin");
    return { id: row.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A zone with that name already exists." };
    throw error;
  }
}

export async function updateRestaurantZone(input: { id: string; name?: string; active?: boolean; sortOrder?: number }): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const id = input.id.trim();
  if (!id) return { error: "Missing zone id." };

  const data: { name?: string; active?: boolean; sortOrder?: number } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 80) return { error: "Zone name is required (max 80 characters)." };
    data.name = name;
  }
  if (input.active !== undefined) data.active = input.active;
  if (input.sortOrder !== undefined) {
    if (!wholeNumber(input.sortOrder, -10_000, 10_000)) return { error: "Invalid sort order." };
    data.sortOrder = input.sortOrder;
  }

  try {
    const result = await getPrisma().restaurantZone.updateMany({ where: { id, businessId: access.businessId }, data });
    if (result.count !== 1) return { error: "Zone not found." };
    await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.zone_updated", entityType: "RestaurantZone", entityId: id });
    revalidatePath("/admin");
    return {};
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A zone with that name already exists." };
    throw error;
  }
}

async function validateZone(businessId: string, zoneId: string | null): Promise<boolean> {
  if (!zoneId) return true;
  return (await getPrisma().restaurantZone.findFirst({ where: { id: zoneId, businessId }, select: { id: true } })) !== null;
}

function validateTable(input: RestaurantTableInput): string | null {
  const name = input.name.trim();
  if (!name || name.length > 80) return "Table name is required (max 80 characters).";
  if (!wholeNumber(input.minSeats, 1, 100)) return "Minimum seats must be 1–100.";
  if (!wholeNumber(input.maxSeats, 1, 100)) return "Maximum seats must be 1–100.";
  if (input.minSeats > input.maxSeats) return "Minimum seats cannot exceed maximum seats.";
  if (input.sortOrder !== undefined && !wholeNumber(input.sortOrder, -10_000, 10_000)) return "Invalid sort order.";
  if ((input.combinationGroup?.trim().length ?? 0) > 80) return "Combination group is too long.";
  return null;
}

export async function createRestaurantTable(input: RestaurantTableInput): Promise<{ id?: string; error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const error = validateTable(input);
  if (error) return { error };
  const zoneId = cleanText(input.zoneId, 100);
  if (!(await validateZone(access.businessId, zoneId))) return { error: "Zone not found." };

  try {
    const row = await getPrisma().restaurantTable.create({
      data: { businessId: access.businessId, zoneId, name: input.name.trim(), minSeats: input.minSeats, maxSeats: input.maxSeats, combinationGroup: cleanText(input.combinationGroup, 80), active: input.active ?? true, sortOrder: input.sortOrder ?? 0 },
      select: { id: true },
    });
    await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.table_created", entityType: "RestaurantTable", entityId: row.id });
    revalidatePath("/admin");
    return { id: row.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A table with that name already exists." };
    throw error;
  }
}

export async function updateRestaurantTable(input: { id: string; name?: string; zoneId?: string | null; minSeats?: number; maxSeats?: number; combinationGroup?: string | null; active?: boolean; sortOrder?: number }): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const id = input.id.trim();
  if (!id) return { error: "Missing table id." };

  const prisma = getPrisma();
  const existing = await prisma.restaurantTable.findFirst({ where: { id, businessId: access.businessId }, select: { name: true, zoneId: true, minSeats: true, maxSeats: true, combinationGroup: true, active: true, sortOrder: true } });
  if (!existing) return { error: "Table not found." };

  const candidate: RestaurantTableInput = {
    name: input.name ?? existing.name,
    zoneId: input.zoneId === undefined ? existing.zoneId : input.zoneId,
    minSeats: input.minSeats ?? existing.minSeats,
    maxSeats: input.maxSeats ?? existing.maxSeats,
    combinationGroup: input.combinationGroup === undefined ? existing.combinationGroup : input.combinationGroup,
    active: input.active ?? existing.active,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  };
  const error = validateTable(candidate);
  if (error) return { error };
  const zoneId = cleanText(candidate.zoneId, 100);
  if (!(await validateZone(access.businessId, zoneId))) return { error: "Zone not found." };

  try {
    await prisma.restaurantTable.updateMany({ where: { id, businessId: access.businessId }, data: { name: candidate.name.trim(), zoneId, minSeats: candidate.minSeats, maxSeats: candidate.maxSeats, combinationGroup: cleanText(candidate.combinationGroup, 80), active: candidate.active, sortOrder: candidate.sortOrder } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A table with that name already exists." };
    throw error;
  }

  await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.table_updated", entityType: "RestaurantTable", entityId: id });
  revalidatePath("/admin");
  return {};
}

export async function createRestaurantBooking(input: { guestName: string; guestEmail?: string | null; guestPhone?: string | null; partySize: number; startAt: string; notes?: string | null }): Promise<{ id?: string; error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const guestName = input.guestName.trim();
  if (!guestName || guestName.length > 120) return { error: "Guest name is required." };

  const prisma = getPrisma();
  const settings = await getSettingsForBusiness(prisma, access.businessId);
  if (!wholeNumber(input.partySize, 1, settings.maxPartySize)) return { error: `Party size must be between 1 and ${settings.maxPartySize}.` };
  const startAt = new Date(input.startAt);
  if (Number.isNaN(startAt.getTime())) return { error: "Invalid booking time." };
  const endAt = addMinutes(startAt, settings.defaultDurationMin);

  const bookingId = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({ data: { businessId: access.businessId, guestName, guestEmail: cleanText(input.guestEmail, 200), startAt, endAt, status: "CONFIRMED", notes: cleanText(input.notes, 2000) }, select: { id: true } });
    await tx.restaurantBookingDetail.create({ data: { businessId: access.businessId, bookingId: booking.id, guestPhone: cleanText(input.guestPhone, 40), partySize: input.partySize } });
    return booking.id;
  });

  await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.booking_created", entityType: "Booking", entityId: bookingId, metadata: { partySize: input.partySize } });
  revalidatePath("/admin");
  return { id: bookingId };
}

export async function setRestaurantBookingStatus(bookingId: string, status: "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED"): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const id = bookingId.trim();
  if (!id) return { error: "Missing booking id." };

  const detail = await getPrisma().restaurantBookingDetail.findFirst({ where: { bookingId: id, businessId: access.businessId }, select: { id: true } });
  if (!detail) return { error: "Restaurant booking not found." };
  const result = await getPrisma().booking.updateMany({ where: { id, businessId: access.businessId }, data: { status } });
  if (result.count !== 1) return { error: "Restaurant booking not found." };

  await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.status_changed", entityType: "Booking", entityId: id, metadata: { status } });
  revalidatePath("/admin");
  return {};
}

export async function setRestaurantBookingTables(input: { bookingId: string; tableIds: string[] }): Promise<{ error?: string }> {
  const access = await requireRestaurantBooking({ allowedRoles: [...WRITER_ROLES] });
  if (access.isDemo) return {};
  const bookingId = input.bookingId.trim();
  const tableIds = [...new Set(input.tableIds.map((id) => id.trim()).filter(Boolean))];
  if (!bookingId) return { error: "Missing booking id." };

  const prisma = getPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      const detail = await tx.restaurantBookingDetail.findFirst({ where: { bookingId, businessId: access.businessId }, select: { id: true, partySize: true } });
      if (!detail) throw new Error("BOOKING_NOT_FOUND");
      const booking = await tx.booking.findFirst({ where: { id: bookingId, businessId: access.businessId }, select: { id: true, startAt: true, endAt: true, status: true } });
      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      if (tableIds.length === 0) {
        await tx.bookingTable.deleteMany({ where: { businessId: access.businessId, restaurantBookingId: detail.id } });
        return;
      }
      if (["DECLINED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(booking.status)) throw new Error("BOOKING_INACTIVE");

      const settings = await getSettingsForBusiness(tx, access.businessId);
      if (tableIds.length > 1 && !settings.allowTableCombinations) throw new Error("COMBINATIONS_DISABLED");
      const tables = await tx.restaurantTable.findMany({ where: { businessId: access.businessId, id: { in: tableIds }, active: true }, select: { id: true, minSeats: true, maxSeats: true, combinationGroup: true } });
      if (tables.length !== tableIds.length) throw new Error("TABLE_NOT_FOUND");

      if (tables.length === 1) {
        const table = tables[0];
        if (detail.partySize < table.minSeats || detail.partySize > table.maxSeats) throw new Error("CAPACITY_MISMATCH");
      } else {
        const groups = new Set(tables.map((table) => table.combinationGroup).filter(Boolean));
        if (groups.size !== 1 || tables.some((table) => !table.combinationGroup)) throw new Error("INVALID_COMBINATION");
        if (tables.reduce((sum, table) => sum + table.maxSeats, 0) < detail.partySize) throw new Error("CAPACITY_MISMATCH");
      }

      const links = await tx.bookingTable.findMany({ where: { businessId: access.businessId, tableId: { in: tableIds }, restaurantBookingId: { not: detail.id } }, select: { restaurantBooking: { select: { bookingId: true, businessId: true } } } });
      const conflictingBookingIds = links.filter((link) => link.restaurantBooking.businessId === access.businessId).map((link) => link.restaurantBooking.bookingId);
      if (conflictingBookingIds.length > 0) {
        const conflict = await tx.booking.findFirst({ where: { businessId: access.businessId, id: { in: conflictingBookingIds }, status: { in: [...ACTIVE_TABLE_BLOCKING_STATUSES] }, startAt: { lt: addMinutes(booking.endAt, settings.turnaroundMin) }, endAt: { gt: addMinutes(booking.startAt, -settings.turnaroundMin) } }, select: { id: true } });
        if (conflict) throw new Error("TABLE_CONFLICT");
      }

      await tx.bookingTable.deleteMany({ where: { businessId: access.businessId, restaurantBookingId: detail.id } });
      await tx.bookingTable.createMany({ data: tableIds.map((tableId) => ({ businessId: access.businessId, restaurantBookingId: detail.id, tableId })) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return { error: "Booking changed concurrently. Please try again." };
    if (error instanceof Error) {
      const messages: Record<string, string> = { BOOKING_NOT_FOUND: "Restaurant booking not found.", BOOKING_INACTIVE: "Tables cannot be assigned to an inactive booking.", COMBINATIONS_DISABLED: "Table combinations are disabled.", TABLE_NOT_FOUND: "One or more tables were not found or are inactive.", CAPACITY_MISMATCH: "Selected table capacity does not fit the party size.", INVALID_COMBINATION: "Selected tables are not in the same combination group.", TABLE_CONFLICT: "One or more tables are already booked for that time." };
      if (messages[error.message]) return { error: messages[error.message] };
    }
    throw error;
  }

  await writeAuditLog({ businessId: access.businessId, userId: access.userId, action: "restaurant_booking.tables_assigned", entityType: "Booking", entityId: bookingId, metadata: { tableCount: tableIds.length } });
  revalidatePath("/admin");
  return {};
}
