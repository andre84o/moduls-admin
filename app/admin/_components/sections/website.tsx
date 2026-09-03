"use client";

import { useState, useTransition, useImperativeHandle, useEffect, forwardRef, type ComponentType } from "react";
import {
  EyeOff,
  Save,
  Send,
  Sparkles,
  Globe,
  Menu as MenuIcon,
  Megaphone,
  Images,
  Star,
  PanelBottom,
  CalendarCheck,
  LayoutTemplate,
  User,
  MapPin,
  Code2,
  BookOpen,
  ChefHat,
  UtensilsCrossed,
  Contact,
  MessageSquare,
  PartyPopper,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  publishWebsitePage,
  updateWebsiteSectionDraft,
  publishWebsiteSection,
  syncDefaultHomeWebsiteContent,
} from "@/modules/website/actions";
import type {
  AdminWebsitePageWithSections,
  AdminWebsiteSection,
  WebsiteContent,
} from "@/modules/website/types";
import {
  hasFieldEditor,
  validateSectionContent,
  SectionFields,
  type SectionContent,
} from "./website-section-fields";

/**
 * Admin Website Content editor — SPLIT VIEW.
 *
 * A CONTROLLED editor, not a free page builder. The page's sections are listed
 * in a left rail (with plain-language names and a live/draft dot); the right
 * panel edits the selected section's DRAFT content through friendly typed
 * fields. Technical concepts (section `type` strings, JSON) are hidden by
 * default — a raw-JSON escape hatch only appears for section types that have no
 * field editor. Every write goes through the tenant-scoped modules/website
 * server actions (WEBSITE guard, businessId resolved server-side); this
 * component never sends a businessId.
 */

// ─── Friendly section metadata ────────────────────────────────────────
// Maps the stored `type` string to a human name, one-line help, and an icon.
// This is the only place the raw type strings are translated for the UI.

type SectionMeta = {
  label: string;
  help: string;
  icon: ComponentType<{ className?: string }>;
};

const SECTION_META: Record<string, SectionMeta> = {
  siteHeader: {
    label: "Menu & header",
    help: "Your logo and the links at the top of every page.",
    icon: MenuIcon,
  },
  hero: {
    label: "Welcome banner",
    help: "The big headline visitors see first.",
    icon: Megaphone,
  },
  about: {
    label: "About",
    help: "Your story, photo and an optional button.",
    icon: User,
  },
  reviews: {
    label: "Find us",
    help: "Location text and an embedded map.",
    icon: MapPin,
  },
  featureGrid: {
    label: "Highlights",
    help: "Short selling points shown as cards.",
    icon: Sparkles,
  },
  gallery: {
    label: "Photo gallery",
    help: "A grid of your photos.",
    icon: Images,
  },
  googleReviews: {
    label: "Customer reviews",
    help: "Star ratings pulled automatically from Google.",
    icon: Star,
  },
  bookingBanner: {
    label: "Booking messages",
    help: "The confirmation text shown after a booking.",
    icon: CalendarCheck,
  },
  restaurantHero: {
    label: "Välkomstbanner",
    help: "Den stora rubriken och fotot som besökare ser först.",
    icon: Megaphone,
  },
  restaurantStory: {
    label: "Vår historia",
    help: "Din berättelsetext med ett foto.",
    icon: BookOpen,
  },
  restaurantSpecialties: {
    label: "Specialiteter",
    help: "Utvalda rätter som visas som kort.",
    icon: ChefHat,
  },
  restaurantGallery: {
    label: "Fotogalleri",
    help: "Ett rutnät med dina foton.",
    icon: Images,
  },
  menuIntro: {
    label: "Menu intro",
    help: "Heading, intro text and allergy note shown above the menu.",
    icon: BookOpen,
  },
  menuList: {
    label: "Menylista",
    help: "Dina menykategorier, grupper och priser.",
    icon: UtensilsCrossed,
  },
  contactInfo: {
    label: "Kontaktuppgifter",
    help: "Adress, öppettider, karta och kontaktkort.",
    icon: Contact,
  },
  contactForm: {
    label: "Kontaktformulär",
    help: "Introduktionstext för det publika meddelandeformuläret.",
    icon: MessageSquare,
  },
  cateringHero: {
    label: "Cateringbanner",
    help: "Cateringrubriken, introduktionen och fotot.",
    icon: PartyPopper,
  },
  cateringEditorial: {
    label: "Cateringtext",
    help: "Cateringtextsektioner och listan över tillfällen.",
    icon: FileText,
  },
  cateringIntro: {
    label: "Catering intro",
    help: "Heading, intro text and note shown above the catering menus.",
    icon: BookOpen,
  },
  cateringMenus: {
    label: "Cateringmenyer",
    help: "De fasta cateringmenyerna med rätter, taggar och priser.",
    icon: UtensilsCrossed,
  },
  siteFooter: {
    label: "Footer",
    help: "The small print at the bottom of every page.",
    icon: PanelBottom,
  },
};

