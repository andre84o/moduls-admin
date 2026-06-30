/**
 * Pure helpers for the Website content module. No database, no auth, no
 * server-only imports — these are unit-testable in isolation (see
 * tests/website-content.test.ts) and shared by the queries/actions layer.
 */

import type { Section, SectionType } from "@/components/sections/types";
import type { WebsiteContent } from "./types";

/** The section discriminators the public renderer knows how to render. */
const KNOWN_SECTION_TYPES = new Set<string>([
  "siteHeader",
  "hero",
  "featureGrid",
  "siteFooter",
  "bookingBanner",
] satisfies SectionType[]);

/** A raw published section row as read from the database. */
export type PublishedSectionRow = {
  type: string;
  publishedContent: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Whether a published section's content has the MINIMUM shape its renderer
 * needs to render WITHOUT throwing. This is the safety gate that keeps a half-
 * filled or empty publishedContent (e.g. `{}`) from crashing the public home
 * page — the renderer reads `cta.href`, maps `nav`/`items`, etc., so those must
 * exist with the right primitive shape. Anything that fails is skipped.
 */
function isRenderableSection(type: string, content: unknown): boolean {
  if (!isPlainObject(content)) return false;
  switch (type) {
    case "siteHeader":
      // nav is mapped and each item is field-accessed (link.href/label), so
      // every element must be an object — a null/primitive element would throw.
      return (
        isPlainObject(content.brand) &&
        Array.isArray(content.nav) &&
        content.nav.every(isPlainObject)
      );
    case "hero":
      return isPlainObject(content.cta);
    case "featureGrid":
      // items are mapped and field-accessed (item.title/text); same rule.
      return (
        Array.isArray(content.items) && content.items.every(isPlainObject)
      );
    case "siteFooter":
      return isPlainObject(content.brand);
    case "bookingBanner":
      return true; // both messages optional; an empty object is renderable
    default:
      return false;
  }
}

/**
 * Map raw published sections into the `Section[]` shape the public renderer
 * consumes. Pure (no I/O) so it is unit-testable. A section is skipped — never
 * rendered — when its `type` is unknown, its publishedContent is null/missing,
 * or its content lacks the minimum shape its renderer needs (see
 * isRenderableSection). Skipping (rather than rendering) guarantees the public
 * home page can never throw on bad content; the caller falls back to config
 * when nothing renderable remains.
 *
 * Trust boundary: publishedContent is freeform JSON. The admin editor validates
 * it into each section's prop shape before publishing and the guard above
 * rejects anything unrenderable, so the cast to `Section` is the one place
 * runtime JSON meets the typed renderer.
 */
export function mapPublishedSections(
  rows: ReadonlyArray<PublishedSectionRow>,
): Section[] {
  const sections: Section[] = [];
  for (const row of rows) {
    if (!KNOWN_SECTION_TYPES.has(row.type)) continue;
    if (!isRenderableSection(row.type, row.publishedContent)) continue;
    sections.push({
      type: row.type as SectionType,
      props: row.publishedContent,
    } as Section);
  }
  return sections;
}

/**
 * Choose the SAFE public businessId for sessionless website rendering.
 * Resolution order (Phase 0.5 — reusable SaaS template safety):
 *   1. An explicit PUBLIC_BUSINESS_ID always wins (the configured public tenant).
 *   2. Otherwise fall back to the only business when EXACTLY one exists.
 *   3. Otherwise return null — with zero or multiple businesses and no explicit
 *      tenant we must NEVER guess which business the public site belongs to.
 *
 * Pure (no I/O): the caller reads the env var and supplies the candidate
 * business ids, so this stays unit-testable. A blank/whitespace env value is
 * treated as unset.
 */
export function pickPublicBusinessId(
  envBusinessId: string | null | undefined,
  businessIds: ReadonlyArray<string>,
): string | null {
  const explicit = envBusinessId?.trim();
  if (explicit) return explicit;
  if (businessIds.length === 1) return businessIds[0];
  return null;
}

/**
 * Normalise a page `key` to a stable, URL-safe, lowercase slug-like token.
 * Keys identify a page within a business and must be deterministic, so this
 * lowercases, trims, and collapses any run of non-alphanumerics into a single
 * hyphen. Returns "" when nothing usable remains (callers reject empty keys).
 */
export function normalizeKey(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (å -> a, ö -> o)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalise an optional public route slug. Same shape as a key, but a blank or
 * unusable input maps to `null` (slug is optional and stored as NULL), never "".
 */
export function normalizeSlug(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const slug = normalizeKey(raw);
  return slug.length > 0 ? slug : null;
}

/**
 * Next sort order given the sort orders already in use. Appends to the end:
 * max(existing) + 1, or 0 when there are none. Ignores non-finite values.
 */
export function nextSortOrder(existing: ReadonlyArray<number>): number {
  let max = -1;
  for (const n of existing) {
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** A default section to seed: its type and the JSON content to store. */
export type SeedSection = { type: string; content: WebsiteContent };

/** A planned section creation with the sortOrder it should be inserted at. */
export type PlannedSection = SeedSection & { sortOrder: number };

/**
 * CREATE-MISSING-ONLY plan for seeding default sections onto a page. Given the
 * config sections (the desired defaults) and the section rows that already
 * exist on the page, returns only the sections whose `type` is not yet present,
 * each assigned a sortOrder appended after the current order. Existing sections
 * are never included, so the caller never overwrites their content. Matching is
 * by `type`: a page is considered to already have, say, a "hero" if any hero
 * section exists, so re-running only restores genuinely missing defaults.
 *
 * Pure (no I/O) so it is unit-testable without a database.
 */
export function planMissingSections(
  configSections: ReadonlyArray<SeedSection>,
  existing: ReadonlyArray<{ type: string; sortOrder: number }>,
): PlannedSection[] {
  const present = new Set(existing.map((s) => s.type));
  let order = nextSortOrder(existing.map((s) => s.sortOrder));
  const plan: PlannedSection[] = [];
  for (const c of configSections) {
    if (present.has(c.type)) continue;
    present.add(c.type); // guard against duplicate types within config
    plan.push({ type: c.type, content: c.content, sortOrder: order });
    order += 1;
  }
  return plan;
}
