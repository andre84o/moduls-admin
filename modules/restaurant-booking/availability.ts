import "server-only";

import { getPrisma } from "@/lib/prisma";
import { isRestaurantBookingEnabledForBusiness } from "./guards";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS, type RestaurantAvailabilityResult } from "./types";
import { chooseRestaurantTables } from "./table-assignment";

const ACTIVE_STATUSES = ["PENDING", "PAYMENT_PENDING", "CONFIRMED"] as const;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function safeTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return DEFAULT_RESTAURANT_BOOKING_SETTINGS.timezone;
  }
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}

function zonedMinuteToUtc(dateKey: string, minute: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, min, 0, 0);
  let candidate = new Date(wallClockAsUtc - timezoneOffsetMs(new Date(wallClockAsUtc), timeZone));
  const secondOffset = timezoneOffsetMs(candidate, timeZone);
  candidate = new Date(wallClockAsUtc - secondOffset);
  return candidate;
}

function weekdayForDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export async function getRestaurantAvailabilityForBusiness(input: {
  businessId: string;
  date: string;
  partySize: number;
  now?: Date;
}): Promise<RestaurantAvailabilityResult> {
  const businessId = input.businessId.trim();
  if (!businessId || !validDateKey(input.date) || !Number.isInteger(input.partySize) || input.partySize < 1) {
    return { date: input.date, timezone: DEFAULT_RESTAURANT_BOOKING_SETTINGS.timezone, partySize: input.partySize, slots: [] };
  }
  if (!(await isRestaurantBookingEnabledForBusiness(businessId))) {
    return { date: input.date, timezone: DEFAULT_RESTAURANT_BOOKING_SETTINGS.timezone, partySize: input.partySize, slots: [] };
  }

  const prisma = getPrisma();
  const storedSettings = await prisma.restaurantBookingSettings.findUnique({
    where: { businessId },
    select: {
      timezone: true,
      slotIntervalMin: true,
      defaultDurationMin: true,
      turnaroundMin: true,
      minLeadTimeMin: true,
      bookingHorizonDays: true,
      maxPartySize: true,
      allowTableCombinations: true,
    },
  });
  const settings = storedSettings
    ? { ...storedSettings, timezone: safeTimezone(storedSettings.timezone) }
    : DEFAULT_RESTAURANT_BOOKING_SETTINGS;

  if (input.partySize > settings.maxPartySize) {
    return { date: input.date, timezone: settings.timezone, partySize: input.partySize, slots: [] };
  }

  const weekday = weekdayForDateKey(input.date);
  const periods = await prisma.restaurantServicePeriod.findMany({
    where: { businessId, weekday },
    orderBy: { startMinute: "asc" },
    select: { startMinute: true, endMinute: true },
  });
  if (periods.length === 0) {
    return { date: input.date, timezone: settings.timezone, partySize: input.partySize, slots: [] };
  }

  const now = input.now ?? new Date();
  const earliest = addMinutes(now, settings.minLeadTimeMin);
  const latest = addMinutes(now, settings.bookingHorizonDays * 24 * 60);
  const dayStart = zonedMinuteToUtc(input.date, 0, settings.timezone);
  const dayEnd = zonedMinuteToUtc(input.date, 24 * 60, settings.timezone);

  const [tables, blocked, details] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: {
        businessId,
        active: true,
        OR: [
          { zoneId: null },
          { zone: { is: { active: true } } },
        ],
      },
      select: { id: true, minSeats: true, maxSeats: true, combinationGroup: true },
    }),
    prisma.restaurantBlockedPeriod.findMany({
      where: { businessId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
    prisma.restaurantBookingDetail.findMany({
      where: { businessId },
      select: {
        id: true,
        bookingId: true,
        tables: { where: { businessId }, select: { tableId: true } },
      },
    }),
  ]);

  if (tables.length === 0) {
    return { date: input.date, timezone: settings.timezone, partySize: input.partySize, slots: [] };
  }

  const bookingIds = details.map((detail) => detail.bookingId);
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: {
          businessId,
          id: { in: bookingIds },
          status: { in: [...ACTIVE_STATUSES] },
          startAt: { lt: addMinutes(dayEnd, settings.turnaroundMin) },
          endAt: { gt: addMinutes(dayStart, -settings.turnaroundMin) },
        },
        select: { id: true, startAt: true, endAt: true },
      })
    : [];

  const detailByBooking = new Map(details.map((detail) => [detail.bookingId, detail]));
  const activeTableIds = new Set(tables.map((table) => table.id));
  const slots: RestaurantAvailabilityResult["slots"] = [];

  for (const period of periods) {
    for (
      let minute = period.startMinute;
      minute + settings.defaultDurationMin <= period.endMinute;
      minute += settings.slotIntervalMin
    ) {
      const startAt = zonedMinuteToUtc(input.date, minute, settings.timezone);
      const endAt = addMinutes(startAt, settings.defaultDurationMin);
      let available = startAt >= earliest && startAt <= latest;

      if (available && blocked.some((block) => startAt < block.endAt && endAt > block.startAt)) {
        available = false;
      }

      const occupied = new Set<string>();
      if (available) {
        for (const booking of bookings) {
          const overlaps =
            booking.startAt < addMinutes(endAt, settings.turnaroundMin) &&
            booking.endAt > addMinutes(startAt, -settings.turnaroundMin);
          if (!overlaps) continue;
          const detail = detailByBooking.get(booking.id);
          if (!detail || detail.tables.length === 0) {
            available = false;
            break;
          }
          for (const link of detail.tables) {
            if (!activeTableIds.has(link.tableId)) {
              available = false;
              break;
            }
            occupied.add(link.tableId);
          }
          if (!available) break;
        }
      }

      if (available) {
        available = chooseRestaurantTables({
          tables,
          occupied,
          partySize: input.partySize,
          allowCombinations: settings.allowTableCombinations,
        }) !== null;
      }

      slots.push({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), available });
    }
  }

  return { date: input.date, timezone: settings.timezone, partySize: input.partySize, slots };
}
