import { describe, expect, it } from "vitest";
import {
  createRestaurantBookingManagementToken,
  hashRestaurantBookingManagementToken,
  isValidRestaurantBookingManagementToken,
  parseRestaurantBookingManagementToken,
} from "@/modules/restaurant-booking/management-token";

describe("restaurant booking management tokens", () => {
  it("embeds only a public tenant locator and keeps the secret random", () => {
    const token = createRestaurantBookingManagementToken("demo");
    const parsed = parseRestaurantBookingManagementToken(token);

    expect(parsed).toEqual({ businessSlug: "demo" });
    expect(isValidRestaurantBookingManagementToken(token)).toBe(true);
    expect(token).not.toContain("businessId");
  });

  it("stores a deterministic SHA-256 hash instead of the raw capability", () => {
    const token = createRestaurantBookingManagementToken("demo");
    const hash = hashRestaurantBookingManagementToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRestaurantBookingManagementToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("rejects legacy unscoped tokens and malformed tenant locators", () => {
    const legacyToken = "a".repeat(43);
    expect(isValidRestaurantBookingManagementToken(legacyToken)).toBe(false);
    expect(parseRestaurantBookingManagementToken(`***.${"a".repeat(43)}`)).toBeNull();
  });
});
