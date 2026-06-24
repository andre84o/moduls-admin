import { describe, it, expect } from "vitest";
import {
  parseDateOnly,
  computeNights,
  computeBookingPrice,
} from "@/lib/booking-pricing";

describe("booking-pricing", () => {
  it("parseDateOnly rejects malformed and overflow dates", () => {
    expect(parseDateOnly("not-a-date")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-02-31")).toBeNull(); // overflow -> rejected
    expect(parseDateOnly("2026-6-1")).toBeNull(); // not zero-padded
  });

  it("parseDateOnly returns a UTC-midnight date", () => {
    const d = parseDateOnly("2026-06-15");
    expect(d?.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("computeNights counts whole nights between two dates", () => {
    const a = parseDateOnly("2026-06-10")!;
    const b = parseDateOnly("2026-06-13")!;
    expect(computeNights(a, b)).toBe(3);
    expect(computeNights(a, a)).toBe(0);
  });

  it("computeBookingPrice totals nights*pricePerNight + cleaningFee (minor units)", () => {
    const p = computeBookingPrice({
      nights: 3,
      pricePerNight: 100000,
      cleaningFee: 50000,
      currency: "sek",
    });
    expect(p.nights).toBe(3);
    expect(p.total).toBe(350000); // 3 * 1000.00 + 500.00 = 3500.00
    expect(p.currency).toBe("sek");
  });
});
