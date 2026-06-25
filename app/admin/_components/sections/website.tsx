"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, Eye, EyeOff, Save, Send, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createWebsitePage,
  publishWebsitePage,
  deleteWebsitePage,
  createWebsiteSection,
  updateWebsiteSectionDraft,
  setWebsiteSectionVisibility,
  publishWebsiteSection,
  deleteWebsiteSection,
  syncDefaultHomeWebsiteContent,
} from "@/modules/website/actions";
import type {
  AdminWebsitePageWithSections,
  AdminWebsiteSection,
  WebsiteContent,
} from "@/modules/website/types";
import {
  KNOWN_SECTION_TYPES,
  isKnownSectionType,
  validateSectionContent,
  SectionFields,
  type SectionContent,
} from "./website-section-fields";

/**
 * Admin Website Content editor.
 *
 * A CONTROLLED editor — not a free page builder. It lists the business's
 * website pages, the sections of the selected page, and edits each section's
 * DRAFT content. Known section types get typed field editors (Phase 8E); a JSON
 * textarea remains an advanced fallback and the only editor for unknown types.
 * Every write goes through the existing modules/website server actions, which
 * resolve businessId server-side and enforce the WEBSITE module guard — this
 * component never sends a businessId.
 *
 * Section `type` is chosen from the known public section registry so authors
 * cannot invent arbitrary types. Publishing copies draft -> published via the
 * existing publish actions; public rendering is unchanged in this phase.
 */

const pageStatusVariant: Record<"PUBLISHED" | "DRAFT", "default" | "secondary"> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
};

// Stable compare of two JSON contents to detect unpublished draft changes.
function sameContent(a: WebsiteContent, b: WebsiteContent): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Pretty-print content for the textarea; null/absent becomes an empty object.
function prettyJson(v: WebsiteContent): string {
  return v == null ? "{}" : JSON.stringify(v, null, 2);
}