// Prettify an unknown type ("customThing" → "Custom thing") for a fallback name.
function prettifyType(type: string): string {
  const spaced = type
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : type;
}

// A page title that looks like a raw CUID/ID was stored incorrectly in the DB.
// Fall back to a prettified key so the UI never shows a raw database ID.
function pageDisplayName(p: { title: string; key: string; slug: string | null }): string {
  const isCuidLike = /^c[a-z0-9]{20,30}$/.test(p.title);
  if (!p.title || isCuidLike) return prettifyType(p.key);
  return p.title;
}

export function metaFor(type: string): SectionMeta {
  return (
    SECTION_META[type] ?? {
      label: prettifyType(type),
      help: "Custom section.",
      icon: LayoutTemplate,
    }
  );
}

// ─── content helpers ──────────────────────────────────────────────────

// Stable compare of two JSON contents to detect unpublished draft changes.
function sameContent(a: WebsiteContent, b: WebsiteContent): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Pretty-print content for the textarea; null/absent becomes an empty object.
function prettyJson(v: WebsiteContent): string {
  return v == null ? "{}" : JSON.stringify(v, null, 2);
}

// Section status → one of three plain-language states for dots and pills.
type SectionState = "draft" | "live" | "hidden";
export function sectionState(section: AdminWebsiteSection): SectionState {
  if (!sameContent(section.draftContent, section.publishedContent))
    return "draft";
  return section.isVisible ? "live" : "hidden";
}

