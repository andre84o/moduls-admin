import { Suspense } from "react";
import { BookingBanner } from "./_components/booking-banner";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Hero } from "@/components/sections/Hero";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { customerContent } from "@/config/customer-content";
import { customerNavigation } from "@/config/customer-navigation";
import { customerTheme } from "@/config/customer-theme";

export default function Home() {
  const { brand, home, footer } = customerContent;
  const accent = customerTheme.accent.text;

  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      <Suspense fallback={null}>
        <BookingBanner />
      </Suspense>

      <SiteHeader
        brand={brand}
        nav={customerNavigation.header}
        accentClassName={accent}
      />

      <Hero
        eyebrow={home.hero.eyebrow}
        heading={home.hero.heading}
        body={home.hero.body}
        cta={home.hero.cta}
        accentClassName={accent}
      />

      <FeatureGrid items={home.features.items} />

      <SiteFooter
        brand={brand}
        copyright={footer.copyright}
        accentClassName={accent}
      />
    </div>
  );
}
