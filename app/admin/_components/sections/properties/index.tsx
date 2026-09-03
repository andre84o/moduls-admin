"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, ImagePlus, Plus, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  setPropertyStatus,
  uploadPropertyImage,
  deleteMedia,
} from "@/lib/actions";
import type { AdminProperty, PropertyStatus } from "../../../types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const statusVariant: Record<
  PropertyStatus,
  "default" | "secondary" | "outline"
> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

const CURRENCIES = ["sek", "eur", "usd", "gbp", "nok", "dkk"] as const;

// Money is stored in minor units (öre/cents) — show major units in the inputs.
function toMajor(minor: number | null | undefined): string {
  return minor == null ? "" : String(minor / 100);
}

// ---------------------------------------------------------------------------
// Step configuration
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: "Info" },
  { id: 2, label: "Pricing" },
  { id: 3, label: "Capacity" },
  { id: 4, label: "Rules" },
  { id: 5, label: "Images" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ---------------------------------------------------------------------------
// Status dot helper
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: PropertyStatus }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", {
        "bg-green-500": status === "PUBLISHED",
        "bg-amber-400": status === "DRAFT",
        "bg-gray-400": status === "ARCHIVED",
      })}
    />
  );
}

// ---------------------------------------------------------------------------
// Add property wizard modal
// ---------------------------------------------------------------------------

