import { describe, it, expect } from "vitest";
import { mapPublishedSections } from "@/modules/website/utils";

describe("website public home — mapPublishedSections", () => {
  it("maps known section types into { type, props } using publishedContent", () => {
    const rows = [
      { type: "hero", publishedContent: { eyebrow: "Hi", heading: "H", body: "B", cta: { label: "Go", href: "/x" } } },
      { type: "featureGrid", publishedContent: { items: [{ title: "T", text: "X" }] } },
    ];
    expect(mapPublishedSections(rows)).toEqual([
      { type: "hero", props: { eyebrow: "Hi", heading: "H", body: "B", cta: { label: "Go", href: "/x" } } },
      { type: "featureGrid", props: { items: [{ title: "T", text: "X" }] } },
    ]);
  });

  it("preserves the given order (caller orders by sortOrder)", () => {
    const rows = [
      { type: "siteHeader", publishedContent: { brand: { primary: "A", accent: "B" }, nav: [] } },
      { type: "hero", publishedContent: { eyebrow: "", heading: "", body: "", cta: { label: "", href: "" } } },
      { type: "siteFooter", publishedContent: { brand: { primary: "A", accent: "B" }, copyright: "c" } },
    ];
    expect(mapPublishedSections(rows).map((s) => s.type)).toEqual([
      "siteHeader",
      "hero",
      "siteFooter",
    ]);
  });

  it("skips unknown section types", () => {
    const rows = [
      { type: "hero", publishedContent: { eyebrow: "", heading: "", body: "", cta: { label: "", href: "" } } },
      { type: "mysteryWidget", publishedContent: { foo: "bar" } },
    ];
    expect(mapPublishedSections(rows).map((s) => s.type)).toEqual(["hero"]);
  });

  it("skips sections with null/missing publishedContent (never published)", () => {
    const rows = [
      { type: "hero", publishedContent: null },
      { type: "featureGrid", publishedContent: undefined },
    ];
    expect(mapPublishedSections(rows)).toEqual([]);
  });

  it("returns an empty array for no rows", () => {
    expect(mapPublishedSections([])).toEqual([]);
  });

  it("skips partial/empty content that would otherwise crash the renderer", () => {
    // The renderer reads cta.href, maps nav/items, etc. Content missing the
    // minimum shape for its type must be skipped, never rendered.
    const rows = [
      { type: "hero", publishedContent: {} }, // no cta object
      { type: "hero", publishedContent: { cta: "not-an-object" } },
      { type: "siteHeader", publishedContent: { brand: { primary: "x" } } }, // no nav
      { type: "siteHeader", publishedContent: { nav: [] } }, // no brand
      { type: "featureGrid", publishedContent: { items: "nope" } }, // items not array
      { type: "siteFooter", publishedContent: {} }, // no brand
    ];
    expect(mapPublishedSections(rows)).toEqual([]);
  });

  it("treats bookingBanner with an empty object as renderable (messages optional)", () => {
    const out = mapPublishedSections([
      { type: "bookingBanner", publishedContent: {} },
    ]);
    expect(out).toEqual([{ type: "bookingBanner", props: {} }]);
  });
});
