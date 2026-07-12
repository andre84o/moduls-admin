"use client";

import { useState, useTransition } from "react";
import { Save, RefreshCw, Trash2, Star, AlertTriangle } from "lucide-react";
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
  saveGoogleReviewSettings,
  syncGoogleReviews,
  clearGoogleReviewCache,
} from "@/modules/website/google-reviews/actions";
import type {
  AdminGoogleReviewSettings,
  AdminCachedGoogleReviews,
} from "@/modules/website/google-reviews/queries";

/**
 * Website admin panel for the Google Reviews integration.
 *
 * A CONTROLLED settings panel — not a page builder. It edits the per-business
 * Google Reviews settings and triggers cache sync/clear through the existing
 * modules/website/google-reviews server actions, which resolve businessId
 * server-side and enforce the WEBSITE module guard. This component NEVER sends a
 * businessId, never touches the Google API directly, and never handles the
 * GOOGLE_PLACES_API_KEY — it only reflects whether the key is configured
 * (`configured`) so it can disable Sync with a clear explanation.
 *
 * All displayed status (last synced, last error, cached reviews) comes from the
 * server props, so it refreshes after each action revalidates /admin.
 */

// Native <select> styling matched to the Website section's controls.
const SELECT_CLASS =
  "mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const MIN_RATING_OPTIONS = ["any", "1", "2", "3", "4", "5"] as const;

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "Never" : parsed.toLocaleString();
}

export function GoogleReviewsSettings({
  settings,
  cache,
  configured,
}: {
  settings: AdminGoogleReviewSettings;
  cache: AdminCachedGoogleReviews;
  configured: boolean;
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [placeId, setPlaceId] = useState(settings.placeId ?? "");
  const [minRating, setMinRating] = useState<string>(
    settings.minRating != null ? String(settings.minRating) : "any",
  );
  const [maxCount, setMaxCount] = useState<string>(String(settings.maxCount));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  function handleSave() {
    resetMessages();
    const parsedCount = Number.parseInt(maxCount, 10);
    startTransition(async () => {
      const res = await saveGoogleReviewSettings({
        enabled,
        placeId: placeId.trim() ? placeId.trim() : null,
        minRating: minRating === "any" ? null : Number.parseInt(minRating, 10),
        maxCount: Number.isNaN(parsedCount) ? null : parsedCount,
      });
      if (res?.error) setError(res.error);
      else setNotice("Settings saved.");
    });
  }

  function handleSync() {
    resetMessages();
    startTransition(async () => {
      const res = await syncGoogleReviews();
      if (res?.error) {
        setError(res.error);
        return;
      }
      const count = res.count ?? 0;
      setNotice(`Synced ${count} review${count === 1 ? "" : "s"} from Google.`);
    });
  }

  function handleClear() {
    resetMessages();
    startTransition(async () => {
      const res = await clearGoogleReviewCache();
      if (res?.error) setError(res.error);
      else setNotice("Cached reviews cleared.");
    });
  }

  const cachedCount = cache.reviews.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Reviews</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a Google Place ID and sync cached reviews for the public
          website.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Server-side config gate. The API key itself is never shown. */}
        {!configured ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              Syncing is disabled because{" "}
              <code className="font-mono text-foreground">
                GOOGLE_PLACES_API_KEY
              </code>{" "}
              is not set on the server. You can still save settings — set the key
              server-side to enable syncing.
            </p>
          </div>
        ) : null}

        {/* Settings form */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 pt-6 sm:col-span-2">
            <input
              id="gr-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <Label htmlFor="gr-enabled" className="mb-0">
              Enable Google reviews on the public website
            </Label>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="gr-place-id">Google Place ID</Label>
            <Input
              id="gr-place-id"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJ…"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="gr-min-rating">Minimum rating</Label>
            <select
              id="gr-min-rating"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className={SELECT_CLASS}
            >
              {MIN_RATING_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "any" ? "Any" : `${opt}+ stars`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="gr-max-count">Max reviews to show</Label>
            <Input
              id="gr-max-count"
              type="number"
              min={1}
              value={maxCount}
              onChange={(e) => setMaxCount(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Sync status */}
        <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Last synced</span>
            <p className="font-medium">{formatTimestamp(settings.lastSyncedAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Cached reviews</span>
            <p className="font-medium tabular-nums">
              {cachedCount}
              {cache.rating != null ? (
                <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {cache.rating.toFixed(1)}
                  {cache.userRatingCount != null
                    ? ` (${cache.userRatingCount})`
                    : ""}
                </span>
              ) : null}
            </p>
          </div>
          {settings.lastError ? (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Last error</span>
              <p className="font-medium text-destructive">{settings.lastError}</p>
            </div>
          ) : null}
        </div>

        {/* Cached reviews preview */}
        {cachedCount > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Cached preview
            </p>
            <div className="space-y-2">
              {cache.reviews.slice(0, 3).map((review, index) => (
                <div
                  key={`${review.author}-${review.time ?? index}`}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">
                      {review.author || "Anonymous"}
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {review.rating}
                    </Badge>
                    {review.relativeTime ? (
                      <span className="text-xs text-muted-foreground">
                        {review.relativeTime}
                      </span>
                    ) : null}
                  </div>
                  {review.text ? (
                    <p className="line-clamp-2 text-muted-foreground">
                      {review.text}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Messages */}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? (
          <p className="text-sm text-muted-foreground">{notice}</p>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button disabled={isPending} onClick={handleSave}>
            <Save className="size-4" />
            {isPending ? "Working…" : "Save settings"}
          </Button>
          <Button
            variant="outline"
            disabled={isPending || !configured}
            onClick={handleSync}
            title={
              configured
                ? undefined
                : "Set GOOGLE_PLACES_API_KEY on the server to enable syncing."
            }
          >
            <RefreshCw className="size-4" />
            Sync reviews now
          </Button>
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={handleClear}
          >
            <Trash2 className="size-4 text-destructive" />
            Clear cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
