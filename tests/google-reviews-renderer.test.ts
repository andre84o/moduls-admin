import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { sectionRegistry } from "@/components/sections/SectionRenderer";
import type { Section } from "@/components/sections/types";
import type { GoogleReview } from "@/modules/website/google-reviews/types";

/**
 * Phase 2C — GoogleReviews renders through the SectionRenderer registry with
 * injected reviews and with empty reviews, without throwing. Also confirms the
 * new type is registered and that an existing section type still renders.
 */

function render(section: Section): string {
  return renderToStaticMarkup(createElement(SectionRenderer, { section }));
}

const review: GoogleReview = {
  author: "Jane",
  rating: 5,
  text: "Fantastic service.",
  relativeTime: "2 weeks ago",
  time: 1_700_000_000_000,
  profilePhotoUrl: null,
  authorUrl: null,
  language: "en",
};

describe("SectionRenderer — googleReviews", () => {
  it("registers googleReviews in the section registry", () => {
    expect(sectionRegistry).toHaveProperty("googleReviews");
  });

  it("renders with injected reviews without throwing", () => {
    const html = render({
      type: "googleReviews",
      props: {
        heading: "What customers say",
        reviews: [review],
        aggregateRating: 4.5,
        userRatingCount: 100,
        googleMapsUri: "https://maps.google.com/x",
        placeName: "Acme",
      },
    });
    expect(html).toContain("What customers say");
    expect(html).toContain("Jane");
    expect(html).toContain("Fantastic service.");
  });

  it("renders with empty reviews without throwing", () => {
    const html = render({
      type: "googleReviews",
      props: { heading: "Reviews", reviews: [] },
    });
    expect(html).toContain("Reviews");
  });

  it("renders with no props at all (editorial-only, pre-injection) without throwing", () => {
    expect(() => render({ type: "googleReviews", props: {} })).not.toThrow();
  });

  it("still renders an existing section type (hero) unchanged", () => {
    const html = render({
      type: "hero",
      props: { eyebrow: "Hi", heading: "Welcome", body: "Body", cta: { label: "Go", href: "/x" } },
    });
    expect(html).toContain("Welcome");
    expect(html).toContain("Go");
  });
});
