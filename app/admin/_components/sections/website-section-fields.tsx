"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";

/**
 * Typed field editors for the known Website section types (Phase 8E).
 *
 * Each editor renders normal labelled fields (Title, Text, Button link, …)
 * instead of raw JSON, mapping directly onto the props of the matching public
 * section component (components/sections/*). The editor is CONTROLLED: it reads
 * the section's draft `content` object and reports edits via `onChange`. It only
 * touches content keys — unknown keys (e.g. the theme `accentClassName`) are
 * preserved untouched, and layout/CSS is never exposed for editing.
 *
 * Content shape per type mirrors the section component props:
 *  - hero        { eyebrow, heading, body, cta: { label, href } }
 *  - siteHeader  { brand: { primary, accent }, nav: { label, href, external }[] }
 *  - siteFooter  { brand: { primary, accent }, copyright }
 *  - featureGrid { items: { title, text }[] }
 *  - bookingBanner { successText?, cancelledText? }
 */

export type SectionContent = Record<string, unknown>;

// Mirrors the public section registry (components/sections/types.ts). Keep in
// sync when a new public section type is added.
export const KNOWN_SECTION_TYPES = [
  "siteHeader",
  "hero",
  "featureGrid",
  "siteFooter",
  "bookingBanner",
  "googleReviews",
] as const;

export type KnownSectionType = (typeof KNOWN_SECTION_TYPES)[number];

export function isKnownSectionType(type: string): type is KnownSectionType {
  return (KNOWN_SECTION_TYPES as readonly string[]).includes(type);
}

/**
 * Whether a section type has a friendly typed field editor (so the JSON fallback
 * is not needed). This is broader than `isKnownSectionType`: `gallery` is not a
 * publicly-rendered section type, but it still gets an image editor here so an
 * existing gallery section never shows raw JSON to the author.
 */
// Extra section types that are NOT in the public registry but still get a
// friendly editor here, so an existing section never shows raw JSON.
const EXTRA_EDITOR_TYPES = [
  "gallery",
  "about",
  "reviews",
  // Restaurant/public-site section types (Le Rustique).
  "restaurantHero",
  "restaurantStory",
  "restaurantSpecialties",
  "restaurantGallery",
  "contactInfo",
  "contactForm",
  "cateringHero",
  "cateringEditorial",
  // Fixed per-person catering menus (Meny 1–3 + vegetarian) as cards.
  "cateringMenus",
  // Bespoke occasion pages (Fest & Event, Julbord, Alla hjärtans dag). Its
  // stored content is wrapped one level deeper: `{ content: FestEventContent }`.
  "festEvent",
  // Nested categories→groups→items editor (MenuListFields).
  "menuList",
  // Global site footer (nav links, contact, hours, delivery, copyright).
  "restaurantFooter",
] as const;

export function hasFieldEditor(type: string): boolean {
  return (
    isKnownSectionType(type) ||
    (EXTRA_EDITOR_TYPES as readonly string[]).includes(type)
  );
}

// ─── value coercion helpers ───────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as unknown[]).map(obj) : [];
}

// ─── stable-key list editing ──────────────────────────────────────────

// Monotonic counter for client-only React keys. Stored on each row as `_key`
// and stripped before the content is committed upward, so a removed middle item
// never shifts another row's identity (no focus jumps / value bleed).
let ROW_SEQ = 0;
type Row = Record<string, unknown> & { _key: string };

/**
 * Local list state seeded once from `initial`. Every mutation commits the rows
 * upward via `onCommit` with the `_key` field stripped — the stored content
 * holds plain objects, the editor holds stable keys. The component is remounted
 * by its parent whenever the server content changes, so re-seeding is correct.
 */
function useRows(
  initial: Record<string, unknown>[],
  onCommit: (rows: Record<string, unknown>[]) => void,
) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((r) => ({ ...r, _key: `r${ROW_SEQ++}` })),
  );
  function commit(next: Record<string, unknown>[]) {
    const withKeys: Row[] = next.map((r) =>
      typeof r._key === "string" ? (r as Row) : { ...r, _key: `r${ROW_SEQ++}` },
    );
    setRows(withKeys);
    onCommit(withKeys.map(({ _key, ...rest }) => rest));
  }
  return { rows, commit };
}

// ─── required-field validation ────────────────────────────────────────

/**
 * Validate the minimum fields a section needs to render meaningfully. Returns
 * an error string for the first problem, or null when the content is valid.
 */
export function validateSectionContent(
  type: string,
  content: SectionContent,
): string | null {
  switch (type) {
    case "hero": {
      const cta = obj(content.cta);
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      if (!str(cta.label).trim()) return "Knapptext krävs.";
      if (!str(cta.href).trim()) return "Knapplänk krävs.";
      return null;
    }
    case "siteHeader": {
      const brand = obj(content.brand);
      if (!str(brand.primary).trim()) return "Varumärkesnamn krävs.";
      const nav = arr(content.nav);
      for (let i = 0; i < nav.length; i++) {
        if (!str(nav[i].label).trim())
          return `Navigeringsobjekt ${i + 1}: etikett krävs.`;
        if (!str(nav[i].href).trim())
          return `Navigeringsobjekt ${i + 1}: länk krävs.`;
      }
      return null;
    }
    case "siteFooter": {
      const brand = obj(content.brand);
      if (!str(brand.primary).trim()) return "Varumärkesnamn krävs.";
      if (!str(content.copyright).trim()) return "Sidfotstext krävs.";
      return null;
    }
    case "featureGrid": {
      const items = arr(content.items);
      for (let i = 0; i < items.length; i++) {
        if (!str(items[i].title).trim())
          return `Kort ${i + 1}: rubrik krävs.`;
        if (!str(items[i].text).trim())
          return `Kort ${i + 1}: text krävs.`;
      }
      return null;
    }
    case "bookingBanner":
      return null; // both messages optional (the component has fallbacks)
    case "googleReviews":
      return null; // editorial content is all optional; reviews are injected
    case "gallery": {
      const items = arr(content.items);
      for (let i = 0; i < items.length; i++) {
        if (!str(items[i].src).trim())
          return `Bild ${i + 1}: en bild-URL krävs.`;
      }
      return null;
    }
    case "restaurantHero": {
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      const primary = obj(content.primaryCta);
      if (!str(primary.label).trim())
        return "Primär knapptext krävs.";
      if (!str(primary.href).trim())
        return "Primär knapplänk krävs.";
      return null;
    }
    case "restaurantStory": {
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      return null;
    }
    case "restaurantSpecialties": {
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      const items = arr(content.items);
      for (let i = 0; i < items.length; i++) {
        if (!str(items[i].name).trim())
          return `Objekt ${i + 1}: ett namn krävs.`;
      }
      return null;
    }
    case "restaurantGallery": {
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      const images = arr(content.images);
      for (let i = 0; i < images.length; i++) {
        if (!str(images[i].src).trim())
          return `Bild ${i + 1}: en bild-URL krävs.`;
      }
      return null;
    }
    case "contactInfo": {
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      const hours = arr(content.hours);
      for (let i = 0; i < hours.length; i++) {
        if (!str(hours[i].day).trim())
          return `Öppettidsrad ${i + 1}: en dag krävs.`;
      }
      return null;
    }
    case "contactForm":
      return null; // all copy has component fallbacks
    case "cateringHero":
      return null; // all copy is optional / has fallbacks
    case "cateringEditorial": {
      const sections = arr(content.sections);
      for (let i = 0; i < sections.length; i++) {
        if (!str(sections[i].heading).trim())
          return `Textsektion ${i + 1}: en rubrik krävs.`;
      }
      return null;
    }
    case "cateringMenus": {
      const menus = arr(content.menus);
      for (let mi = 0; mi < menus.length; mi++) {
        if (!str(menus[mi].title).trim())
          return `Meny ${mi + 1}: en rubrik krävs.`;
        if (!str(menus[mi].price).trim())
          return `Meny ${mi + 1}: ett pris krävs.`;
        const items = arr(menus[mi].items);
        for (let ii = 0; ii < items.length; ii++) {
          if (!str(items[ii].name).trim())
            return `Meny ${mi + 1}, rätt ${ii + 1}: ett namn krävs.`;
        }
      }
      return null;
    }
    case "festEvent": {
      // Content is wrapped one level deeper: `{ content: FestEventContent }`.
      const c = obj(content.content);
      const hero = obj(c.hero);
      const heroCta = obj(hero.cta);
      if (!str(hero.heading).trim()) return "Rubrik krävs.";
      if (!str(heroCta.label).trim()) return "Knapptext krävs.";
      if (!str(heroCta.href).trim()) return "Knapplänk krävs.";
      const finalCta = obj(c.finalCta);
      const primary = obj(finalCta.primary);
      if (!str(primary.label).trim())
        return "Primär knapptext (avslutande sektion) krävs.";
      if (!str(primary.href).trim())
        return "Primär knapplänk (avslutande sektion) krävs.";
      return null;
    }
    case "menuList": {
      if (!str(content.heading).trim()) return "Rubrik krävs.";
      const categories = arr(content.categories);
      for (let ci = 0; ci < categories.length; ci++) {
        if (!str(categories[ci].title).trim())
          return `Kategori ${ci + 1}: en rubrik krävs.`;
        const groups = arr(categories[ci].groups);
        for (let gi = 0; gi < groups.length; gi++) {
          const items = arr(groups[gi].items);
          for (let ii = 0; ii < items.length; ii++) {
            if (!str(items[ii].name).trim())
              return `Kategori ${ci + 1}, grupp ${gi + 1}, rätt ${ii + 1}: ett namn krävs.`;
            if (!str(items[ii].price).trim())
              return `Kategori ${ci + 1}, grupp ${gi + 1}, rätt ${ii + 1}: ett pris krävs.`;
          }
        }
      }
      return null;
    }
    case "restaurantFooter": {
      if (!str(content.name).trim()) return "Restaurangnamn krävs.";
      if (!str(content.copyright).trim()) return "Sidfotstext krävs.";
      const nav = arr(content.nav);
      for (let i = 0; i < nav.length; i++) {
        if (!str(nav[i].label).trim())
          return `Navigeringslänk ${i + 1}: etikett krävs.`;
        if (!str(nav[i].href).trim())
          return `Navigeringslänk ${i + 1}: länk krävs.`;
      }
      const hours = arr(content.hours);
      for (let i = 0; i < hours.length; i++) {
        if (!str(hours[i].day).trim())
          return `Öppettidsrad ${i + 1}: en dag krävs.`;
      }
      return null;
    }
    default:
      return null;
  }
}

