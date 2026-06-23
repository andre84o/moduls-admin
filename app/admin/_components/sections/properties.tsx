"use client";

import { useRef, useTransition } from "react";
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

export function PropertiesSection({
  properties,
}: {
  properties: AdminProperty[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate(formData: FormData) {
    await createProperty(formData);
    formRef.current?.reset();
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
