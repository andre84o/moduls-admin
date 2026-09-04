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

  it("preserves the given order", () => {
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

  it("skips sections with null/missing publishedContent", () => {
    const rows = [
      { type: "hero", publishedContent: null },
      { type: "featureGrid", publishedContent: undefined },
    ];
    expect(mapPublishedSections(rows)).toEqual([]);
  });

  it("returns an empty array for no rows", () => {
    expect(mapPublishedSections([])).toEqual([]);
  });

  it("keeps an empty hero because CTA is optional, while rejecting unsafe shapes", () => {
    const rows = [
      { type: "hero", publishedContent: {} },
      { type: "hero", publishedContent: { cta: "not-an-object" } },
      { type: "siteHeader", publishedContent: { brand: { primary: "x" } } },
      { type: "siteHeader", publishedContent: { nav: [] } },
      { type: "featureGrid", publishedContent: { items: "nope" } },
      { type: "siteFooter", publishedContent: {} },
    ];
    expect(mapPublishedSections(rows)).toEqual([{ type: "hero", props: {} }]);
  });

  it("skips arrays containing null/primitive elements that would throw in .map", () => {
    const rows = [
      { type: "siteHeader", publishedContent: { brand: { primary: "A", accent: "B" }, nav: [null] } },
      { type: "featureGrid", publishedContent: { items: [null] } },
      { type: "featureGrid", publishedContent: { items: ["x", 1] } },
    ];
    expect(mapPublishedSections(rows)).toEqual([]);
  });

  it("treats bookingBanner with an empty object as renderable", () => {
    expect(mapPublishedSections([{ type: "bookingBanner", publishedContent: {} }])).toEqual([
      { type: "bookingBanner", props: {} },
    ]);
  });
});
