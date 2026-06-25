import type { ComponentProps } from "react";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Hero } from "@/components/sections/Hero";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { BookingBanner } from "@/components/sections/BookingBanner";

/**
 * Typed section definitions for the public rendering layer.
 *
 * A `Section` is a `{ type, props }` pair. `props` is derived directly from each
 * section component via `ComponentProps`, so the definitions stay in sync with
 * the components automatically — no hand-maintained duplicate prop types.
 *
 * This is the data shape the future Website Content System will produce (from
 * the database). For now the shape is built from config; see
 * `config/home-sections.ts`. The renderer (`SectionRenderer`) does not care
 * where the sections come from.
 */
export type SiteHeaderSection = {
  type: "siteHeader";
  props: ComponentProps<typeof SiteHeader>;
};

export type HeroSection = {
  type: "hero";
  props: ComponentProps<typeof Hero>;
};

export type FeatureGridSection = {
  type: "featureGrid";
  props: ComponentProps<typeof FeatureGrid>;
};

export type SiteFooterSection = {
  type: "siteFooter";
  props: ComponentProps<typeof SiteFooter>;
};

export type BookingBannerSection = {
  type: "bookingBanner";
  props: ComponentProps<typeof BookingBanner>;
};

/** Discriminated union of every renderable public section. */
export type Section =
  | SiteHeaderSection
  | HeroSection
  | FeatureGridSection
  | SiteFooterSection
  | BookingBannerSection;

/** All known section type discriminators. */
export type SectionType = Section["type"];
