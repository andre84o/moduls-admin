"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, ImagePlus } from "lucide-react";
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
import {
  createProperty,
  updateProperty,
  deleteProperty,
  setPropertyStatus,
  uploadPropertyImage,
  deleteMedia,
} from "@/lib/actions";
import type { AdminProperty, PropertyStatus } from "../../types";

const statusVariant: Record<
  PropertyStatus,
  "default" | "secondary" | "outline"
> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

// Currencies offered in the admin. Stored lowercase to match the schema default.
const CURRENCIES = ["sek", "eur", "usd", "gbp", "nok", "dkk"] as const;

// Money is stored in minor units (öre/cents) — show major units in the inputs.
function toMajor(minor: number | null | undefined): string {
  return minor == null ? "" : String(minor / 100);
}

/**
 * Booking settings fields, shared by the create and edit property forms. Money
 * inputs are in major units; the server converts them back to minor units and
 * is the source of truth for all validation. When `property` is provided the
 * fields are pre-filled for editing.
 */
function BookingSettingsFields({ property }: { property?: AdminProperty }) {
  const p = property;
  return (
    <>
      <div className="sm:col-span-2">
        <h3 className="text-sm font-medium">Booking settings</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used by the public booking flow. Leave a limit empty for no limit.
        </p>
      </div>

      <div>
        <Label htmlFor="pricePerNight">Price per night</Label>
        <Input
          id="pricePerNight"
          name="pricePerNight"
          type="number"
          min="0"
          step="0.01"
          defaultValue={toMajor(p?.pricePerNight)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="cleaningFee">Cleaning fee</Label>
        <Input
          id="cleaningFee"
          name="cleaningFee"
          type="number"
          min="0"
          step="0.01"
          defaultValue={toMajor(p?.cleaningFee)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Only shown in the booking price summary, never on public listings.
        </p>
      </div>

      <div>
        <Label htmlFor="currency">Currency</Label>
        <select
          id="currency"
          name="currency"
          defaultValue={p?.currency ?? "sek"}
          className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="minNights">Minimum nights</Label>
        <Input
          id="minNights"
          name="minNights"
          type="number"
          min="1"
          defaultValue={p ? String(p.minNights) : "1"}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="maxGuests">Max guests</Label>
        <Input
          id="maxGuests"
          name="maxGuests"
          type="number"
          min="0"
          defaultValue={p?.maxGuests ?? ""}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="maxAdults">Max adults</Label>
        <Input
          id="maxAdults"
          name="maxAdults"
          type="number"
          min="0"
          defaultValue={p?.maxAdults ?? ""}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="maxChildren">Max children</Label>
        <Input
          id="maxChildren"
          name="maxChildren"
          type="number"
          min="0"
          defaultValue={p?.maxChildren ?? ""}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="maxInfants">Max infants</Label>
        <Input
          id="maxInfants"
          name="maxInfants"
          type="number"
          min="0"
          defaultValue={p?.maxInfants ?? ""}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="maxPets">Max pets</Label>
        <Input
          id="maxPets"
          name="maxPets"
          type="number"
          min="0"
          defaultValue={p ? String(p.maxPets ?? 0) : "0"}
          className="mt-1.5"
        />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <input
          id="petsAllowed"
          name="petsAllowed"
          type="checkbox"
          value="true"
          defaultChecked={p?.petsAllowed ?? false}
          className="size-4 rounded border-input accent-primary"
        />
        <Label htmlFor="petsAllowed" className="mb-0">
          Pets allowed
        </Label>
      </div>

      <div>
        <Label htmlFor="bufferDaysAfterCheckout">Buffer days after checkout</Label>
        <Input
          id="bufferDaysAfterCheckout"
          name="bufferDaysAfterCheckout"
          type="number"
          min="0"
          defaultValue={p ? String(p.bufferDaysAfterCheckout) : "0"}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="cancellationDeadlineDays">
          Cancellation deadline (days)
        </Label>
        <Input
          id="cancellationDeadlineDays"
          name="cancellationDeadlineDays"
          type="number"
          min="0"
          defaultValue={p?.cancellationDeadlineDays ?? ""}
          className="mt-1.5"
        />
      </div>
    </>
  );
}

export function PropertiesSection({
  properties,
}: {
  properties: AdminProperty[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    await createProperty(formData);
    formRef.current?.reset();
  }

  async function handleUpdate(formData: FormData) {
    await updateProperty(formData);
    setEditingId(null);
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage your properties and their images.
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>New property</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            action={handleCreate}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                required
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price / night</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  name="bedrooms"
                  type="number"
                  min="0"
                  className="mt-1.5"
                />
              </div>
            </div>

            <BookingSettingsFields />

            <div className="sm:col-span-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add property"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {properties.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No properties yet. Create your first one above.
          </p>
        ) : (
          properties.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {p.title}
                    <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.location}
                    {p.price ? ` · ${p.price}/night` : ""}
                    {p.bedrooms != null ? ` · ${p.bedrooms} bed` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      setEditingId(editingId === p.id ? null : p.id)
                    }
                  >
                    {editingId === p.id ? "Close" : "Edit"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(() =>
                        setPropertyStatus(
                          p.id,
                          p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                        ),
                      )
                    }
                  >
                    {p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteProperty(p.id))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {editingId === p.id ? (
                  <form
                    action={handleUpdate}
                    className="mb-6 grid gap-4 border-b pb-6 sm:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <div className="sm:col-span-2">
                      <Label htmlFor={`title-${p.id}`}>Title</Label>
                      <Input
                        id={`title-${p.id}`}
                        name="title"
                        required
                        defaultValue={p.title}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`location-${p.id}`}>Location</Label>
                      <Input
                        id={`location-${p.id}`}
                        name="location"
                        required
                        defaultValue={p.location}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`price-${p.id}`}>Price / night</Label>
                        <Input
                          id={`price-${p.id}`}
                          name="price"
                          type="number"
                          min="0"
                          defaultValue={p.price ?? ""}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`bedrooms-${p.id}`}>Bedrooms</Label>
                        <Input
                          id={`bedrooms-${p.id}`}
                          name="bedrooms"
                          type="number"
                          min="0"
                          defaultValue={p.bedrooms ?? ""}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <BookingSettingsFields property={p} />

                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving…" : "Save changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {p.images.map((img) => (
                    <div key={img.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.alt ?? p.title}
                        className="size-20 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(() => deleteMedia(img.id))
                        }
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove image"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}

                  <form
                    action={uploadPropertyImage}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="propertyId" value={p.id} />
                    <Label
                      htmlFor={`file-${p.id}`}
                      className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/40"
                    >
                      <ImagePlus className="size-5" />
                      Add
                    </Label>
                    <Input
                      id={`file-${p.id}`}
                      name="file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    />
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
