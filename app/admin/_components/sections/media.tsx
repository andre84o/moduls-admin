"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaUpload } from "@/components/MediaUpload";
import { MediaLibrary } from "@/components/MediaLibrary";
import type { MediaItem } from "@/lib/media";

/**
 * Central media library section. Uploads images (compressed) and documents
 * into the shared, business-scoped library and browses everything in one grid.
 * The <MediaUpload /> and <MediaLibrary /> components are reusable and can be
 * dropped into any other feature with an attach target.
 */
export function MediaSection({ media }: { media: MediaItem[] }) {
  const images = media.filter((m) => m.kind === "IMAGE");
  const documents = media.filter((m) => m.kind === "DOCUMENT");

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Media library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload images and documents once, reuse them anywhere. Images are
          compressed automatically.
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaUpload folder="library" label="Drop files or click to upload" />
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Images ({images.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaLibrary items={images} emptyText="No images uploaded yet." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaLibrary items={documents} emptyText="No documents uploaded yet." />
        </CardContent>
      </Card>
    </div>
  );
}
