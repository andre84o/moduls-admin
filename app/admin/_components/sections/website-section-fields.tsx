"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
const EXTRA_EDITOR_TYPES = ["gallery", "about", "reviews"] as const;

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
      if (!str(content.heading).trim()) return "Title is required.";
      if (!str(cta.label).trim()) return "Button text is required.";
      if (!str(cta.href).trim()) return "Button link is required.";
      return null;
    }
    case "siteHeader": {
      const brand = obj(content.brand);
      if (!str(brand.primary).trim()) return "Brand name is required.";
      const nav = arr(content.nav);
      for (let i = 0; i < nav.length; i++) {
        if (!str(nav[i].label).trim())
          return `Navigation item ${i + 1}: label is required.`;
        if (!str(nav[i].href).trim())
          return `Navigation item ${i + 1}: link is required.`;
      }
      return null;
    }
    case "siteFooter": {
      const brand = obj(content.brand);
      if (!str(brand.primary).trim()) return "Brand name is required.";
      if (!str(content.copyright).trim()) return "Footer text is required.";
      return null;
    }
    case "featureGrid": {
      const items = arr(content.items);
      for (let i = 0; i < items.length; i++) {
        if (!str(items[i].title).trim())
          return `Feature ${i + 1}: title is required.`;
        if (!str(items[i].text).trim())
          return `Feature ${i + 1}: text is required.`;
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
          return `Image ${i + 1}: an image URL is required.`;
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
    <div className={className}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
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
      <Field label="Title" htmlFor={`${id}-heading`} className="sm:col-span-2">
        <Input
          id={`${id}-heading`}
          value={str(content.heading)}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>
      <Field label="Subtitle" htmlFor={`${id}-eyebrow`} className="sm:col-span-2">
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
      <Field label="Button text" htmlFor={`${id}-cta-label`}>
        <Input
          id={`${id}-cta-label`}
          value={str(cta.label)}
          onChange={(e) => setCta({ label: e.target.value })}
        />
      </Field>
      <Field label="Button link" htmlFor={`${id}-cta-href`}>
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
      <Field label="Brand name" htmlFor={`${id}-brand-primary`}>
        <Input
          id={`${id}-brand-primary`}
          value={str(brand.primary)}
          onChange={(e) => setBrand({ primary: e.target.value })}
        />
      </Field>
      <Field label="Brand accent" htmlFor={`${id}-brand-accent`}>
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
          <Label className="text-xs">Navigation links</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commit([...nav, { label: "", href: "", external: false }])}
          >
            <Plus className="size-4" />
            Add link
          </Button>
        </div>
        {nav.length === 0 ? (
          <p className="text-xs text-muted-foreground">No navigation links yet.</p>
        ) : (
          <div className="space-y-3">
            {nav.map((item, i) => (
              <div
                key={item._key}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Field label="Navigation label" htmlFor={`${id}-nav-${i}-label`}>
                  <Input
                    id={`${id}-nav-${i}-label`}
                    value={str(item.label)}
                    onChange={(e) => setItem(i, { label: e.target.value })}
                  />
                </Field>
                <Field label="Navigation link" htmlFor={`${id}-nav-${i}-href`}>
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
                    External
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove link"
                    onClick={() => commit(nav.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
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
      <Field label="Footer text" htmlFor={`${id}-copyright`} className="sm:col-span-2">
        <Input
          id={`${id}-copyright`}
          value={str(content.copyright)}
          onChange={(e) => set({ copyright: e.target.value })}
          placeholder="© 2026 Your Company"
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
        <Label className="text-xs">Feature cards</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit([...items, { title: "", text: "" }])}
        >
          <Plus className="size-4" />
          Add card
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No feature cards yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item._key} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Card {i + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove card"
                  onClick={() => commit(items.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" htmlFor={`${id}-feat-${i}-title`}>
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
      <Field label="Success message" htmlFor={`${id}-success`}>
        <Input
          id={`${id}-success`}
          value={str(content.successText)}
          onChange={(e) => set({ successText: e.target.value })}
        />
      </Field>
      <Field label="Cancelled message" htmlFor={`${id}-cancelled`}>
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
      <Field label="Eyebrow" htmlFor={`${id}-eyebrow`} className="sm:col-span-2">
        <Input
          id={`${id}-eyebrow`}
          value={str(content.eyebrow)}
          onChange={(e) => set({ eyebrow: e.target.value })}
          placeholder="What our customers say"
        />
      </Field>
      <Field label="Heading" htmlFor={`${id}-heading`} className="sm:col-span-2">
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
          Show overall rating
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={bool(content.showReviewCount, true)}
            onChange={(e) => set({ showReviewCount: e.target.checked })}
            className="size-4 rounded border-input accent-primary"
          />
          Show review count
        </label>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Reviews are pulled from the cached Google sync and cannot be edited here.
      </p>
    </div>
  );
}

// Small light/dark background picker shared by the content sections that carry
// a `tone` key. Kept inline (native select) to match the other simple controls.
function ToneField({
  id,
  content,
  onChange,
}: {
  id: string;
  content: SectionContent;
  onChange: (next: SectionContent) => void;
}) {
  const tone = str(content.tone) || "light";
  return (
    <Field label="Background" htmlFor={`${id}-tone`} className="max-w-40">
      <select
        id={`${id}-tone`}
        value={tone}
        onChange={(e) => onChange({ ...content, tone: e.target.value })}
        className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </Field>
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
        <Field label="Subtitle" htmlFor={`${id}-eyebrow`}>
          <Input
            id={`${id}-eyebrow`}
            value={str(content.eyebrow)}
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Title" htmlFor={`${id}-heading`}>
          <Input
            id={`${id}-heading`}
            value={str(content.heading)}
            onChange={(e) => set({ heading: e.target.value })}
          />
        </Field>
        <Field label="Image URL" htmlFor={`${id}-imageUrl`}>
          <Input
            id={`${id}-imageUrl`}
            value={str(content.imageUrl)}
            onChange={(e) => set({ imageUrl: e.target.value })}
            placeholder="/photo.jpg"
          />
        </Field>
        <Field label="Image description (alt text)" htmlFor={`${id}-imageAlt`}>
          <Input
            id={`${id}-imageAlt`}
            value={str(content.imageAlt)}
            onChange={(e) => set({ imageAlt: e.target.value })}
          />
        </Field>
      </div>

      <ToneField id={id} content={content} onChange={onChange} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Paragraphs</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commit([...paras, { text: "" }])}
          >
            <Plus className="size-4" />
            Add paragraph
          </Button>
        </div>
        {paras.length === 0 ? (
          <p className="text-xs text-muted-foreground">No paragraphs yet.</p>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove paragraph"
                  onClick={() => commit(paras.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Button text" htmlFor={`${id}-cta-label`}>
          <Input
            id={`${id}-cta-label`}
            value={str(cta.label)}
            onChange={(e) => setCta({ label: e.target.value })}
          />
        </Field>
        <Field label="Button link" htmlFor={`${id}-cta-href`}>
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
          Opens in a new tab
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
          label="Subtitle"
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
          label="Title"
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
          label="Map embed URL"
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
      <ToneField id={id} content={content} onChange={onChange} />
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
      <ToneField id={id} content={content} onChange={onChange} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Photos</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commit([...items, { src: "", alt: "" }])}
          >
            <Plus className="size-4" />
            Add image
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No photos yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const src = str(item.src);
              return (
                <div
                  key={item._key}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                    {src ? (
                      // Arbitrary author-provided URLs — a plain img avoids the
                      // next/image remote-domain allowlist for this admin preview.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        No image
                      </span>
                    )}
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Field label="Image URL" htmlFor={`${id}-img-${i}-src`}>
                      <Input
                        id={`${id}-img-${i}-src`}
                        value={src}
                        onChange={(e) => setItem(i, { src: e.target.value })}
                        placeholder="/images/photo.jpeg"
                      />
                    </Field>
                    <Field
                      label="Description (alt text)"
                      htmlFor={`${id}-img-${i}-alt`}
                    >
                      <Input
                        id={`${id}-img-${i}-alt`}
                        value={str(item.alt)}
                        onChange={(e) => setItem(i, { alt: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove image"
                    onClick={() => commit(items.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
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
    default:
      return null;
  }
}
