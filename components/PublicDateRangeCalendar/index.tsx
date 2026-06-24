"use client";

import "react-day-picker/style.css";

import { DayPicker, type DateRange, type Matcher } from "react-day-picker";

export type DateRangeValue = { checkIn: string | null; checkOut: string | null };

type Props = {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  reservedRanges: { start: string; end: string }[]; // "yyyy-mm-dd", end EXCLUSIVE (checkout day is free)
  minNights: number;
};

// LOCAL-time helpers to avoid UTC shift.
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const fromYmd = (s: string) => {
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(y, m - 1, dd);
};

export default function PublicDateRangeCalendar({
  value,
  onChange,
  reservedRanges,
  minNights,
}: Props) {
  // Local midnight today.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Disable past dates and every reserved NIGHT.
  // end is exclusive, so the last disabled night is end - 1 day.
  const disabled: Matcher[] = [
    { before: today },
    ...reservedRanges.map((r) => ({
      from: fromYmd(r.start),
      to: new Date(fromYmd(r.end).getTime() - 86_400_000),
    })),
  ];

  const selected: DateRange | undefined = value.checkIn
    ? {
        from: fromYmd(value.checkIn),
        to: value.checkOut ? fromYmd(value.checkOut) : undefined,
      }
    : undefined;

  return (
    <div className="public-date-range-calendar">
      <DayPicker
        mode="range"
        selected={selected}
        onSelect={(range) =>
          onChange({
            checkIn: range?.from ? toYmd(range.from) : null,
            checkOut: range?.to ? toYmd(range.to) : null,
          })
        }
        disabled={disabled}
        // Range "days" count = nights + 1, so min nights N needs min N+1 days.
        min={minNights + 1}
        excludeDisabled
        numberOfMonths={1}
        startMonth={today}
      />
    </div>
  );
}
