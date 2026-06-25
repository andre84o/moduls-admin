import type { Section } from "@/components/sections/types";
import { customerContent } from "@/config/customer-content";
import { customerNavigation } from "@/config/customer-navigation";
import { customerTheme } from "@/config/customer-theme";

/**
 * Config-driven section list for the public home page.
 *
 * This is the temporary seam between today's config layer and the future
 * Website Content System: it returns a typed `Section[]` assembled from config.
 * When the real content system exists, replace this builder with a DB-backed
 * loader that returns the same `Section[]` shape — the renderer and components
 * stay unchanged.
 *
 * NOTE: the booking-status banner is an overlay that needs a <Suspense>
 * boundary, so it is composed directly in app/page.tsx rather than included in
 * this linear content list.
 */
export function getHomeSections(): Section[] {
  const { brand, home, footer } = customerContent;
  const accent = customerTheme.accent.text;

  return [
    {
      type: "siteHeader",
      props: {
        brand,
        nav: customerNavigation.header,
        accentClassName: accent,
      },
    },
    {
      type: "hero",
      props: {
        eyebrow: home.hero.eyebrow,
        heading: home.hero.heading,
        body: home.hero.body,
        cta: home.hero.cta,
        accentClassName: accent,
      },
    },
    {
      type: "featureGrid",
      props: {
        items: home.features.items,
      },
    },
    {
      type: "siteFooter",
      props: {
        brand,
        copyright: footer.copyright,
        accentClassName: accent,
      },
    },
  ];
}