export function WebsiteSection({
  pages,
}: {
  pages: AdminWebsitePageWithSections[];
}) {
  const newPageForm = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    pages[0]?.id ?? null,
  );
  // `pageError` belongs to the New page form; `editorError` to the selected
  // page panel (add section / publish page), shown next to those controls.
  const [pageError, setPageError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  // Result/error of the "default Home content" create-missing-only sync.
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Keep the selection valid as the page list changes after revalidation.
  const selected =
    pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  function handleCreatePage(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const key = String(formData.get("key") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (!title || !key) {
      setPageError("Title and key are required.");
      return;
    }
    setPageError(null);
    startTransition(async () => {
      const res = await createWebsitePage({ title, key, slug: slug || null });
      if (res?.error) {
        setPageError(res.error);
      } else {
        if (res?.id) setSelectedId(res.id);
        newPageForm.current?.reset();
      }
    });
  }

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
          `Created ${res.createdSections} section${res.createdSections === 1 ? "" : "s"}.`,
          `Skipped ${res.skippedSections} existing.`,
        ].join(" "),
      );
    });
  }

  function handleAddSection(formData: FormData) {
    if (!selected) return;
    const type = String(formData.get("type") ?? "").trim();
    if (!type) return;
    setEditorError(null);
    startTransition(async () => {
      const res = await createWebsiteSection({
        pageId: selected.id,
        type,
        draftContent: {},
      });
      if (res?.error) setEditorError(res.error);
    });
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Website</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your website pages and their content sections. Edits are saved
          as a draft; publish to make them live.
        </p>
      </header>

      {/* Default Home content — create-missing-only seed from config */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Default content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Create the Home page and its default sections from the built-in
            template. This only adds what is missing — it never overwrites
            existing pages or sections.
          </p>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={handleSyncHome}
          >
            <Sparkles className="size-4" />
            {isPending ? "Working…" : "Create default Home content"}
          </Button>
          {seedResult ? (
            <p className="mt-2 text-sm text-muted-foreground">{seedResult}</p>
          ) : null}
          {seedError ? (
            <p className="mt-2 text-sm text-destructive">{seedError}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* New page */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>New page</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={newPageForm}
            action={handleCreatePage}
            className="grid gap-4 sm:grid-cols-3"
          >
            <div>
              <Label htmlFor="page-title">Title</Label>
              <Input id="page-title" name="title" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="page-key">Key</Label>
              <Input
                id="page-key"
                name="key"
                required
                placeholder="home"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="page-slug">Slug (optional)</Label>
              <Input id="page-slug" name="slug" className="mt-1.5" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={isPending}>
                <Plus className="size-4" />
                {isPending ? "Saving…" : "Add page"}
              </Button>
              {pageError ? (
                <p className="mt-2 text-sm text-destructive">{pageError}</p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Page list */}
      <Card className="mb-8 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Key</TableHead>
              <TableHead className="text-xs">Slug</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Sections</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No pages yet. Create your first one above.
                </TableCell>
              </TableRow>
            ) : (
              pages.map((p) => (
                <TableRow
                  key={p.id}
                  data-state={selected?.id === p.id ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedId(p.id);
                    setEditorError(null);
                  }}
                >
                  <TableCell className="text-sm font-medium">{p.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.key}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.slug ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pageStatusVariant[p.status]}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {p.sections.length}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Selected page editor */}
      {selected ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {selected.title}
                <Badge variant={pageStatusVariant[selected.status]}>
                  {selected.status}
                </Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.key}
                {selected.slug ? ` · /${selected.slug}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setEditorError(null);
                  startTransition(async () => {
                    const res = await publishWebsitePage(selected.id);
                    if (res?.error) setEditorError(res.error);
                  });
                }}
              >
                <Send className="size-4" />
                Publish page
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete page"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => deleteWebsitePage(selected.id))
                }
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add section */}
            <form
              action={handleAddSection}
              className="flex flex-wrap items-end gap-2 border-b pb-4"
            >
              <div>
                <Label htmlFor="section-type">Add section</Label>
                <select
                  id="section-type"
                  name="type"
                  defaultValue={KNOWN_SECTION_TYPES[0]}
                  className="mt-1.5 h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {KNOWN_SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                <Plus className="size-4" />
                Add
              </Button>
            </form>

            {editorError ? (
              <p className="text-sm text-destructive">{editorError}</p>
            ) : null}

            {selected.sections.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sections yet. Add one above.
              </p>
            ) : (
              selected.sections.map((section) => (
                <SectionEditor
                  // Remount on server-confirmed change so the textarea resyncs.
                  key={`${section.id}:${section.updatedAt}`}
                  section={section}
                />
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
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
 * One section's draft editor. Known section types render typed field editors
 * (Title, Text, Button link, …); an "Advanced (JSON)" toggle exposes the raw
 * JSON, which is also the only editor for unknown types. Save validates the
 * required fields (or the JSON) and writes via the tenant-scoped server action.
 */
function SectionEditor({ section }: { section: AdminWebsiteSection }) {
  const known = isKnownSectionType(section.type);
  const [content, setContent] = useState<SectionContent>(() =>
    asContentObject(section.draftContent),
  );
  // Advanced JSON mode: always on for unknown types, opt-in for known types.
  const [advanced, setAdvanced] = useState(!known);
  const [jsonText, setJsonText] = useState(() => prettyJson(section.draftContent));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showJson = advanced;
  const unpublished = !sameContent(
    section.draftContent,
    section.publishedContent,
  );

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
    // (keep JSON open) when the JSON is invalid OR is not a plain object, since
    // the typed fields can only represent an object — never silently drop it.
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

  function saveDraft() {
    let toSave: WebsiteContent;
    if (showJson) {
      try {
        toSave =
          jsonText.trim() === "" ? {} : (JSON.parse(jsonText) as WebsiteContent);
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
      // Field editors only ever write JSON-serializable values (strings,
      // booleans, arrays of objects); safe to treat as WebsiteContent.
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

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{section.type}</span>
          <Badge variant="outline" className="tabular-nums">
            #{section.sortOrder}
          </Badge>
          {section.isVisible ? (
            <Badge variant="secondary">Visible</Badge>
          ) : (
            <Badge variant="outline">Hidden</Badge>
          )}
          {unpublished ? (
            <Badge variant="default">Unpublished changes</Badge>
          ) : (
            <Badge variant="secondary">Published</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {known ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={toggleAdvanced}
            >
              {advanced ? "Fields" : "Advanced (JSON)"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(() =>
                setWebsiteSectionVisibility(section.id, !section.isVisible),
              )
            }
          >
            {section.isVisible ? (
              <>
                <EyeOff className="size-4" />
                Hide
              </>
            ) : (
              <>
                <Eye className="size-4" />
                Show
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete section"
            disabled={isPending}
            onClick={() =>
              startTransition(() => deleteWebsiteSection(section.id))
            }
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {showJson ? (
        <>
          <Label htmlFor={`draft-${section.id}`} className="text-xs">
            Draft content (JSON){known ? " — advanced" : ""}
          </Label>
          <Textarea
            id={`draft-${section.id}`}
            value={jsonText}
            onChange={(e) => onJsonChange(e.target.value)}
            spellCheck={false}
            className="mt-1.5 min-h-40 font-mono text-xs"
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
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={isPending} onClick={saveDraft}>
          <Save className="size-4" />
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={publish}
        >
          <Send className="size-4" />
          Publish
        </Button>
      </div>
    </div>
  );
}
