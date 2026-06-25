import { describe, it, expect } from "vitest";
import { planMissingSections, type SeedSection } from "@/modules/website/utils";

const CONFIG: SeedSection[] = [
  { type: "siteHeader", content: { brand: { primary: "A", accent: "B" }, nav: [] } },
  { type: "hero", content: { heading: "H" } },
  { type: "featureGrid", content: { items: [] } },
  { type: "siteFooter", content: { brand: { primary: "A", accent: "B" }, copyright: "c" } },
];

describe("website home sync — planMissingSections", () => {
  it("plans every config section, in order from sortOrder 0, when none exist", () => {
    const plan = planMissingSections(CONFIG, []);
    expect(plan.map((p) => p.type)).toEqual([
      "siteHeader",
      "hero",
      "featureGrid",
      "siteFooter",
    ]);
    expect(plan.map((p) => p.sortOrder)).toEqual([0, 1, 2, 3]);
    // content is carried through unchanged for both draft + published seeding
    expect(plan[1].content).toEqual({ heading: "H" });
  });

  it("creates nothing when all config types already exist (idempotent)", () => {
    const existing = CONFIG.map((c, i) => ({ type: c.type, sortOrder: i }));
    expect(planMissingSections(CONFIG, existing)).toEqual([]);
  });

  it("creates only the genuinely missing types and appends after current max", () => {
    // page already has hero (#0) and siteFooter (#5); restore the two missing.
    const existing = [
      { type: "hero", sortOrder: 0 },
      { type: "siteFooter", sortOrder: 5 },
    ];
    const plan = planMissingSections(CONFIG, existing);
    expect(plan.map((p) => p.type)).toEqual(["siteHeader", "featureGrid"]);
    // appended after max existing sortOrder (5) -> 6, 7
    expect(plan.map((p) => p.sortOrder)).toEqual([6, 7]);
  });

  it("treats any section of a type as present (matches by type, ignores content)", () => {
    const existing = [{ type: "hero", sortOrder: 2 }];
    const plan = planMissingSections(CONFIG, existing);
    expect(plan.map((p) => p.type)).not.toContain("hero");
  });

  it("never plans duplicates when config contains repeated types", () => {
    const dup: SeedSection[] = [
      { type: "hero", content: { heading: "first" } },
      { type: "hero", content: { heading: "second" } },
    ];
    const plan = planMissingSections(dup, []);
    expect(plan).toHaveLength(1);
    expect(plan[0].content).toEqual({ heading: "first" });
  });
});
