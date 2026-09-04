import { describe, expect, it } from "vitest";
import {
  safeTimezone,
  validDateKey,
  weekdayForDateKey,
  zonedMinuteToUtc,
  zonedParts,
} from "@/modules/restaurant-booking/time";

describe("Restaurant Booking timezone helpers", () => {
  it("validates date-key shape", () => {
    expect(validDateKey("2026-09-04")).toBe(true);
    expect(validDateKey("2026-9-4")).toBe(false);
    expect(validDateKey("04-09-2026")).toBe(false);
  });

  it("falls back to Europe/Stockholm for an invalid timezone", () => {
    expect(safeTimezone("Definitely/Not-A-Timezone")).toBe("Europe/Stockholm");
  });

  it("converts Stockholm winter wall time to UTC", () => {
    expect(zonedMinuteToUtc("2026-01-15", 17 * 60, "Europe/Stockholm").toISOString()).toBe(
      "2026-01-15T16:00:00.000Z",
    );
  });

  it("converts Stockholm summer wall time to UTC", () => {
    expect(zonedMinuteToUtc("2026-07-15", 17 * 60, "Europe/Stockholm").toISOString()).toBe(
      "2026-07-15T15:00:00.000Z",
    );
  });

  it("handles the spring DST transition after the skipped hour", () => {
    expect(zonedMinuteToUtc("2026-03-29", 3 * 60 + 30, "Europe/Stockholm").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });

  it("maps UTC instants back to the correct Stockholm local parts", () => {
    expect(zonedParts(new Date("2026-01-15T16:00:00.000Z"), "Europe/Stockholm")).toEqual({
      dateKey: "2026-01-15",
      minute: 17 * 60,
      weekday: 4,
    });
    expect(zonedParts(new Date("2026-07-15T15:00:00.000Z"), "Europe/Stockholm")).toEqual({
      dateKey: "2026-07-15",
      minute: 17 * 60,
      weekday: 3,
    });
  });

  it("computes weekday from a date key without local-machine timezone leakage", () => {
    expect(weekdayForDateKey("2026-09-04")).toBe(5);
  });
});
