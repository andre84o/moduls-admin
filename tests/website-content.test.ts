import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  normalizeSlug,
  nextSortOrder,
} from "@/modules/website/utils";

describe("website-content utils", () => {
  it("normalizeKey lowercases, strips diacritics, and hyphenates", () => {
    expect(normalizeKey("Home")).toBe("home");
    expect(normalizeKey("  About Us  ")).toBe("about-us");
    expect(normalizeKey("Våra Tjänster")).toBe("vara-tjanster");
    expect(normalizeKey("Contact / FAQ")).toBe("contact-faq");
    expect(normalizeKey("___leading--trailing___")).toBe("leading-trailing");
  });

  it("normalizeKey returns empty string when nothing usable remains", () => {
    expect(normalizeKey("   ")).toBe("");
    expect(normalizeKey("///")).toBe("");
  });

  it("normalizeSlug maps blank/unusable input to null, never empty string", () => {
    expect(normalizeSlug(null)).toBeNull();
    expect(normalizeSlug(undefined)).toBeNull();
    expect(normalizeSlug("   ")).toBeNull();
    expect(normalizeSlug("///")).toBeNull();
    expect(normalizeSlug("Our Story")).toBe("our-story");
  });

  it("nextSortOrder appends after the current max, 0 when empty", () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([0])).toBe(1);
    expect(nextSortOrder([0, 1, 2])).toBe(3);
    expect(nextSortOrder([5, 2, 9, 1])).toBe(10);
  });

  it("nextSortOrder ignores non-finite values", () => {
    expect(nextSortOrder([0, Number.NaN, 3, Number.POSITIVE_INFINITY])).toBe(4);
  });
});