// ─── small presentational helper ──────────────────────────────────────

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      <div className="mt-1.5 min-w-0">{children}</div>
    </div>
  );
}

// ─── per-type field editors ───────────────────────────────────────────

function HeroFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const cta = obj(content.cta);
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const setCta = (patch: SectionContent) =>
    onChange({ ...content, cta: { ...cta, ...patch } });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Rubrik" htmlFor={`${id}-heading`} className="sm:col-span-2">
        <Input
          id={`${id}-heading`}
          value={str(content.heading)}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>
      <Field label="Underrubrik" htmlFor={`${id}-eyebrow`} className="sm:col-span-2">
        <Input
          id={`${id}-eyebrow`}
          value={str(content.eyebrow)}
          onChange={(e) => set({ eyebrow: e.target.value })}
        />
      </Field>
      <Field label="Text" htmlFor={`${id}-body`} className="sm:col-span-2">
        <Textarea
          id={`${id}-body`}
          value={str(content.body)}
          onChange={(e) => set({ body: e.target.value })}
          className="min-h-24"
        />
      </Field>
      <Field label="Knapptext" htmlFor={`${id}-cta-label`}>
        <Input
          id={`${id}-cta-label`}
          value={str(cta.label)}
          onChange={(e) => setCta({ label: e.target.value })}
        />
      </Field>
      <Field label="Knapplänk" htmlFor={`${id}-cta-href`}>
        <Input
          id={`${id}-cta-href`}
          value={str(cta.href)}
          onChange={(e) => setCta({ href: e.target.value })}
          placeholder="/book"
        />
      </Field>
    </div>
  );
}

function BrandFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const brand = obj(content.brand);
  const setBrand = (patch: SectionContent) =>
    onChange({ ...content, brand: { ...brand, ...patch } });
  return (
    <>
      <Field label="Varumärkesnamn" htmlFor={`${id}-brand-primary`}>
        <Input
          id={`${id}-brand-primary`}
          value={str(brand.primary)}
          onChange={(e) => setBrand({ primary: e.target.value })}
        />
      </Field>
      <Field label="Varumärkesaccent" htmlFor={`${id}-brand-accent`}>
        <Input
          id={`${id}-brand-accent`}
          value={str(brand.accent)}
          onChange={(e) => setBrand({ accent: e.target.value })}
        />
      </Field>
    </>
  );
}

function SiteHeaderFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const { rows: nav, commit } = useRows(arr(content.nav), (next) =>
    onChange({ ...content, nav: next }),
  );
  const setItem = (i: number, patch: SectionContent) =>
    commit(nav.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <BrandFields id={id} content={content} onChange={onChange} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Navigeringslänkar</Label>
        </div>
        {nav.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga navigeringslänkar ännu.</p>
        ) : (
          <div className="space-y-3">
            {nav.map((item, i) => (
              <div
                key={item._key}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Field label="Navigeringsetikett" htmlFor={`${id}-nav-${i}-label`}>
                  <Input
                    id={`${id}-nav-${i}-label`}
                    value={str(item.label)}
                    onChange={(e) => setItem(i, { label: e.target.value })}
                  />
                </Field>
                <Field label="Navigeringslänk" htmlFor={`${id}-nav-${i}-href`}>
                  <Input
                    id={`${id}-nav-${i}-href`}
                    value={str(item.href)}
                    onChange={(e) => setItem(i, { href: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-3 pb-1">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(item.external)}
                      onChange={(e) => setItem(i, { external: e.target.checked })}
                      className="size-4 rounded border-input accent-primary"
                    />
                    Extern
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SiteFooterFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BrandFields id={id} content={content} onChange={onChange} />
      <Field label="Sidfotstext" htmlFor={`${id}-copyright`} className="sm:col-span-2">
        <Input
          id={`${id}-copyright`}
          value={str(content.copyright)}
          onChange={(e) => set({ copyright: e.target.value })}
          placeholder="© 2026 Ditt företag"
        />
      </Field>
    </div>
  );
}

function FeatureGridFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const { rows: items, commit } = useRows(arr(content.items), (next) =>
    onChange({ ...content, items: next }),
  );
  const setItem = (i: number, patch: SectionContent) =>
    commit(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">Kort</Label>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga kort ännu.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item._key} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Kort {i + 1}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Rubrik" htmlFor={`${id}-feat-${i}-title`}>
                  <Input
                    id={`${id}-feat-${i}-title`}
                    value={str(item.title)}
                    onChange={(e) => setItem(i, { title: e.target.value })}
                  />
                </Field>
                <Field label="Text" htmlFor={`${id}-feat-${i}-text`}>
                  <Input
                    id={`${id}-feat-${i}-text`}
                    value={str(item.text)}
                    onChange={(e) => setItem(i, { text: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingBannerFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Meddelande vid lyckad" htmlFor={`${id}-success`}>
        <Input
          id={`${id}-success`}
          value={str(content.successText)}
          onChange={(e) => set({ successText: e.target.value })}
        />
      </Field>
      <Field label="Meddelande vid avbruten" htmlFor={`${id}-cancelled`}>
        <Input
          id={`${id}-cancelled`}
          value={str(content.cancelledText)}
          onChange={(e) => set({ cancelledText: e.target.value })}
        />
      </Field>
    </div>
  );
}

function GoogleReviewsFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Överrubrik" htmlFor={`${id}-eyebrow`} className="sm:col-span-2">
        <Input
          id={`${id}-eyebrow`}
          value={str(content.eyebrow)}
          onChange={(e) => set({ eyebrow: e.target.value })}
          placeholder="Vad våra kunder säger"
        />
      </Field>
      <Field label="Rubrik" htmlFor={`${id}-heading`} className="sm:col-span-2">
        <Input
          id={`${id}-heading`}
          value={str(content.heading)}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>
      <Field label="Text" htmlFor={`${id}-body`} className="sm:col-span-2">
        <Textarea
          id={`${id}-body`}
          value={str(content.body)}
          onChange={(e) => set({ body: e.target.value })}
          className="min-h-24"
        />
      </Field>
      <div className="flex items-center gap-6 sm:col-span-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={bool(content.showRating, true)}
            onChange={(e) => set({ showRating: e.target.checked })}
            className="size-4 rounded border-input accent-primary"
          />
          Visa totalt betyg
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={bool(content.showReviewCount, true)}
            onChange={(e) => set({ showReviewCount: e.target.checked })}
            className="size-4 rounded border-input accent-primary"
          />
          Visa antal recensioner
        </label>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Recensioner hämtas från den cachade Google-synkningen och kan inte redigeras här.
      </p>
    </div>
  );
}

function AboutFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const cta = obj(content.cta);
  const setCta = (patch: SectionContent) =>
    onChange({ ...content, cta: { ...cta, ...patch } });

  // Paragraphs are stored as a string[]; edit them with stable keys by wrapping
  // each into { text } for the row helper and unwrapping back to strings.
  const { rows: paras, commit } = useRows(
    Array.isArray(content.paragraphs)
      ? (content.paragraphs as unknown[]).map((p) => ({ text: String(p) }))
      : [],
    (next) => onChange({ ...content, paragraphs: next.map((r) => str(r.text)) }),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <ImageUpload
          id={`${id}-imageUrl`}
          value={str(content.imageUrl)}
          onChange={(url) => set({ imageUrl: url })}
          label="Bild"
        />
        <Field label="Bildbeskrivning (alt-text)" htmlFor={`${id}-imageAlt`}>
          <Input
            id={`${id}-imageAlt`}
            value={str(content.imageAlt)}
            onChange={(e) => set({ imageAlt: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Stycken</Label>
        </div>
        {paras.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga stycken ännu.</p>
        ) : (
          <div className="space-y-3">
            {paras.map((item, i) => (
              <div key={item._key} className="flex items-start gap-2">
                <Textarea
                  value={str(item.text)}
                  onChange={(e) =>
                    commit(
                      paras.map((it, idx) =>
                        idx === i ? { ...it, text: e.target.value } : it,
                      ),
                    )
                  }
                  className="min-h-20"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Knapptext" htmlFor={`${id}-cta-label`}>
          <Input
            id={`${id}-cta-label`}
            value={str(cta.label)}
            onChange={(e) => setCta({ label: e.target.value })}
          />
        </Field>
        <Field label="Knapplänk" htmlFor={`${id}-cta-href`}>
          <Input
            id={`${id}-cta-href`}
            value={str(cta.href)}
            onChange={(e) => setCta({ href: e.target.value })}
            placeholder="/book"
          />
        </Field>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(cta.external)}
            onChange={(e) => setCta({ external: e.target.checked })}
            className="size-4 rounded border-input accent-primary"
          />
          Öppnas i en ny flik
        </label>
      </div>
    </div>
  );
}

function ReviewsFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Underrubrik"
          htmlFor={`${id}-eyebrow`}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field
          label="Rubrik"
          htmlFor={`${id}-heading`}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Text" htmlFor={`${id}-body`} className="sm:col-span-2">
          <Textarea
            id={`${id}-body`}
            value={str(content.body)}
            onChange={(e) => set({ body: e.target.value })}
            className="min-h-24"
          />
        </Field>
        <Field
          label="Kartinbäddnings-URL"
          htmlFor={`${id}-src`}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-src`}
            value={str(content.src)}
            onChange={(e) => set({ src: e.target.value })}
            placeholder="https://www.google.com/maps?...&output=embed"
          />
        </Field>
      </div>
    </div>
  );
}

function GalleryFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const { rows: items, commit } = useRows(arr(content.items), (next) =>
    onChange({ ...content, items: next }),
  );
  const setItem = (i: number, patch: SectionContent) =>
    commit(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Foton</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commit([{ src: "", alt: "" }, ...items])}
          >
            <Plus className="size-4" />
            Lägg till bild
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga foton ännu.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const src = str(item.src);
              return (
                <div
                  key={item._key}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <ImageUpload
                      id={`${id}-img-${i}-src`}
                      value={src}
                      onChange={(url) => setItem(i, { src: url })}
                      label="Bild"
                    />
                    <Field
                      label="Beskrivning (alt-text)"
                      htmlFor={`${id}-img-${i}-alt`}
                    >
                      <Input
                        id={`${id}-img-${i}-alt`}
                        value={str(item.alt)}
                        onChange={(e) => setItem(i, { alt: e.target.value })}
                      />
                    </Field>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ta bort bild"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title="Ta bort foto?"
                    description="Tar bort det från denna sektion."
                    confirmLabel="Ta bort"
                    onConfirm={() => commit(items.filter((_, idx) => idx !== i))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── restaurant section editors ───────────────────────────────────────

/** A labelled cta object editor ({ label, href, external? }). */
function CtaFields({
  id,
  cta,
  onChange,
  includeExternal = false,
  hrefPlaceholder = "/book",
}: {
  id: string;
  cta: Record<string, unknown>;
  onChange: (patch: SectionContent) => void;
  includeExternal?: boolean;
  hrefPlaceholder?: string;
}) {
  return (
    <>
      <Field label="Knapptext" htmlFor={`${id}-label`}>
        <Input
          id={`${id}-label`}
          value={str(cta.label)}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Knapplänk" htmlFor={`${id}-href`}>
        <Input
          id={`${id}-href`}
          value={str(cta.href)}
          onChange={(e) => onChange({ href: e.target.value })}
          placeholder={hrefPlaceholder}
        />
      </Field>
      {includeExternal ? (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={Boolean(cta.external)}
            onChange={(e) => onChange({ external: e.target.checked })}
            className="size-4 rounded border-input accent-primary"
          />
          Öppnas i en ny flik
        </label>
      ) : null}
    </>
  );
}

function RestaurantHeroFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const primary = obj(content.primaryCta);
  const secondary = obj(content.secondaryCta);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`} className="sm:col-span-2">
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`} className="sm:col-span-2">
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Text" htmlFor={`${id}-body`} className="sm:col-span-2">
          <Textarea
            id={`${id}-body`}
            value={str(content.body)}
            onChange={(e) => set({ body: e.target.value })}
            className="min-h-24"
          />
        </Field>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <ImageUpload
            id={`${id}-image`}
            value={str(content.image)}
            onChange={(url) => set({ image: url })}
            label="Bild"
          />
          <Field
            label="Bildbeskrivning (alt-text)"
            htmlFor={`${id}-imageAlt`}
          >
            <Input
              id={`${id}-imageAlt`}
              value={str(content.imageAlt)}
              onChange={(e) => set({ imageAlt: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Primär knapp
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CtaFields
            id={`${id}-primary`}
            cta={primary}
            includeExternal
            onChange={(patch) =>
              onChange({ ...content, primaryCta: { ...primary, ...patch } })
            }
          />
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Sekundär knapp
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CtaFields
            id={`${id}-secondary`}
            cta={secondary}
            includeExternal
            hrefPlaceholder="/menu"
            onChange={(patch) =>
              onChange({ ...content, secondaryCta: { ...secondary, ...patch } })
            }
          />
        </div>
      </div>
    </div>
  );
}

/** A string[] paragraphs list edited via useRows wrapping { text }. */
function ParagraphList({
  paragraphs,
  onChange,
  label = "Stycken",
}: {
  paragraphs: unknown;
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const { rows, commit } = useRows(
    Array.isArray(paragraphs)
      ? (paragraphs as unknown[]).map((p) => ({ text: String(p) }))
      : [],
    (next) => onChange(next.map((r) => str(r.text))),
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit([{ text: "" }, ...rows])}
        >
          <Plus className="size-4" />
          Lägg till stycke
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga stycken ännu.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((item, i) => (
            <div key={item._key} className="flex items-start gap-2">
              <Textarea
                value={str(item.text)}
                onChange={(e) =>
                  commit(
                    rows.map((it, idx) =>
                      idx === i ? { ...it, text: e.target.value } : it,
                    ),
                  )
                }
                className="min-h-20"
              />
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ta bort stycke"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
                title="Ta bort stycke?"
                description="Tar bort det från denna sektion."
                confirmLabel="Ta bort"
                onConfirm={() => commit(rows.filter((_, idx) => idx !== i))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RestaurantStoryFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <ImageUpload
            id={`${id}-image`}
            value={str(content.image)}
            onChange={(url) => set({ image: url })}
            label="Bild"
          />
          <Field
            label="Bildbeskrivning (alt-text)"
            htmlFor={`${id}-imageAlt`}
          >
            <Input
              id={`${id}-imageAlt`}
              value={str(content.imageAlt)}
              onChange={(e) => set({ imageAlt: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <ParagraphList
        paragraphs={content.paragraphs}
        onChange={(next) => onChange({ ...content, paragraphs: next })}
      />
    </div>
  );
}

function RestaurantSpecialtiesFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const cta = obj(content.cta);
  const { rows: items, commit } = useRows(arr(content.items), (next) =>
    onChange({ ...content, items: next }),
  );
  const setItem = (i: number, patch: SectionContent) =>
    commit(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Text" htmlFor={`${id}-body`} className="sm:col-span-2">
          <Textarea
            id={`${id}-body`}
            value={str(content.body)}
            onChange={(e) => set({ body: e.target.value })}
            className="min-h-24"
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Specialiteter</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              commit([
                { name: "", description: "", image: "", imageAlt: "" },
                ...items,
              ])
            }
          >
            <Plus className="size-4" />
            Lägg till objekt
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga objekt ännu.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const image = str(item.image);
              return (
                <div key={item._key} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Objekt {i + 1}
                    </span>
                    <ConfirmDialog
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ta bort objekt"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                      title="Ta bort objekt?"
                      description="Tar bort det från denna sektion."
                      confirmLabel="Ta bort"
                      onConfirm={() =>
                        commit(items.filter((_, idx) => idx !== i))
                      }
                    />
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <Field label="Namn" htmlFor={`${id}-item-${i}-name`}>
                        <Input
                          id={`${id}-item-${i}-name`}
                          value={str(item.name)}
                          onChange={(e) => setItem(i, { name: e.target.value })}
                        />
                      </Field>
                      <ImageUpload
                        id={`${id}-item-${i}-image`}
                        value={image}
                        onChange={(url) => setItem(i, { image: url })}
                        label="Bild"
                      />
                      <Field
                        label="Beskrivning"
                        htmlFor={`${id}-item-${i}-description`}
                        className="sm:col-span-2"
                      >
                        <Textarea
                          id={`${id}-item-${i}-description`}
                          value={str(item.description)}
                          onChange={(e) =>
                            setItem(i, { description: e.target.value })
                          }
                          className="min-h-16"
                        />
                      </Field>
                      <Field
                        label="Bildbeskrivning (alt-text)"
                        htmlFor={`${id}-item-${i}-imageAlt`}
                        className="sm:col-span-2"
                      >
                        <Input
                          id={`${id}-item-${i}-imageAlt`}
                          value={str(item.imageAlt)}
                          onChange={(e) =>
                            setItem(i, { imageAlt: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Knapp</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CtaFields
            id={`${id}-cta`}
            cta={cta}
            hrefPlaceholder="/menu"
            onChange={(patch) =>
              onChange({ ...content, cta: { ...cta, ...patch } })
            }
          />
        </div>
      </div>
    </div>
  );
}

function RestaurantGalleryFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const { rows: images, commit } = useRows(arr(content.images), (next) =>
    onChange({ ...content, images: next }),
  );
  const setItem = (i: number, patch: SectionContent) =>
    commit(images.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Foton</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commit([{ src: "", alt: "" }, ...images])}
          >
            <Plus className="size-4" />
            Lägg till bild
          </Button>
        </div>
        {images.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga foton ännu.</p>
        ) : (
          <div className="space-y-3">
            {images.map((item, i) => {
              const src = str(item.src);
              return (
                <div
                  key={item._key}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <ImageUpload
                      id={`${id}-img-${i}-src`}
                      value={src}
                      onChange={(url) => setItem(i, { src: url })}
                      label="Bild"
                    />
                    <Field
                      label="Beskrivning (alt-text)"
                      htmlFor={`${id}-img-${i}-alt`}
                    >
                      <Input
                        id={`${id}-img-${i}-alt`}
                        value={str(item.alt)}
                        onChange={(e) => setItem(i, { alt: e.target.value })}
                      />
                    </Field>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ta bort bild"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title="Ta bort foto?"
                    description="Tar bort det från denna sektion."
                    confirmLabel="Ta bort"
                    onConfirm={() => commit(images.filter((_, idx) => idx !== i))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactInfoFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const findUs = obj(content.findUs);
  const booking = obj(content.booking);
  const groups = obj(content.groups);
  const cateringTeaser = obj(content.cateringTeaser);
  const questions = obj(content.questions);
  const setNested = (key: string, base: Record<string, unknown>) =>
    (patch: SectionContent) =>
      onChange({ ...content, [key]: { ...base, ...patch } });

  const { rows: hours, commit: commitHours } = useRows(
    arr(content.hours),
    (next) => onChange({ ...content, hours: next }),
  );
  const setHour = (i: number, patch: SectionContent) =>
    commitHours(hours.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const { rows: specialHours, commit: commitSpecialHours } = useRows(
    arr(content.specialHours),
    (next) => onChange({ ...content, specialHours: next }),
  );
  const setSpecialHour = (i: number, patch: SectionContent) =>
    commitSpecialHours(
      specialHours.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Introduktion" htmlFor={`${id}-intro`} className="sm:col-span-2">
          <Textarea
            id={`${id}-intro`}
            value={str(content.intro)}
            onChange={(e) => set({ intro: e.target.value })}
            className="min-h-20"
          />
        </Field>
        <Field label="Restaurangnamn" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            value={str(content.name)}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field label="Telefon" htmlFor={`${id}-phone`}>
          <Input
            id={`${id}-phone`}
            value={str(content.phone)}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </Field>
        <Field label="Adress" htmlFor={`${id}-address`} className="sm:col-span-2">
          <Input
            id={`${id}-address`}
            value={str(content.address)}
            onChange={(e) => set({ address: e.target.value })}
          />
        </Field>
        <Field label="Adressrubrik" htmlFor={`${id}-addressHeading`}>
          <Input
            id={`${id}-addressHeading`}
            value={str(content.addressHeading)}
            onChange={(e) => set({ addressHeading: e.target.value })}
          />
        </Field>
        <Field label="Öppettidsrubrik" htmlFor={`${id}-hoursHeading`}>
          <Input
            id={`${id}-hoursHeading`}
            value={str(content.hoursHeading)}
            onChange={(e) => set({ hoursHeading: e.target.value })}
          />
        </Field>
        <Field
          label="Rubrik avvikande öppettider"
          htmlFor={`${id}-specialHoursHeading`}
        >
          <Input
            id={`${id}-specialHoursHeading`}
            value={str(content.specialHoursHeading)}
            onChange={(e) => set({ specialHoursHeading: e.target.value })}
          />
        </Field>
        <Field label="Boknings-URL" htmlFor={`${id}-bookingUrl`} className="sm:col-span-2">
          <Input
            id={`${id}-bookingUrl`}
            value={str(content.bookingUrl)}
            onChange={(e) => set({ bookingUrl: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Öppettider</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commitHours([{ day: "", time: "" }, ...hours])}
          >
            <Plus className="size-4" />
            Lägg till rad
          </Button>
        </div>
        {hours.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga öppettider ännu.</p>
        ) : (
          <div className="space-y-3">
            {hours.map((item, i) => (
              <div
                key={item._key}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Field label="Dag" htmlFor={`${id}-hour-${i}-day`}>
                  <Input
                    id={`${id}-hour-${i}-day`}
                    value={str(item.day)}
                    onChange={(e) => setHour(i, { day: e.target.value })}
                  />
                </Field>
                <Field label="Tid" htmlFor={`${id}-hour-${i}-time`}>
                  <Input
                    id={`${id}-hour-${i}-time`}
                    value={str(item.time)}
                    onChange={(e) => setHour(i, { time: e.target.value })}
                  />
                </Field>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort öppettidsrad"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort rad?"
                  description="Tar bort det från denna sektion."
                  confirmLabel="Ta bort"
                  onConfirm={() =>
                    commitHours(hours.filter((_, idx) => idx !== i))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Avvikande öppettider</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              commitSpecialHours([{ day: "", time: "" }, ...specialHours])
            }
          >
            <Plus className="size-4" />
            Lägg till rad
          </Button>
        </div>
        {specialHours.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Inga avvikande öppettider ännu.
          </p>
        ) : (
          <div className="space-y-3">
            {specialHours.map((item, i) => (
              <div
                key={item._key}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Field label="Dag/Datum" htmlFor={`${id}-specialHour-${i}-day`}>
                  <Input
                    id={`${id}-specialHour-${i}-day`}
                    value={str(item.day)}
                    onChange={(e) => setSpecialHour(i, { day: e.target.value })}
                  />
                </Field>
                <Field label="Tid" htmlFor={`${id}-specialHour-${i}-time`}>
                  <Input
                    id={`${id}-specialHour-${i}-time`}
                    value={str(item.time)}
                    onChange={(e) => setSpecialHour(i, { time: e.target.value })}
                  />
                </Field>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort avvikande öppettidsrad"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort rad?"
                  description="Tar bort det från denna sektion."
                  confirmLabel="Ta bort"
                  onConfirm={() =>
                    commitSpecialHours(
                      specialHours.filter((_, idx) => idx !== i),
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Hitta oss</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rubrik" htmlFor={`${id}-findUs-heading`}>
            <Input
              id={`${id}-findUs-heading`}
              value={str(findUs.heading)}
              onChange={(e) =>
                setNested("findUs", findUs)({ heading: e.target.value })
              }
            />
          </Field>
          <Field label="Kartetikett" htmlFor={`${id}-findUs-mapLabel`}>
            <Input
              id={`${id}-findUs-mapLabel`}
              value={str(findUs.mapLabel)}
              onChange={(e) =>
                setNested("findUs", findUs)({ mapLabel: e.target.value })
              }
            />
          </Field>
          <Field label="Text" htmlFor={`${id}-findUs-text`} className="sm:col-span-2">
            <Textarea
              id={`${id}-findUs-text`}
              value={str(findUs.text)}
              onChange={(e) =>
                setNested("findUs", findUs)({ text: e.target.value })
              }
              className="min-h-16"
            />
          </Field>
          <Field label="Kart-URL" htmlFor={`${id}-findUs-mapUrl`}>
            <Input
              id={`${id}-findUs-mapUrl`}
              value={str(findUs.mapUrl)}
              onChange={(e) =>
                setNested("findUs", findUs)({ mapUrl: e.target.value })
              }
            />
          </Field>
          <Field label="Kartinbäddnings-URL" htmlFor={`${id}-findUs-embedUrl`}>
            <Input
              id={`${id}-findUs-embedUrl`}
              value={str(findUs.embedUrl)}
              onChange={(e) =>
                setNested("findUs", findUs)({ embedUrl: e.target.value })
              }
            />
          </Field>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Bokningskort
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rubrik" htmlFor={`${id}-booking-heading`}>
            <Input
              id={`${id}-booking-heading`}
              value={str(booking.heading)}
              onChange={(e) =>
                setNested("booking", booking)({ heading: e.target.value })
              }
            />
          </Field>
          <Field label="Knappetikett" htmlFor={`${id}-booking-ctaLabel`}>
            <Input
              id={`${id}-booking-ctaLabel`}
              value={str(booking.ctaLabel)}
              onChange={(e) =>
                setNested("booking", booking)({ ctaLabel: e.target.value })
              }
            />
          </Field>
          <Field label="Text" htmlFor={`${id}-booking-text`} className="sm:col-span-2">
            <Textarea
              id={`${id}-booking-text`}
              value={str(booking.text)}
              onChange={(e) =>
                setNested("booking", booking)({ text: e.target.value })
              }
              className="min-h-16"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Kort för större sällskap
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rubrik" htmlFor={`${id}-groups-heading`}>
            <Input
              id={`${id}-groups-heading`}
              value={str(groups.heading)}
              onChange={(e) =>
                setNested("groups", groups)({ heading: e.target.value })
              }
            />
          </Field>
          <Field label="Text" htmlFor={`${id}-groups-text`}>
            <Textarea
              id={`${id}-groups-text`}
              value={str(groups.text)}
              onChange={(e) =>
                setNested("groups", groups)({ text: e.target.value })
              }
              className="min-h-16"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Cateringteaser-kort
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rubrik" htmlFor={`${id}-cateringTeaser-heading`}>
            <Input
              id={`${id}-cateringTeaser-heading`}
              value={str(cateringTeaser.heading)}
              onChange={(e) =>
                setNested("cateringTeaser", cateringTeaser)({
                  heading: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Knappetikett" htmlFor={`${id}-cateringTeaser-ctaLabel`}>
            <Input
              id={`${id}-cateringTeaser-ctaLabel`}
              value={str(cateringTeaser.ctaLabel)}
              onChange={(e) =>
                setNested("cateringTeaser", cateringTeaser)({
                  ctaLabel: e.target.value,
                })
              }
            />
          </Field>
          <Field
            label="Text"
            htmlFor={`${id}-cateringTeaser-text`}
            className="sm:col-span-2"
          >
            <Textarea
              id={`${id}-cateringTeaser-text`}
              value={str(cateringTeaser.text)}
              onChange={(e) =>
                setNested("cateringTeaser", cateringTeaser)({
                  text: e.target.value,
                })
              }
              className="min-h-16"
            />
          </Field>
          <Field label="Knapplänk" htmlFor={`${id}-cateringTeaser-href`}>
            <Input
              id={`${id}-cateringTeaser-href`}
              value={str(cateringTeaser.href)}
              onChange={(e) =>
                setNested("cateringTeaser", cateringTeaser)({
                  href: e.target.value,
                })
              }
              placeholder="/catering"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Frågor
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rubrik" htmlFor={`${id}-questions-heading`}>
            <Input
              id={`${id}-questions-heading`}
              value={str(questions.heading)}
              onChange={(e) =>
                setNested("questions", questions)({ heading: e.target.value })
              }
            />
          </Field>
          <Field label="Note" htmlFor={`${id}-questions-note`}>
            <Input
              id={`${id}-questions-note`}
              value={str(questions.note)}
              onChange={(e) =>
                setNested("questions", questions)({ note: e.target.value })
              }
            />
          </Field>
          <Field
            label="Text"
            htmlFor={`${id}-questions-text`}
            className="sm:col-span-2"
          >
            <Textarea
              id={`${id}-questions-text`}
              value={str(questions.text)}
              onChange={(e) =>
                setNested("questions", questions)({ text: e.target.value })
              }
              className="min-h-16"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ContactFormFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
        <Input
          id={`${id}-eyebrow`}
          value={str(content.eyebrow)}
          onChange={(e) => set({ eyebrow: e.target.value })}
        />
      </Field>
      <Field label="Formulärrubrik" htmlFor={`${id}-formHeading`}>
        <Input
          id={`${id}-formHeading`}
          value={str(content.formHeading)}
          onChange={(e) => set({ formHeading: e.target.value })}
        />
      </Field>
      <Field label="Telefon" htmlFor={`${id}-phone`}>
        <Input
          id={`${id}-phone`}
          value={str(content.phone)}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </Field>
      <Field label="Introduktionstext" htmlFor={`${id}-introText`} className="sm:col-span-2">
        <Textarea
          id={`${id}-introText`}
          value={str(content.introText)}
          onChange={(e) => set({ introText: e.target.value })}
          className="min-h-16"
        />
      </Field>
      <Field label="Samtyckesetikett" htmlFor={`${id}-consentLabel`} className="sm:col-span-2">
        <Textarea
          id={`${id}-consentLabel`}
          value={str(content.consentLabel)}
          onChange={(e) => set({ consentLabel: e.target.value })}
          className="min-h-16"
        />
      </Field>
      <Field label="Meddelande vid lyckad" htmlFor={`${id}-successText`} className="sm:col-span-2">
        <Textarea
          id={`${id}-successText`}
          value={str(content.successText)}
          onChange={(e) => set({ successText: e.target.value })}
          className="min-h-16"
        />
      </Field>
    </div>
  );
}

function CateringHeroFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Underrubrik" htmlFor={`${id}-eyebrow`} className="sm:col-span-2">
        <Input
          id={`${id}-eyebrow`}
          value={str(content.eyebrow)}
          onChange={(e) => set({ eyebrow: e.target.value })}
        />
      </Field>
      <Field label="Rubrik" htmlFor={`${id}-heading`} className="sm:col-span-2">
        <Input
          id={`${id}-heading`}
          value={str(content.heading)}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>
      <Field label="Introduktion" htmlFor={`${id}-intro`} className="sm:col-span-2">
        <Textarea
          id={`${id}-intro`}
          value={str(content.intro)}
          onChange={(e) => set({ intro: e.target.value })}
          className="min-h-24"
        />
      </Field>
      <ImageUpload
        id={`${id}-image`}
        value={str(content.image)}
        onChange={(url) => set({ image: url })}
        label="Bild"
      />
      <Field label="Bildbeskrivning (alt-text)" htmlFor={`${id}-imageAlt`}>
        <Input
          id={`${id}-imageAlt`}
          value={str(content.imageAlt)}
          onChange={(e) => set({ imageAlt: e.target.value })}
        />
      </Field>
      <Field label="Knappetikett" htmlFor={`${id}-ctaLabel`} className="sm:col-span-2">
        <Input
          id={`${id}-ctaLabel`}
          value={str(content.ctaLabel)}
          onChange={(e) => set({ ctaLabel: e.target.value })}
        />
      </Field>
    </div>
  );
}

function CateringEditorialFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const { rows: sections, commit } = useRows(arr(content.sections), (next) =>
    onChange({ ...content, sections: next }),
  );
  const setSection = (i: number, patch: SectionContent) =>
    commit(sections.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const { rows: occasions, commit: commitOccasions } = useRows(
    Array.isArray(content.occasions)
      ? (content.occasions as unknown[]).map((o) => ({ text: String(o) }))
      : [],
    (next) => onChange({ ...content, occasions: next.map((r) => str(r.text)) }),
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Textsektioner</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              commit([{ heading: "", paragraphs: [] }, ...sections])
            }
          >
            <Plus className="size-4" />
            Lägg till sektion
          </Button>
        </div>
        {sections.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga sektioner ännu.</p>
        ) : (
          <div className="space-y-3">
            {sections.map((item, i) => (
              <div key={item._key} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Sektion {i + 1}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ta bort sektion"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title="Ta bort sektion?"
                    description="Tar bort det från detta block."
                    confirmLabel="Ta bort"
                    onConfirm={() =>
                      commit(sections.filter((_, idx) => idx !== i))
                    }
                  />
                </div>
                <Field
                  label="Rubrik"
                  htmlFor={`${id}-section-${i}-heading`}
                  className="mb-3"
                >
                  <Input
                    id={`${id}-section-${i}-heading`}
                    value={str(item.heading)}
                    onChange={(e) => setSection(i, { heading: e.target.value })}
                  />
                </Field>
                <ParagraphList
                  paragraphs={item.paragraphs}
                  onChange={(next) => setSection(i, { paragraphs: next })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Tillfällesrubrik" htmlFor={`${id}-occasionsHeading`}>
        <Input
          id={`${id}-occasionsHeading`}
          value={str(content.occasionsHeading)}
          onChange={(e) => set({ occasionsHeading: e.target.value })}
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Tillfällen</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commitOccasions([{ text: "" }, ...occasions])}
          >
            <Plus className="size-4" />
            Lägg till tillfälle
          </Button>
        </div>
        {occasions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga tillfällen ännu.</p>
        ) : (
          <div className="space-y-2">
            {occasions.map((item, i) => (
              <div key={item._key} className="flex items-center gap-2">
                <Input
                  value={str(item.text)}
                  onChange={(e) =>
                    commitOccasions(
                      occasions.map((it, idx) =>
                        idx === i ? { ...it, text: e.target.value } : it,
                      ),
                    )
                  }
                />
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort tillfälle"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort tillfälle?"
                  description="Tar bort det från denna lista."
                  confirmLabel="Ta bort"
                  onConfirm={() =>
                    commitOccasions(occasions.filter((_, idx) => idx !== i))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── catering menus editor (menus → dishes) ───────────────────────────

/**
 * Dishes list inside one catering menu. Each dish has a name, an optional
 * Swedish note, and optional dietary tags edited as a comma-separated string
 * (e.g. "vegan, glutenfritt") that maps to/from the stored string[].
 */
function CateringMenuDishesList({
  id,
  items,
  onChange,
}: {
  id: string;
  items: unknown;
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const { rows, commit } = useRows(arr(items), onChange);
  const setItem = (i: number, patch: SectionContent) =>
    commit(rows.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const tagsToStr = (v: unknown): string =>
    Array.isArray(v) ? v.map((t) => String(t)).join(", ") : "";
  const strToTags = (v: string): string[] =>
    v
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">Rätter</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit([...rows, { name: "", note: "", tags: [] }])}
        >
          <Plus className="size-4" />
          Lägg till rätt
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga rätter ännu.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((item, i) => (
            <div
              key={item._key}
              className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Field label="Namn" htmlFor={`${id}-dish-${i}-name`}>
                <Input
                  id={`${id}-dish-${i}-name`}
                  value={str(item.name)}
                  onChange={(e) => setItem(i, { name: e.target.value })}
                />
              </Field>
              <Field label="Beskrivning" htmlFor={`${id}-dish-${i}-note`}>
                <Input
                  id={`${id}-dish-${i}-note`}
                  value={str(item.note)}
                  onChange={(e) => setItem(i, { note: e.target.value })}
                />
              </Field>
              <Field
                label="Taggar (kommaseparerade)"
                htmlFor={`${id}-dish-${i}-tags`}
              >
                <Input
                  id={`${id}-dish-${i}-tags`}
                  value={tagsToStr(item.tags)}
                  onChange={(e) => setItem(i, { tags: strToTags(e.target.value) })}
                  placeholder="vegan, glutenfritt"
                />
              </Field>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ta bort rätt"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
                title="Ta bort rätt?"
                description="Tar bort den från denna meny."
                confirmLabel="Ta bort"
                onConfirm={() => commit(rows.filter((_, idx) => idx !== i))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CateringMenusFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const { rows: menus, commit } = useRows(arr(content.menus), (next) =>
    onChange({ ...content, menus: next }),
  );
  const setMenu = (i: number, patch: SectionContent) =>
    commit(menus.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Introduktion" htmlFor={`${id}-intro`} className="sm:col-span-2">
          <Textarea
            id={`${id}-intro`}
            value={str(content.intro)}
            onChange={(e) => set({ intro: e.target.value })}
            className="min-h-20"
          />
        </Field>
        <Field label="Notering" htmlFor={`${id}-note`}>
          <Input
            id={`${id}-note`}
            value={str(content.note)}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Alla menyer gäller för minst 10 personer."
          />
        </Field>
        <Field label="Prisenhet" htmlFor={`${id}-perGuestLabel`}>
          <Input
            id={`${id}-perGuestLabel`}
            value={str(content.perGuestLabel)}
            onChange={(e) => set({ perGuestLabel: e.target.value })}
            placeholder="per person"
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Menyer</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              commit([
                ...menus,
                { title: "", minGuests: "", price: "", items: [] },
              ])
            }
          >
            <Plus className="size-4" />
            Lägg till meny
          </Button>
        </div>
        {menus.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga menyer ännu.</p>
        ) : (
          <div className="space-y-4">
            {menus.map((menu, i) => (
              <div key={menu._key} className="rounded-md border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Meny {i + 1}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ta bort meny"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title="Ta bort meny?"
                    description="Tar bort hela menyn från denna sektion."
                    confirmLabel="Ta bort"
                    onConfirm={() => commit(menus.filter((_, idx) => idx !== i))}
                  />
                </div>
                <div className="mb-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Rubrik" htmlFor={`${id}-menu-${i}-title`}>
                    <Input
                      id={`${id}-menu-${i}-title`}
                      value={str(menu.title)}
                      onChange={(e) => setMenu(i, { title: e.target.value })}
                      placeholder="Meny 1"
                    />
                  </Field>
                  <Field label="Minsta antal" htmlFor={`${id}-menu-${i}-minGuests`}>
                    <Input
                      id={`${id}-menu-${i}-minGuests`}
                      value={str(menu.minGuests)}
                      onChange={(e) => setMenu(i, { minGuests: e.target.value })}
                      placeholder="Minst 10 personer"
                    />
                  </Field>
                  <Field label="Pris" htmlFor={`${id}-menu-${i}-price`}>
                    <Input
                      id={`${id}-menu-${i}-price`}
                      value={str(menu.price)}
                      onChange={(e) => setMenu(i, { price: e.target.value })}
                      placeholder="230 kr"
                    />
                  </Field>
                </div>
                <CateringMenuDishesList
                  id={`${id}-menu-${i}`}
                  items={menu.items}
                  onChange={(next) => setMenu(i, { items: next })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── menu list editor (categories → groups → items) ───────────────────

/** Items list inside one group: each item has name, description, price. */
function MenuItemsList({
  id,
  items,
  onChange,
}: {
  id: string;
  items: unknown;
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const { rows, commit } = useRows(arr(items), onChange);
  const setItem = (i: number, patch: SectionContent) =>
    commit(rows.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">Rätter</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            commit([{ name: "", description: "", price: "" }, ...rows])
          }
        >
          <Plus className="size-4" />
          Lägg till rätt
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga rätter ännu.</p>
      ) : (
        <div className="space-y-3 border-l-2 border-border/40 pl-3">
          {rows.map((item, i) => (
            <div key={item._key} className="rounded-md border bg-amber-500/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Rätt {i + 1}
                </span>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort rätt"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort rätt?"
                  description="Tar bort det från denna grupp."
                  confirmLabel="Ta bort"
                  onConfirm={() => commit(rows.filter((_, idx) => idx !== i))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Namn" htmlFor={`${id}-item-${i}-name`}>
                  <Input
                    id={`${id}-item-${i}-name`}
                    value={str(item.name)}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                  />
                </Field>
                <Field label="Pris" htmlFor={`${id}-item-${i}-price`}>
                  <Input
                    id={`${id}-item-${i}-price`}
                    value={str(item.price)}
                    onChange={(e) => setItem(i, { price: e.target.value })}
                    placeholder="145 kr"
                  />
                </Field>
                <Field
                  label="Beskrivning"
                  htmlFor={`${id}-item-${i}-description`}
                  className="sm:col-span-2"
                >
                  <Textarea
                    id={`${id}-item-${i}-description`}
                    value={str(item.description)}
                    onChange={(e) =>
                      setItem(i, { description: e.target.value })
                    }
                    className="min-h-16"
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Groups list inside one category: each group has an optional label + items. */
function MenuGroupsList({
  id,
  groups,
  onChange,
}: {
  id: string;
  groups: unknown;
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const { rows, commit } = useRows(arr(groups), onChange);
  const setGroup = (i: number, patch: SectionContent) =>
    commit(rows.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">Grupper</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit([{ label: "", items: [] }, ...rows])}
        >
          <Plus className="size-4" />
          Lägg till grupp
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga grupper ännu.</p>
      ) : (
        <div className="space-y-3 border-l-2 border-amber-500/40 pl-3">
          {rows.map((group, i) => (
            <div
              key={group._key}
              className="space-y-3 rounded-md border bg-background p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Grupp {i + 1}
                </span>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort grupp"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort grupp?"
                  description="Tar bort denna grupp och dess rätter från kategorin."
                  confirmLabel="Ta bort"
                  onConfirm={() => commit(rows.filter((_, idx) => idx !== i))}
                />
              </div>
              <Field label="Gruppetikett (valfritt)" htmlFor={`${id}-group-${i}-label`}>
                <Input
                  id={`${id}-group-${i}-label`}
                  value={str(group.label)}
                  onChange={(e) => setGroup(i, { label: e.target.value })}
                  placeholder="Beirut mood"
                />
              </Field>
              <MenuItemsList
                id={`${id}-group-${i}`}
                items={group.items}
                onChange={(next) => setGroup(i, { items: next })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuListFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const { rows: categories, commit } = useRows(
    arr(content.categories),
    (next) => onChange({ ...content, categories: next }),
  );
  const setCategory = (i: number, patch: SectionContent) =>
    commit(categories.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Underrubrik" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Rubrik" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Introduktion" htmlFor={`${id}-intro`} className="sm:col-span-2">
          <Textarea
            id={`${id}-intro`}
            value={str(content.intro)}
            onChange={(e) => set({ intro: e.target.value })}
            className="min-h-20"
          />
        </Field>
        <Field
          label="Allerginotis"
          htmlFor={`${id}-allergyNote`}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-allergyNote`}
            value={str(content.allergyNote)}
            onChange={(e) => set({ allergyNote: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Kategorier</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              commit([{ title: "", groups: [] }, ...categories])
            }
          >
            <Plus className="size-4" />
            Lägg till kategori
          </Button>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga kategorier ännu.</p>
        ) : (
          <div className="space-y-4">
            {categories.map((category, i) => (
              <div
                key={category._key}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Kategori {i + 1}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ta bort kategori"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title="Ta bort kategori?"
                    description="Tar bort denna kategori och allt i den."
                    confirmLabel="Ta bort"
                    onConfirm={() =>
                      commit(categories.filter((_, idx) => idx !== i))
                    }
                  />
                </div>
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Rubrik" htmlFor={`${id}-cat-${i}-title`}>
                    <Input
                      id={`${id}-cat-${i}-title`}
                      value={str(category.title)}
                      onChange={(e) => setCategory(i, { title: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Beskrivning (valfritt)"
                    htmlFor={`${id}-cat-${i}-description`}
                  >
                    <Input
                      id={`${id}-cat-${i}-description`}
                      value={str(category.description)}
                      onChange={(e) =>
                        setCategory(i, { description: e.target.value })
                      }
                    />
                  </Field>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(category.highlight)}
                      onChange={(e) =>
                        setCategory(i, { highlight: e.target.checked })
                      }
                      className="size-4 rounded border-input accent-primary"
                    />
                    Framhäv denna kategori (inramat block)
                  </label>
                </div>
                <MenuGroupsList
                  id={`${id}-cat-${i}`}
                  groups={category.groups}
                  onChange={(next) => setCategory(i, { groups: next })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── festEvent editor (Fest & Event / Julbord / Alla hjärtans dag) ─────

/**
 * Editor for the bespoke occasion pages. IMPORTANT: this section stores its
 * content wrapped one level deeper — the section props is `{ content }`, so the
 * `content` object handed to this editor is `{ content: FestEventContent }`.
 * We edit fields under `content.content` and ALWAYS spread the inner object so
 * unknown keys are preserved untouched: the unused decorative `patterns` block
 * and the SEO `metaTitle` / `metaDescription` are never dropped.
 */
function FestEventFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  // Inner FestEventContent — preserve the `content` wrapper on every commit.
  const c = obj(content.content);
  const setC = (patch: SectionContent) =>
    onChange({ ...content, content: { ...c, ...patch } });

  const hero = obj(c.hero);
  const heroImage = obj(hero.image);
  const heroCta = obj(hero.cta);
  const setHero = (patch: SectionContent) => setC({ hero: { ...hero, ...patch } });

  const occasions = obj(c.occasions);
  const occasionsImage = obj(occasions.image);
  const setOccasions = (patch: SectionContent) =>
    setC({ occasions: { ...occasions, ...patch } });

  const food = obj(c.food);
  const setFood = (patch: SectionContent) => setC({ food: { ...food, ...patch } });

  // `business` is an optional block — only render it when present in content.
  const hasBusiness = c.business != null;
  const business = obj(c.business);
  const setBusiness = (patch: SectionContent) =>
    setC({ business: { ...business, ...patch } });

  const finalCta = obj(c.finalCta);
  const finalPrimary = obj(finalCta.primary);
  // `secondary` is optional; only render its inputs when present.
  const hasSecondary = finalCta.secondary != null;
  const finalSecondary = obj(finalCta.secondary);
  const setFinal = (patch: SectionContent) =>
    setC({ finalCta: { ...finalCta, ...patch } });

  // Occasions bullet items (string[]) edited with stable keys via { text }.
  const { rows: items, commit: commitItems } = useRows(
    Array.isArray(occasions.items)
      ? (occasions.items as unknown[]).map((o) => ({ text: String(o) }))
      : [],
    (next) => setOccasions({ items: next.map((r) => str(r.text)) }),
  );

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- Välkomstbanner */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">
          Välkomstbanner
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Underrubrik"
            htmlFor={`${id}-hero-eyebrow`}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-hero-eyebrow`}
              value={str(hero.eyebrow)}
              onChange={(e) => setHero({ eyebrow: e.target.value })}
            />
          </Field>
          <Field
            label="Rubrik"
            htmlFor={`${id}-hero-heading`}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-hero-heading`}
              value={str(hero.heading)}
              onChange={(e) => setHero({ heading: e.target.value })}
            />
          </Field>
          <Field
            label="Introduktion"
            htmlFor={`${id}-hero-intro`}
            className="sm:col-span-2"
          >
            <Textarea
              id={`${id}-hero-intro`}
              value={str(hero.intro)}
              onChange={(e) => setHero({ intro: e.target.value })}
              className="min-h-24"
            />
          </Field>
          <ImageUpload
            id={`${id}-hero-image`}
            value={str(heroImage.src)}
            onChange={(url) => setHero({ image: { ...heroImage, src: url } })}
            label="Bild"
          />
          <Field
            label="Bildbeskrivning (alt-text)"
            htmlFor={`${id}-hero-image-alt`}
          >
            <Input
              id={`${id}-hero-image-alt`}
              value={str(heroImage.alt)}
              onChange={(e) =>
                setHero({ image: { ...heroImage, alt: e.target.value } })
              }
            />
          </Field>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <CtaFields
              id={`${id}-hero-cta`}
              cta={heroCta}
              includeExternal
              hrefPlaceholder="/kontakt#kontaktformular"
              onChange={(patch) => setHero({ cta: { ...heroCta, ...patch } })}
            />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- Tillfällen */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">Tillfällen</p>
        <div className="space-y-4">
          <Field label="Rubrik" htmlFor={`${id}-occasions-heading`}>
            <Input
              id={`${id}-occasions-heading`}
              value={str(occasions.heading)}
              onChange={(e) => setOccasions({ heading: e.target.value })}
            />
          </Field>
          <ParagraphList
            paragraphs={
              Array.isArray(occasions.body)
                ? occasions.body
                : str(occasions.body).trim()
                  ? [str(occasions.body)]
                  : []
            }
            onChange={(next) => setOccasions({ body: next })}
            label="Text (stycken)"
          />
          <Field label="Listrubrik (valfritt)" htmlFor={`${id}-occasions-listIntro`}>
            <Input
              id={`${id}-occasions-listIntro`}
              value={str(occasions.listIntro)}
              onChange={(e) => setOccasions({ listIntro: e.target.value })}
              placeholder="Le Rustique passar bland annat för:"
            />
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs">Punkter</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => commitItems([{ text: "" }, ...items])}
              >
                <Plus className="size-4" />
                Lägg till punkt
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Inga punkter ännu.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={item._key} className="flex items-center gap-2">
                    <Input
                      value={str(item.text)}
                      onChange={(e) =>
                        commitItems(
                          items.map((it, idx) =>
                            idx === i ? { ...it, text: e.target.value } : it,
                          ),
                        )
                      }
                    />
                    <ConfirmDialog
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ta bort punkt"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                      title="Ta bort punkt?"
                      description="Tar bort det från denna lista."
                      confirmLabel="Ta bort"
                      onConfirm={() =>
                        commitItems(items.filter((_, idx) => idx !== i))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUpload
              id={`${id}-occasions-image`}
              value={str(occasionsImage.src)}
              onChange={(url) =>
                setOccasions({ image: { ...occasionsImage, src: url } })
              }
              label="Bild"
            />
            <Field
              label="Bildbeskrivning (alt-text)"
              htmlFor={`${id}-occasions-image-alt`}
            >
              <Input
                id={`${id}-occasions-image-alt`}
                value={str(occasionsImage.alt)}
                onChange={(e) =>
                  setOccasions({
                    image: { ...occasionsImage, alt: e.target.value },
                  })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- Mat */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">Mat</p>
        <div className="space-y-4">
          <Field label="Rubrik" htmlFor={`${id}-food-heading`}>
            <Input
              id={`${id}-food-heading`}
              value={str(food.heading)}
              onChange={(e) => setFood({ heading: e.target.value })}
            />
          </Field>
          <ParagraphList
            paragraphs={
              Array.isArray(food.body)
                ? food.body
                : str(food.body).trim()
                  ? [str(food.body)]
                  : []
            }
            onChange={(next) => setFood({ body: next })}
            label="Text (stycken)"
          />
        </div>
      </div>

      {/* ------------------------------------------------ Företag (valfritt) */}
      {hasBusiness ? (
        <div className="rounded-md border p-3">
          <p className="mb-3 text-xs font-semibold text-foreground">Företag</p>
          <div className="space-y-4">
            <Field label="Rubrik" htmlFor={`${id}-business-heading`}>
              <Input
                id={`${id}-business-heading`}
                value={str(business.heading)}
                onChange={(e) => setBusiness({ heading: e.target.value })}
              />
            </Field>
            <ParagraphList
              paragraphs={
                Array.isArray(business.body)
                  ? business.body
                  : str(business.body).trim()
                    ? [str(business.body)]
                    : []
              }
              onChange={(next) => setBusiness({ body: next })}
              label="Text (stycken)"
            />
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------- Avslutande sektion */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">
          Avslutande sektion
        </p>
        <div className="space-y-4">
          <Field label="Rubrik" htmlFor={`${id}-final-heading`}>
            <Input
              id={`${id}-final-heading`}
              value={str(finalCta.heading)}
              onChange={(e) => setFinal({ heading: e.target.value })}
            />
          </Field>
          <ParagraphList
            paragraphs={
              Array.isArray(finalCta.body)
                ? finalCta.body
                : str(finalCta.body).trim()
                  ? [str(finalCta.body)]
                  : []
            }
            onChange={(next) => setFinal({ body: next })}
            label="Text (stycken)"
          />
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Primär knapp
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CtaFields
                id={`${id}-final-primary`}
                cta={finalPrimary}
                includeExternal
                hrefPlaceholder="/kontakt#kontaktformular"
                onChange={(patch) =>
                  setFinal({ primary: { ...finalPrimary, ...patch } })
                }
              />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Sekundär knapp (valfritt)
              </p>
              {hasSecondary ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort sekundär knapp"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort sekundär knapp?"
                  description="Tar bort den sekundära knappen från denna sektion."
                  confirmLabel="Ta bort"
                  onConfirm={() => setFinal({ secondary: undefined })}
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFinal({ secondary: { label: "", href: "" } })
                  }
                >
                  <Plus className="size-4" />
                  Lägg till knapp
                </Button>
              )}
            </div>
            {hasSecondary ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <CtaFields
                  id={`${id}-final-secondary`}
                  cta={finalSecondary}
                  includeExternal
                  hrefPlaceholder="/menu"
                  onChange={(patch) =>
                    setFinal({ secondary: { ...finalSecondary, ...patch } })
                  }
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ingen sekundär knapp.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- SEO */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">SEO</p>
        <div className="grid gap-4">
          <Field label="Metatitel" htmlFor={`${id}-metaTitle`}>
            <Input
              id={`${id}-metaTitle`}
              value={str(c.metaTitle)}
              onChange={(e) => setC({ metaTitle: e.target.value })}
            />
          </Field>
          <Field label="Metabeskrivning" htmlFor={`${id}-metaDescription`}>
            <Textarea
              id={`${id}-metaDescription`}
              value={str(c.metaDescription)}
              onChange={(e) => setC({ metaDescription: e.target.value })}
              className="min-h-20"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function FooterFields({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const set = (patch: SectionContent) => onChange({ ...content, ...patch });
  const contact = obj(content.contact);
  const setContact = (patch: SectionContent) =>
    onChange({ ...content, contact: { ...contact, ...patch } });

  const { rows: nav, commit: commitNav } = useRows(arr(content.nav), (next) =>
    onChange({ ...content, nav: next }),
  );
  const setNav = (i: number, patch: SectionContent) =>
    commitNav(nav.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const { rows: hours, commit: commitHours } = useRows(
    arr(content.hours),
    (next) => onChange({ ...content, hours: next }),
  );
  const setHour = (i: number, patch: SectionContent) =>
    commitHours(hours.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const { rows: delivery, commit: commitDelivery } = useRows(
    arr(content.delivery),
    (next) => onChange({ ...content, delivery: next }),
  );
  const setDelivery = (i: number, patch: SectionContent) =>
    commitDelivery(
      delivery.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- Varumärke */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">Varumärke</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurangnamn" htmlFor={`${id}-name`}>
            <Input
              id={`${id}-name`}
              value={str(content.name)}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Instagram-URL" htmlFor={`${id}-instagram`}>
            <Input
              id={`${id}-instagram`}
              value={str(content.instagram)}
              onChange={(e) => set({ instagram: e.target.value })}
              placeholder="https://www.instagram.com/..."
            />
          </Field>
          <Field label="Beskrivning" htmlFor={`${id}-tagline`} className="sm:col-span-2">
            <Textarea
              id={`${id}-tagline`}
              value={str(content.tagline)}
              onChange={(e) => set({ tagline: e.target.value })}
              className="min-h-20"
            />
          </Field>
          <Field label="Sidfotstext" htmlFor={`${id}-copyright`} className="sm:col-span-2">
            <Input
              id={`${id}-copyright`}
              value={str(content.copyright)}
              onChange={(e) => set({ copyright: e.target.value })}
              placeholder="© 2026 Le Rustique"
            />
          </Field>
        </div>
      </div>

      {/* --------------------------------------------------------- Kontakt */}
      <div className="rounded-md border p-3">
        <p className="mb-3 text-xs font-semibold text-foreground">Kontakt</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Adress" htmlFor={`${id}-contact-address`}>
            <Input
              id={`${id}-contact-address`}
              value={str(contact.address)}
              onChange={(e) => setContact({ address: e.target.value })}
            />
          </Field>
          <Field label="Telefon" htmlFor={`${id}-contact-phone`}>
            <Input
              id={`${id}-contact-phone`}
              value={str(contact.phone)}
              onChange={(e) => setContact({ phone: e.target.value })}
            />
          </Field>
          <Field label="E-post" htmlFor={`${id}-contact-email`}>
            <Input
              id={`${id}-contact-email`}
              type="email"
              value={str(contact.email)}
              onChange={(e) => setContact({ email: e.target.value })}
              placeholder="info@exempel.se"
            />
          </Field>
        </div>
      </div>

      {/* --------------------------------------------------- Navigeringslänkar */}
      <div className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">
            Navigeringslänkar
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commitNav([...nav, { label: "", href: "" }])}
          >
            <Plus className="size-4" />
            Lägg till länk
          </Button>
        </div>
        {nav.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga länkar ännu.</p>
        ) : (
          <div className="space-y-3">
            {nav.map((item, i) => (
              <div
                key={item._key}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <Field label="Etikett" htmlFor={`${id}-nav-${i}-label`}>
                  <Input
                    id={`${id}-nav-${i}-label`}
                    value={str(item.label)}
                    onChange={(e) => setNav(i, { label: e.target.value })}
                  />
                </Field>
                <Field label="Länk" htmlFor={`${id}-nav-${i}-href`}>
                  <Input
                    id={`${id}-nav-${i}-href`}
                    value={str(item.href)}
                    onChange={(e) => setNav(i, { href: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(item.external)}
                    onChange={(e) => setNav(i, { external: e.target.checked })}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Extern
                </label>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort länk"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort länk?"
                  description="Tar bort den från sidfoten."
                  confirmLabel="Ta bort"
                  onConfirm={() => commitNav(nav.filter((_, idx) => idx !== i))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- Öppettider */}
      <div className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Öppettider</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commitHours([...hours, { day: "", time: "" }])}
          >
            <Plus className="size-4" />
            Lägg till rad
          </Button>
        </div>
        {hours.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga öppettider ännu.</p>
        ) : (
          <div className="space-y-3">
            {hours.map((item, i) => (
              <div
                key={item._key}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Field label="Dag" htmlFor={`${id}-hour-${i}-day`}>
                  <Input
                    id={`${id}-hour-${i}-day`}
                    value={str(item.day)}
                    onChange={(e) => setHour(i, { day: e.target.value })}
                  />
                </Field>
                <Field label="Tid" htmlFor={`${id}-hour-${i}-time`}>
                  <Input
                    id={`${id}-hour-${i}-time`}
                    value={str(item.time)}
                    onChange={(e) => setHour(i, { time: e.target.value })}
                  />
                </Field>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ta bort öppettidsrad"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Ta bort rad?"
                  description="Tar bort den från sidfoten."
                  confirmLabel="Ta bort"
                  onConfirm={() =>
                    commitHours(hours.filter((_, idx) => idx !== i))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ Beställ hem */}
      <div className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">
            Beställ hem (leveranstjänster)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commitDelivery([...delivery, { label: "" }])}
          >
            <Plus className="size-4" />
            Lägg till tjänst
          </Button>
        </div>
        {delivery.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga tjänster ännu.</p>
        ) : (
          <div className="space-y-3">
            {delivery.map((item, i) => (
              <div key={item._key} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tjänst {i + 1}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ta bort tjänst"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                    title="Ta bort tjänst?"
                    description="Tar bort den från sidfoten."
                    confirmLabel="Ta bort"
                    onConfirm={() =>
                      commitDelivery(delivery.filter((_, idx) => idx !== i))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Namn" htmlFor={`${id}-delivery-${i}-label`}>
                    <Input
                      id={`${id}-delivery-${i}-label`}
                      value={str(item.label)}
                      onChange={(e) => setDelivery(i, { label: e.target.value })}
                    />
                  </Field>
                  <Field label="Länk (valfritt)" htmlFor={`${id}-delivery-${i}-href`}>
                    <Input
                      id={`${id}-delivery-${i}-href`}
                      value={str(item.href)}
                      onChange={(e) => setDelivery(i, { href: e.target.value })}
                      placeholder="https://..."
                    />
                  </Field>
                  <ImageUpload
                    id={`${id}-delivery-${i}-logo`}
                    value={str(item.logo)}
                    onChange={(url) => setDelivery(i, { logo: url })}
                    label="Logga"
                  />
                  <Field
                    label="Bakgrundsfärg (valfritt)"
                    htmlFor={`${id}-delivery-${i}-bg`}
                  >
                    <Input
                      id={`${id}-delivery-${i}-bg`}
                      value={str(item.bg)}
                      onChange={(e) => setDelivery(i, { bg: e.target.value })}
                      placeholder="#34C759"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render the typed field editor for a known section type. Returns null for
 * unknown types so the caller can fall back to the JSON editor.
 */
export function SectionFields({
  id,
  type,
  content,
  onChange,
}: {
  id: string;
  type: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  switch (type) {
    case "hero":
      return <HeroFields id={id} content={content} onChange={onChange} />;
    case "siteHeader":
      return <SiteHeaderFields id={id} content={content} onChange={onChange} />;
    case "siteFooter":
      return <SiteFooterFields id={id} content={content} onChange={onChange} />;
    case "featureGrid":
      return <FeatureGridFields id={id} content={content} onChange={onChange} />;
    case "bookingBanner":
      return <BookingBannerFields id={id} content={content} onChange={onChange} />;
    case "googleReviews":
      return <GoogleReviewsFields id={id} content={content} onChange={onChange} />;
    case "gallery":
      return <GalleryFields id={id} content={content} onChange={onChange} />;
    case "about":
      return <AboutFields id={id} content={content} onChange={onChange} />;
    case "reviews":
      return <ReviewsFields id={id} content={content} onChange={onChange} />;
    case "restaurantHero":
      return (
        <RestaurantHeroFields id={id} content={content} onChange={onChange} />
      );
    case "restaurantStory":
      return (
        <RestaurantStoryFields id={id} content={content} onChange={onChange} />
      );
    case "restaurantSpecialties":
      return (
        <RestaurantSpecialtiesFields
          id={id}
          content={content}
          onChange={onChange}
        />
      );
    case "restaurantGallery":
      return (
        <RestaurantGalleryFields id={id} content={content} onChange={onChange} />
      );
    case "contactInfo":
      return <ContactInfoFields id={id} content={content} onChange={onChange} />;
    case "contactForm":
      return <ContactFormFields id={id} content={content} onChange={onChange} />;
    case "cateringHero":
      return <CateringHeroFields id={id} content={content} onChange={onChange} />;
    case "cateringEditorial":
      return (
        <CateringEditorialFields
          id={id}
          content={content}
          onChange={onChange}
        />
      );
    case "cateringMenus":
      return (
        <CateringMenusFields id={id} content={content} onChange={onChange} />
      );
    case "menuList":
      return <MenuListFields id={id} content={content} onChange={onChange} />;
    case "festEvent":
      return <FestEventFields id={id} content={content} onChange={onChange} />;
    case "restaurantFooter":
      return <FooterFields id={id} content={content} onChange={onChange} />;
    default:
      return null;
  }
}
