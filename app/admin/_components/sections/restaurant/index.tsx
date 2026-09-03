"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { UtensilsCrossed, Plus, LayoutTemplate, Pencil, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createWebsiteSection,
  updateWebsiteSectionInternalName,
} from "@/modules/website/actions";
import { metaFor, sectionState, StateDot, SectionEditor, type SectionEditorHandle } from "../website";
import type { AdminWebsitePageWithSections } from "@/modules/website/types";
import type { AdminWebsiteSection } from "@/modules/website/types";

function sectionLabel(section: AdminWebsiteSection, fallback: string): string {
  const content = section.draftContent;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const name = (content as Record<string, unknown>).internalName;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return fallback;
}

/** Inline-editable name shown in the section list. */
function InlineName({
  section,
  fallback,
  active,
}: {
  section: AdminWebsiteSection;
  fallback: string;
  active: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => sectionLabel(section, fallback));
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function save() {
    setEditing(false);
    const trimmed = value.trim() || fallback;
    setValue(trimmed);
    startTransition(async () => {
      await updateWebsiteSectionInternalName({
        id: section.id,
        internalName: trimmed,
      });
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(sectionLabel(section, fallback));
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 truncate bg-transparent text-sm font-medium outline-none"
      />
    );
  }

  return (
    <span className="group/name flex flex-1 min-w-0 items-center">
      <span className="truncate text-sm font-medium flex-1">{value}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            setEditing(true);
          }
        }}
        aria-label="Rename"
        className={cn(
          "ml-2 shrink-0 cursor-pointer rounded p-0.5 opacity-0 transition-opacity group-hover/name:opacity-60 hover:!opacity-100",
          active ? "text-[#B4434B]" : "text-muted-foreground",
        )}
      >
        <Pencil className="size-3" />
      </span>
    </span>
  );
}

export function RestaurantSection({
  pages,
  defaultPageId,
}: {
  pages: AdminWebsitePageWithSections[];
  defaultPageId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const editorRef = useRef<SectionEditorHandle>(null);
  const [editorState, setEditorState] = useState({ hasUnsavedEdits: false, hasUnpublished: false });

  const sections = pages.flatMap((p) => p.sections);

  const [selectedId, setSelectedId] = useState<string | null>(
    sections[0]?.id ?? null,
  );

  const selectedSection =
    sections.find((s) => s.id === selectedId) ?? sections[0] ?? null;

  function selectSection(id: string) {
    setSelectedId(id);
    setEditorState({ hasUnsavedEdits: false, hasUnpublished: false });
  }

  function addMenu() {
    if (!defaultPageId) return;
    startTransition(async () => {
      await createWebsiteSection({ pageId: defaultPageId, type: "menuList" });
    });
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Restaurant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage menus and restaurant content.
          </p>
        </div>

        {defaultPageId && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={addMenu}
          >
            <UtensilsCrossed className="size-4" />
            <Plus className="size-3" />
            Add menu
          </Button>
        )}
      </header>

      {sections.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No menus yet. Use the button above to add one.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left rail — sticky with action buttons above section list */}
          <div className="sticky top-14 self-start space-y-2">
            {selectedSection && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1",
                    editorState.hasUnsavedEdits
                      ? "border-transparent bg-[#FF969D] text-white hover:bg-[#F97882] hover:text-white"
                      : "text-muted-foreground",
                  )}
                  onClick={() => editorRef.current?.save()}
                >
                  <Save className="size-4" />
                  Save draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1",
                    editorState.hasUnpublished
                      ? "border-transparent bg-[#FF969D] text-white hover:bg-[#F97882] hover:text-white"
                      : "text-muted-foreground",
                  )}
                  onClick={() => editorRef.current?.publish()}
                >
                  <Send className="size-4" />
                  Publish
                </Button>
              </div>
            )}
            <div className="rounded-lg border bg-card">
            <div className="px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sections
              </span>
            </div>
            <div className="space-y-1 px-2 pb-2">
              {sections.map((section) => {
                const meta = metaFor(section.type);
                const Icon = meta.icon;
                const active = selectedSection?.id === section.id;
                const state = sectionState(section);
                return (
                  <button
                    key={section.id}
                    onClick={() => selectSection(section.id)}
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
                    <InlineName
                      section={section}
                      fallback={meta.label}
                      active={active}
                    />
                    <StateDot state={state} />
                  </button>
                );
              })}
            </div>
          </div>
          </div>

          <div>
            {selectedSection ? (
              <SectionEditor
                ref={editorRef}
                key={`${selectedSection.id}:${selectedSection.updatedAt}`}
                section={selectedSection}
                onStateChange={setEditorState}
              />
            ) : (
              <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed bg-card/50 p-8 text-center">
                <div>
                  <LayoutTemplate className="mx-auto mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Select a section to start editing.
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
