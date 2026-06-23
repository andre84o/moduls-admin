"use client";

import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud } from "lucide-react";
import { uploadMedia } from "@/lib/media-actions";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Reusable upload widget for the central media library. Drop it anywhere and
 * point it at an attach target — images are compressed server-side, documents
 * are stored as-is, and every file is scoped to the current business.
 *
 * Examples:
 *   <MediaUpload folder="logos" ownerType="Business" ownerId={businessId} />
 *   <MediaUpload propertyId={p.id} accept="image/*" />
 *   <MediaUpload ownerType="Customer" ownerId={c.id} revalidate="/admin/customers" />
 */

const DEFAULT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

export type MediaUploadProps = {
  /** Generic attach target — links the media to any entity. */
  ownerType?: string;
  ownerId?: string;
  /** Typed Property attachment (kept for the properties feature). */
  propertyId?: string;
  /** Logical group, e.g. "logos", "contracts". Defaults to "general". */
  folder?: string;
  /** HTML accept filter. Defaults to images + common document types. */
  accept?: string;
  /** Allow selecting several files at once. */
  multiple?: boolean;
  /** Path to revalidate after upload. Defaults to "/admin". */
  revalidate?: string;
  label?: string;
  className?: string;
};

export function MediaUpload({
  ownerType,
  ownerId,
  propertyId,
  folder = "general",
  accept = DEFAULT_ACCEPT,
  multiple = true,
  revalidate = "/admin",
  label = "Upload files",
  className,
}: MediaUploadProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = useId();

  return (
    <form ref={formRef} action={uploadMedia} className={className}>
      {ownerType ? <input type="hidden" name="ownerType" value={ownerType} /> : null}
      {ownerId ? <input type="hidden" name="ownerId" value={ownerId} /> : null}
      {propertyId ? <input type="hidden" name="propertyId" value={propertyId} /> : null}
      <input type="hidden" name="folder" value={folder} />
      <input type="hidden" name="revalidate" value={revalidate} />

      <Dropzone
        inputId={inputId}
        accept={accept}
        multiple={multiple}
        label={label}
      />
    </form>
  );
}

function Dropzone({
  inputId,
  accept,
  multiple,
  label,
}: {
  inputId: string;
  accept: string;
  multiple: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear the field once an upload settles so the same file can be re-picked.
  useEffect(() => {
    if (!pending && inputRef.current) inputRef.current.value = "";
  }, [pending]);

  return (
    <Label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground transition hover:bg-muted/40",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <UploadCloud className="size-6" />
      <span className="font-medium text-foreground">
        {pending ? "Uploading…" : label}
      </span>
      <span className="text-xs">
        Images are compressed automatically. Documents are stored as-is.
      </span>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        name="files"
        accept={accept}
        multiple={multiple}
        disabled={pending}
        className="hidden"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </Label>
  );
}
