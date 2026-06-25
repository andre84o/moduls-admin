import { Suspense } from "react";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { getHomeSections } from "@/config/home-sections";
import { getPublishedHomeSections } from "@/modules/website/queries-public";
import type { Section } from "@/components/sections/types";

// Booking-status overlay. Rendered through the registry like any other section,
// but kept outside the linear content list because it needs a <Suspense>
// boundary (it reads search params on the client).
const bookingBannerSection: Section = { type: "bookingBanner", props: {} };

export default async function Home() {
  // Prefer published Website Content from the database; fall back to config when
  // nothing is published (or the WEBSITE module is off) so the home page is
  // never broken or empty. Public render reads publishedContent only.
  const sections = (await getPublishedHomeSections()) ?? getHomeSections();

  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      <Suspense fallback={null}>
        <SectionRenderer section={bookingBannerSection} />
      </Suspense>

      {sections.map((section, index) => (
        <SectionRenderer key={`${section.type}-${index}`} section={section} />
      ))}
    </div>
  );
}
