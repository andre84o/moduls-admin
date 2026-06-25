import type { ComponentType } from "react";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Hero } from "@/components/sections/Hero";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { BookingBanner } from "@/components/sections/BookingBanner";
import type { Section, SectionType } from "@/components/sections/types";

/**
 * Section registry: `section.type` → component.
 *
 * This is the lookup the future Website Content System will use when rendering
 * sections loaded from the database. Adding a new section type means: add a
 * component, add it to the `Section` union (components/sections/types.ts), and
 * register it here + in `SectionRenderer` below.
 *
 * `satisfies` guarantees every `SectionType` has a registered component without
 * widening the map to `any`.
 */
export const sectionRegistry = {
  siteHeader: SiteHeader,
  hero: Hero,
  featureGrid: FeatureGrid,
  siteFooter: SiteFooter,
  bookingBanner: BookingBanner,
} satisfies Record<SectionType, ComponentType<never>>;

function assertNever(section: never): never {
  throw new Error(
    `SectionRenderer: unknown section type ${JSON.stringify(section)}`,
  );
}

/**
 * Renders a single typed section. The switch narrows the discriminated union so
 * each component receives correctly-typed props with no casts.
 *
 * Note: the `bookingBanner` section uses `useSearchParams`, so the caller must
 * render it inside a `<Suspense>` boundary (see app/page.tsx).
 */
export function SectionRenderer({ section }: { section: Section }) {
  switch (section.type) {
    case "siteHeader":
      return <SiteHeader {...section.props} />;
    case "hero":
      return <Hero {...section.props} />;
    case "featureGrid":
      return <FeatureGrid {...section.props} />;
    case "siteFooter":
      return <SiteFooter {...section.props} />;
    case "bookingBanner":
      return <BookingBanner {...section.props} />;
    default:
      return assertNever(section);
  }
}