const WIZARD_STEPS = [
  { id: 1, label: "Info",     desc: "Basic details about the property" },
  { id: 2, label: "Pricing",  desc: "Rates and currency" },
  { id: 3, label: "Capacity", desc: "Guest limits and pet policy" },
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

function AddPropertyWizard({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  isPending: boolean;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const formRef = useRef<HTMLFormElement>(null);

  function next() { if (step < 3) setStep((s) => (s + 1) as WizardStep); }
  function back() { if (step > 1) setStep((s) => (s - 1) as WizardStep); }

  function handleClose() {
    setStep(1);
    formRef.current?.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add property</DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <ol className="flex items-center pt-1">
          {WIZARD_STEPS.map((s, i) => {
            const done   = s.id < step;
            const active = s.id === step;
            return (
              <li key={s.id} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    active ? "bg-primary text-primary-foreground" :
                    done   ? "bg-primary/20 text-primary" :
                             "border border-input text-muted-foreground",
                  )}>
                    {done ? <Check className="size-3.5" /> : s.id}
                  </span>
                  <span className={cn("hidden text-xs sm:block", active ? "font-medium" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <span className="mx-3 h-px flex-1 bg-border" />
                )}
              </li>
            );
          })}
        </ol>

        <p className="text-sm text-muted-foreground -mt-1">
          Step {step} of 3 — {WIZARD_STEPS[step - 1].desc}
        </p>

        <form ref={formRef} action={onSubmit} className="space-y-4">
          {/* Step 1 — Info */}
          <fieldset hidden={step !== 1} className="space-y-4">
            <div>
              <Label htmlFor="w-title">Title *</Label>
              <Input id="w-title" name="title" required placeholder="e.g. Villa Havsutsikt" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="w-location">Location *</Label>
                <Input id="w-location" name="location" required placeholder="City, country" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-bedrooms">Bedrooms</Label>
                <Input id="w-bedrooms" name="bedrooms" type="number" min="0" className="mt-1.5" />
              </div>
            </div>
          </fieldset>

          {/* Step 2 — Pricing */}
          <fieldset hidden={step !== 2} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="w-price">Price per night</Label>
                <Input id="w-price" name="pricePerNight" type="number" min="0" step="0.01" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-cleaning">Cleaning fee</Label>
                <Input id="w-cleaning" name="cleaningFee" type="number" min="0" step="0.01" className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="w-currency">Currency</Label>
                <select id="w-currency" name="currency" defaultValue="sek"
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="w-minnights">Minimum nights</Label>
                <Input id="w-minnights" name="minNights" type="number" min="1" defaultValue="1" className="mt-1.5" />
              </div>
            </div>
          </fieldset>

          {/* Step 3 — Capacity */}
          <fieldset hidden={step !== 3} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="w-guests">Max guests</Label>
                <Input id="w-guests" name="maxGuests" type="number" min="0" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-adults">Max adults</Label>
                <Input id="w-adults" name="maxAdults" type="number" min="0" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-children">Max children</Label>
                <Input id="w-children" name="maxChildren" type="number" min="0" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-infants">Max infants</Label>
                <Input id="w-infants" name="maxInfants" type="number" min="0" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-pets">Max pets</Label>
                <Input id="w-pets" name="maxPets" type="number" min="0" defaultValue="0" className="mt-1.5" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input id="w-petsallowed" name="petsAllowed" type="checkbox" value="true"
                  className="size-4 rounded border-input accent-primary" />
                <Label htmlFor="w-petsallowed" className="mb-0">Pets allowed</Label>
              </div>
            </div>
          </fieldset>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" onClick={back} disabled={step === 1}>
              Back
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={next}>Next</Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create property"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Left rail — property list
// ---------------------------------------------------------------------------

function PropertyRail({
  properties,
  selectedId,
  onSelect,
  onAddClick,
}: {
  properties: AdminProperty[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
}) {
  return (
    <aside className="sticky top-14 self-start rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Properties</span>
        <button
          type="button"
          onClick={onAddClick}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Add property"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="p-2">
        {properties.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No properties yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {properties.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md transition-colors",
                    selectedId === p.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <StatusDot status={p.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {p.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.location}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t p-2">
        <button
          type="button"
          onClick={onAddClick}
          className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
          Add property
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Step tab bar
// ---------------------------------------------------------------------------

function StepTabs({
  step,
  onStep,
}: {
  step: StepId;
  onStep: (s: StepId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {STEPS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onStep(s.id)}
          className={cn(
            "px-4 py-1.5 text-sm transition-colors",
            step === s.id
              ? "bg-primary text-primary-foreground rounded-full font-medium"
              : "text-muted-foreground hover:text-foreground rounded-full"
          )}
        >
          {s.id} · {s.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Images step (rendered outside the main form)
// ---------------------------------------------------------------------------

function ImagesStep({
  property,
  isPending,
  startTransition,
}: {
  property: AdminProperty;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Property images</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upload photos that will be shown on public property listings.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {property.images.map((img) => (
          <div key={img.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt ?? property.title}
              className="size-24 rounded-md object-cover"
            />
            <ConfirmDialog
              trigger={
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <Trash2 className="size-3" />
                </button>
              }
              title="Remove image?"
              confirmLabel="Remove"
              onConfirm={() =>
                startTransition(() => deleteMedia(img.id))
              }
              disabled={isPending}
            />
          </div>
        ))}

        <form action={uploadPropertyImage}>
          <input type="hidden" name="propertyId" value={property.id} />
          <Label
            htmlFor={`file-${property.id}`}
            className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/40"
          >
            <ImagePlus className="size-5" />
            Add image
          </Label>
          <Input
            id={`file-${property.id}`}
            name="file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property detail panel
// ---------------------------------------------------------------------------

function PropertyPanel({
  property,
  isPending,
  startTransition,
  onDelete,
}: {
  property: AdminProperty;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
  onDelete: (id: string) => void;
}) {
  const [step, setStep] = useState<StepId>(1);
  const p = property;

  function handleUpdate(formData: FormData) {
    startTransition(() => updateProperty(formData));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{p.title}</h2>
          <div className="mt-1.5">
            <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(() =>
                setPropertyStatus(
                  p.id,
                  p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
                )
              )
            }
          >
            {p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </Button>

          {p.status !== "ARCHIVED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(() => setPropertyStatus(p.id, "ARCHIVED"))
              }
            >
              Archive
            </Button>
          )}

          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete property"
                disabled={isPending}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            }
            title="Delete property?"
            description="This permanently deletes the property and all its images."
            confirmLabel="Delete"
            onConfirm={() => onDelete(p.id)}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Step tabs */}
      <StepTabs step={step} onStep={setStep} />

      {/* Main form — steps 1–4, all fieldsets mounted, hidden with CSS when inactive */}
      {step !== 5 && (
        <form action={handleUpdate} className="space-y-6">
          <input type="hidden" name="id" value={p.id} />

          {/* Step 1 — Info */}
          <fieldset hidden={step !== 1} className={step !== 1 ? "hidden" : ""}>
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">Basic information</h3>
              <p className="text-xs text-muted-foreground">
                The core details shown on the property listing.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor={`s1-title-${p.id}`}>Title *</Label>
                <Input
                  id={`s1-title-${p.id}`}
                  name="title"
                  required
                  defaultValue={p.title}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s1-location-${p.id}`}>Location *</Label>
                <Input
                  id={`s1-location-${p.id}`}
                  name="location"
                  required
                  defaultValue={p.location}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s1-bedrooms-${p.id}`}>Bedrooms</Label>
                <Input
                  id={`s1-bedrooms-${p.id}`}
                  name="bedrooms"
                  type="number"
                  min="0"
                  defaultValue={p.bedrooms ?? ""}
                  className="mt-1.5"
                />
              </div>
            </div>
          </fieldset>

          {/* Step 2 — Pricing */}
          <fieldset hidden={step !== 2} className={step !== 2 ? "hidden" : ""}>
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">Pricing</h3>
              <p className="text-xs text-muted-foreground">
                Set nightly rates and booking minimums. Money values are in major
                units (e.g. SEK, not öre).
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`s2-ppn-${p.id}`}>Price per night</Label>
                <Input
                  id={`s2-ppn-${p.id}`}
                  name="pricePerNight"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={toMajor(p.pricePerNight)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s2-cf-${p.id}`}>Cleaning fee</Label>
                <Input
                  id={`s2-cf-${p.id}`}
                  name="cleaningFee"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={toMajor(p.cleaningFee)}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Only shown in the booking price summary.
                </p>
              </div>
              <div>
                <Label htmlFor={`s2-cur-${p.id}`}>Currency</Label>
                <select
                  id={`s2-cur-${p.id}`}
                  name="currency"
                  defaultValue={p.currency ?? "sek"}
                  className="mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`s2-mn-${p.id}`}>Min nights</Label>
                <Input
                  id={`s2-mn-${p.id}`}
                  name="minNights"
                  type="number"
                  min="1"
                  defaultValue={String(p.minNights ?? 1)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </fieldset>

          {/* Step 3 — Capacity */}
          <fieldset hidden={step !== 3} className={step !== 3 ? "hidden" : ""}>
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">Capacity</h3>
              <p className="text-xs text-muted-foreground">
                Define guest limits. Leave a field empty for no limit.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`s3-mg-${p.id}`}>Max guests</Label>
                <Input
                  id={`s3-mg-${p.id}`}
                  name="maxGuests"
                  type="number"
                  min="0"
                  defaultValue={p.maxGuests ?? ""}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s3-ma-${p.id}`}>Max adults</Label>
                <Input
                  id={`s3-ma-${p.id}`}
                  name="maxAdults"
                  type="number"
                  min="0"
                  defaultValue={p.maxAdults ?? ""}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s3-mc-${p.id}`}>Max children</Label>
                <Input
                  id={`s3-mc-${p.id}`}
                  name="maxChildren"
                  type="number"
                  min="0"
                  defaultValue={p.maxChildren ?? ""}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s3-mi-${p.id}`}>Max infants</Label>
                <Input
                  id={`s3-mi-${p.id}`}
                  name="maxInfants"
                  type="number"
                  min="0"
                  defaultValue={p.maxInfants ?? ""}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`s3-mp-${p.id}`}>Max pets</Label>
                <Input
                  id={`s3-mp-${p.id}`}
                  name="maxPets"
                  type="number"
                  min="0"
                  defaultValue={String(p.maxPets ?? 0)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id={`s3-pa-${p.id}`}
                  name="petsAllowed"
                  type="checkbox"
                  value="true"
                  defaultChecked={p.petsAllowed ?? false}
                  className="size-4 rounded border-input accent-primary"
                />
                <Label htmlFor={`s3-pa-${p.id}`} className="mb-0">
                  Pets allowed
                </Label>
              </div>
            </div>
          </fieldset>

          {/* Step 4 — Rules */}
          <fieldset hidden={step !== 4} className={step !== 4 ? "hidden" : ""}>
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">Rules</h3>
              <p className="text-xs text-muted-foreground">
                Booking rules that govern availability and cancellation policy.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`s4-bd-${p.id}`}>
                  Buffer days after checkout
                </Label>
                <Input
                  id={`s4-bd-${p.id}`}
                  name="bufferDaysAfterCheckout"
                  type="number"
                  min="0"
                  defaultValue={String(p.bufferDaysAfterCheckout ?? 0)}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Days blocked after each booking for cleaning or maintenance.
                </p>
              </div>
              <div>
                <Label htmlFor={`s4-cd-${p.id}`}>
                  Cancellation deadline (days)
                </Label>
                <Input
                  id={`s4-cd-${p.id}`}
                  name="cancellationDeadlineDays"
                  type="number"
                  min="0"
                  defaultValue={p.cancellationDeadlineDays ?? ""}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  How many days before check-in guests can cancel free of charge.
                </p>
              </div>
            </div>
          </fieldset>

          {/* Save / cancel — shown for steps 1–4 */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            <button
              type="reset"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Step 5 — Images (outside main form) */}
      {step === 5 && (
        <ImagesStep
          property={p}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ hasProperties }: { hasProperties: boolean }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center">
      <Building2 className="size-10 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {hasProperties
            ? "Select a property to edit"
            : "No properties yet"}
        </p>
        {!hasProperties && (
          <p className="mt-1 text-xs text-muted-foreground">
            Use the + button in the left rail to add your first property.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PropertiesSection({
  properties,
}: {
  properties: AdminProperty[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    properties[0]?.id ?? null
  );
  const [showWizard, setShowWizard] = useState(false);

  const selectedProperty = properties.find((p) => p.id === selectedId) ?? null;

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createProperty(formData);
      setShowWizard(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteProperty(id);
      setSelectedId(
        properties.find((p) => p.id !== id)?.id ?? null
      );
    });
  }

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
      <AddPropertyWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSubmit={handleCreate}
        isPending={isPending}
      />

      {/* Left rail */}
      <PropertyRail
        properties={properties}
        selectedId={selectedId}
        onSelect={handleSelect}
        onAddClick={() => setShowWizard(true)}
      />

      {/* Right panel */}
      <div className="rounded-lg border bg-card p-6">
        {selectedProperty ? (
          <PropertyPanel
            key={selectedProperty.id}
            property={selectedProperty}
            isPending={isPending}
            startTransition={startTransition}
            onDelete={handleDelete}
          />
        ) : (
          <EmptyState hasProperties={properties.length > 0} />
        )}
      </div>
    </div>
  );
}
