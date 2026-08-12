"use client";

import { useId, useRef, useState } from "react";
import { ImageIcon, UploadCloud } from "lucide-react";
import { uploadWebsiteImage } from "@/modules/website/media-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Reusable controlled image field for the admin Website editor. It is a superset
 * of a plain URL <Input>: an admin can paste/edit a URL manually OR upload an
 * image file. On a successful upload the returned permanent public url is pushed
 * back through onChange, so the field stays a simple string value that slots
 * straight into a section's draftContent.
 *
 * The actual upload (tenant scoping, validation, PUBLIC bucket, Media record) is
 * handled server-side by uploadWebsiteImage — this component only orchestrates
 * the form, preview and inline error state.
 *
 * Drop-in replacement for an image-URL Input in a field editor:
 *   <ImageUpload value={str(content.image)} onChange={(url) => set({ image: url })} />
 */

export type ImageUploadProps = {
  /** Current image URL (controlled). */
  value: string;
  /** Called with the new URL on manual edit or a successful upload. */
  onChange: (url: string) => void;
  label?: string;
  id?: string;
  className?: string;
};

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  id,
  className,
}: ImageUploadProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadWebsiteImage(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onChange(result.url);
      // Clear the picked file so the same one can be re-selected if needed.
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={fieldId}>{label}</Label>

      {/* Preview. URLs are arbitrary (external or Supabase public), so a plain
          <img> is used deliberately instead of next/image. */}
      <div className="flex min-w-0 items-start gap-3 overflow-hidden">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40 text-muted-foreground">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-6" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Manual URL entry stays available — this is a superset of the old
              URL field. */}
          <Input
            id={fieldId}
            type="text"
            inputMode="url"
            placeholder="https://… or upload below"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                setError(null);
                setFile(e.target.files?.[0] ?? null);
              }}
              className="w-full max-w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-sm file:font-medium hover:file:bg-muted sm:max-w-[220px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!file || uploading}
              onClick={handleUpload}
            >
              <UploadCloud className="size-3.5" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
