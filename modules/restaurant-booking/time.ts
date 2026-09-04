import "server-only";

import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";

export function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function safeTimezone(value: string) {
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

export function zonedMinuteToUtc(dateKey: string, minute: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, min, 0, 0);
  let candidate = new Date(wallClockAsUtc - timezoneOffsetMs(new Date(wallClockAsUtc), timeZone));
  const secondOffset = timezoneOffsetMs(candidate, timeZone);
  candidate = new Date(wallClockAsUtc - secondOffset);
  return candidate;
}

export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateKey = `${values.year}-${values.month}-${values.day}`;
  return {
    dateKey,
    minute: Number(values.hour) * 60 + Number(values.minute),
    weekday: weekdayForDateKey(dateKey),
  };
}

export function weekdayForDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}
