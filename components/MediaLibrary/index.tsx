"use client";

import { useTransition } from "react";
import { FileText, Download, Trash2 } from "lucide-react";
import { deleteMediaItem } from "@/lib/media-actions";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import type { MediaItem } from "@/lib/media";

/**
 * Reusable grid for browsing media from the central library. Renders images as
 * thumbnails and documents as file cards with a download link. Pass the items
 * from a server query (e.g. listMedia / getMediaFor) — deletion is scoped to
 * the current business server-side.
 */

export type MediaLibraryProps = {
  items: MediaItem[];
  /** Path to revalidate after a delete. Defaults to "/admin". */
  revalidate?: string;
  /** Hide delete buttons when the viewer may not remove files. */
  canDelete?: boolean;
  emptyText?: string;
  className?: string;
};

export function MediaLibrary({
  items,
  revalidate = "/admin",
  canDelete = true,
  emptyText = "No files yet.",
  className,
}: MediaLibraryProps) {
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => (
        <MediaCard
          key={item.id}
          item={item}
          canDelete={canDelete}
          disabled={isPending}
          onDelete={() =>
            startTransition(() => deleteMediaItem(item.id, revalidate))
          }
        />
      ))}
    </div>
  );
}

function MediaCard({
  item,
  canDelete,
  disabled,
  onDelete,
}: {
  item: MediaItem;
  canDelete: boolean;
  disabled: boolean;
  onDelete: () => void;
}) {
  const title = item.name ?? item.alt ?? "File";
  const href = item.url ?? undefined;

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title={title}
      >
        <div className="flex aspect-square items-center justify-center bg-muted/40">
          {item.kind === "IMAGE" && item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.alt ?? title}
              className="size-full object-cover"
            />
          ) : (
            <FileText className="size-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{title}</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {item.kind === "DOCUMENT" ? "Document" : "Image"}
              {" · "}
              {formatBytes(item.size)}
            </p>
          </div>
          {item.kind === "DOCUMENT" ? (
            <Download className="size-3.5 shrink-0 text-muted-foreground" />
          ) : null}
        </div>
      </a>

      {canDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="icon-xs"
          aria-label={`Delete ${title}`}
          disabled={disabled}
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}