export function WebsiteSection({
  pages,
}: {
  pages: AdminWebsitePageWithSections[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    pages[0]?.id ?? null,
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    pages[0]?.sections[0]?.id ?? null,
  );
  const [editorError, setEditorError] = useState<string | null>(null);
  // Result/error of the "default Home content" create-missing-only sync.
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Keep the selection valid as the page/section lists change after revalidation.
  const selectedPage =
    pages.find((p) => p.id === selectedPageId) ?? pages[0] ?? null;
  const sections = selectedPage?.sections ?? [];
  const selectedSection =
    sections.find((s) => s.id === selectedSectionId) ?? sections[0] ?? null;

  function handleSyncHome() {
    setSeedError(null);
    setSeedResult(null);
    startTransition(async () => {
      const res = await syncDefaultHomeWebsiteContent();
      if (res.error) {
        setSeedError(res.error);
        return;
      }
      setSeedResult(
        [
          res.createdPage ? "Created Home page." : "Home page already existed.",
          `Added ${res.createdSections} section${res.createdSections === 1 ? "" : "s"}.`,
        ].join(" "),
      );
    });
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit the sections of your website. Changes are saved as a draft;
            publish to make them live.
          </p>
        </div>
        {pages.length > 1 ? (
          <Select
            value={selectedPage?.id}
            items={pages.map((p) => ({ value: p.id, label: pageDisplayName(p) }))}
            onValueChange={(value) => {
              if (!value) return;
              setSelectedPageId(value);
              setSelectedSectionId(null);
              setEditorError(null);
            }}
          >
            <SelectTrigger className="min-w-40" aria-label="Page">
              <SelectValue placeholder="Select page" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {pageDisplayName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </header>

      {pages.length === 0 ? (
        <EmptyState
          isPending={isPending}
          onSeed={handleSyncHome}
          seedResult={seedResult}
          seedError={seedError}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left rail — page + section list */}
          <div className="space-y-4">
            {selectedPage ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {pageDisplayName(selectedPage)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPage.status === "PUBLISHED" ? "Published" : "Draft"}
                    {" · "}
                    {selectedPage.sections.length} section
                    {selectedPage.sections.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-[#FF969D] text-white hover:bg-[#F97882]"
                  disabled={isPending}
                  onClick={() => {
                    setEditorError(null);
                    startTransition(async () => {
                      const res = await publishWebsitePage(selectedPage.id);
                      if (res?.error) setEditorError(res.error);
                    });
                  }}
                >
                  <Globe className="size-4" />
                  Publish
                </Button>
              </div>
            ) : null}

            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sections
                </span>
              </div>
              <div className="space-y-1 px-2 pb-2">
                {sections.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No sections on this page.
                  </p>
                ) : (
                  sections.map((section) => {
                    const meta = metaFor(section.type);
                    const Icon = meta.icon;
                    const active = selectedSection?.id === section.id;
                    const state = sectionState(section);
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          setSelectedSectionId(section.id);
                          setEditorError(null);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                          active
                            ? "bg-[#FFE3E5] text-[#B4434B]"
                            : "hover:bg-[#FEE8FF]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-[#FF969D]" : "text-muted-foreground",
                          )}
                        />
                        <span className="flex-1 truncate text-sm font-medium">
                          {meta.label}
                        </span>
                        <StateDot state={state} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right panel — the selected section editor */}
          <div>
            {editorError ? (
              <p className="mb-3 text-sm text-destructive">{editorError}</p>
            ) : null}
            {selectedSection ? (
              <SectionEditor
                // Remount on server-confirmed change so the fields resync.
                key={`${selectedSection.id}:${selectedSection.updatedAt}`}
                section={selectedSection}
              />
            ) : (
              <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed bg-card/50 p-8 text-center">
                <div>
                  <LayoutTemplate className="mx-auto mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Select a section to start editing this page.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── small presentational pieces ──────────────────────────────────────

export function StateDot({ state }: { state: SectionState }) {
  if (state === "draft")
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-[#FF969D]"
        aria-label="Draft changes"
      />
    );
  if (state === "live")
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-[#3F9E46]"
        aria-label="Live"
      />
    );
  return (
    <EyeOff
      className="size-3.5 shrink-0 text-muted-foreground/50"
      aria-label="Hidden"
    />
  );
}

function StatePill({ state }: { state: SectionState }) {
  if (state === "draft")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE3E5] px-2.5 py-1 text-xs font-medium text-[#B4434B] ring-1 ring-[#FFC7CC]">
        <span className="size-2 rounded-full bg-[#FF969D]" />
        Draft changes
      </span>
    );
  if (state === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0FCDE] px-2.5 py-1 text-xs font-medium text-[#2F7D34] ring-1 ring-[#B8ECB6]">
        <span className="size-2 rounded-full bg-[#3F9E46]" />
        Live
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
      <EyeOff className="size-3" />
      Hidden
    </span>
  );
}

function EmptyState({
  isPending,
  onSeed,
  seedResult,
  seedError,
}: {
  isPending: boolean;
  onSeed: () => void;
  seedResult: string | null;
  seedError: string | null;
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card/50 p-12 text-center">
      <div className="max-w-md">
        <Globe className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Set up your website</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from the built-in template — it creates a Home page with the
          standard sections you can then edit. Nothing is overwritten.
        </p>
        <Button className="mt-5" disabled={isPending} onClick={onSeed}>
          <Sparkles className="size-4" />
          {isPending ? "Working…" : "Create default website"}
        </Button>
        {seedResult ? (
          <p className="mt-3 text-sm text-muted-foreground">{seedResult}</p>
        ) : null}
        {seedError ? (
          <p className="mt-3 text-sm text-destructive">{seedError}</p>
        ) : null}
      </div>
    </div>
  );
}

// Coerce stored draft content into a plain object for the typed field editors.
function asContentObject(v: WebsiteContent): SectionContent {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as SectionContent)
    : {};
}

/**
 * The right-hand editor for one section. Sections with a field editor render
 * friendly labelled fields (Title, Text, Photos, …); an "Advanced (JSON)" toggle
 * exposes the raw JSON, which is also the only editor for types without one.
 * Save validates then writes via the tenant-scoped server action.
 */
export interface SectionEditorHandle {
  save: () => void;
  publish: () => void;
}

export const SectionEditor = forwardRef<
  SectionEditorHandle,
  {
    section: AdminWebsiteSection;
    onStateChange?: (state: { hasUnsavedEdits: boolean; hasUnpublished: boolean }) => void;
  }
>(function SectionEditor({ section, onStateChange }, ref) {
  const meta = metaFor(section.type);
  const known = hasFieldEditor(section.type);
  const [content, setContent] = useState<SectionContent>(() =>
    asContentObject(section.draftContent),
  );
  // Advanced JSON mode: always on for types without a field editor, opt-in else.
  const [advanced, setAdvanced] = useState(!known);
  const [jsonText, setJsonText] = useState(() =>
    prettyJson(section.draftContent),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showJson = advanced;
  const state = sectionState(section);

  // Does the editor hold edits not yet written to the draft? (drives Save color)
  const currentDraft: WebsiteContent | undefined = showJson
    ? (() => {
        try {
          return jsonText.trim() === ""
            ? {}
            : (JSON.parse(jsonText) as WebsiteContent);
        } catch {
          return undefined; // invalid JSON — treat as unsaved
        }
      })()
    : (content as WebsiteContent);
  const hasUnsavedEdits =
    currentDraft === undefined ||
    !sameContent(currentDraft, section.draftContent);
  // Draft differs from what's live? (drives Publish color)
  const hasUnpublished = state === "draft";

  function toggleAdvanced() {
    if (!advanced) {
      // Entering advanced: seed the JSON from the current typed content.
      setJsonText(JSON.stringify(content, null, 2));
      setJsonError(null);
      setError(null);
      setAdvanced(true);
      return;
    }
    // Leaving advanced: adopt the JSON into typed content. Block the switch
    // (keep JSON open) when the JSON is invalid OR is not a plain object.
    let parsed: unknown;
    try {
      parsed = jsonText.trim() === "" ? {} : JSON.parse(jsonText);
    } catch {
      setJsonError("Invalid JSON — fix it before switching to fields.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setJsonError("Content must be a JSON object to edit as fields.");
      return;
    }
    setContent(parsed as SectionContent);
    setJsonError(null);
    setError(null);
    setAdvanced(false);
  }

  function onJsonChange(text: string) {
    setJsonText(text);
    if (text.trim() === "") {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON — fix the syntax and try again.");
    }
  }

  useImperativeHandle(ref, () => ({ save: saveDraft, publish }));

  useEffect(() => {
    onStateChange?.({ hasUnsavedEdits, hasUnpublished });
  }, [hasUnsavedEdits, hasUnpublished, onStateChange]);

  function saveDraft() {
    let toSave: WebsiteContent;
    if (showJson) {
      try {
        toSave =
          jsonText.trim() === ""
            ? {}
            : (JSON.parse(jsonText) as WebsiteContent);
      } catch {
        setError("Invalid JSON — fix the syntax and try again.");
        return;
      }
    } else {
      const invalid = validateSectionContent(section.type, content);
      if (invalid) {
        setError(invalid);
        return;
      }
      toSave = content as WebsiteContent;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateWebsiteSectionDraft({
        id: section.id,
        draftContent: toSave,
      });
      if (res?.error) setError(res.error);
    });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const res = await publishWebsiteSection(section.id);
      if (res?.error) setError(res.error);
    });
  }

  const Icon = meta.icon;

  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#FEE8FF] text-[#FF969D]">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{meta.label}</h3>
              <StatePill state={state} />
            </div>
            <p className="text-sm text-muted-foreground">{meta.help}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {known ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={toggleAdvanced}
              className={cn(
                "gap-1.5 border-[#FF969D] text-[#B4434B] hover:bg-[#FFE3E5] hover:text-[#B4434B]",
                advanced && "bg-[#FFE3E5]",
              )}
            >
              <Code2 className="size-4" />
              {advanced ? "Simple" : "Advanced"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {showJson ? (
          <>
            {!hasFieldEditor(section.type) ? (
              <p className="mb-2 text-xs text-muted-foreground">
                This section type has no simple editor yet — edit its content as
                JSON below.
              </p>
            ) : null}
            <Label htmlFor={`draft-${section.id}`} className="text-xs">
              Content (JSON)
            </Label>
            <Textarea
              id={`draft-${section.id}`}
              value={jsonText}
              onChange={(e) => onJsonChange(e.target.value)}
              spellCheck={false}
              className="mt-1.5 min-h-48 font-mono text-xs"
            />
            {jsonError ? (
              <p className="mt-2 text-sm text-destructive">{jsonError}</p>
            ) : null}
          </>
        ) : (
          <SectionFields
            id={`sf-${section.id}`}
            type={section.type}
            content={content}
            onChange={setContent}
          />
        )}

        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            hasUnsavedEdits
              ? "border-transparent bg-[#FF969D] text-white hover:bg-[#F97882] hover:text-white"
              : "text-muted-foreground",
          )}
          disabled={isPending}
          onClick={saveDraft}
        >
          <Save className="size-4" />
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            hasUnpublished
              ? "border-transparent bg-[#FF969D] text-white hover:bg-[#F97882] hover:text-white"
              : "text-muted-foreground",
          )}
          disabled={isPending}
          onClick={publish}
        >
          <Send className="size-4" />
          Publish
        </Button>
      </div>
    </div>
  );
});
