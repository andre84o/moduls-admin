"use client";

import { useState, useTransition, useEffect } from "react";
import { Save, RefreshCw, Trash2, Star, AlertTriangle, Plus, X, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { saveManualReviews } from "@/modules/website/google-reviews/actions";
import type { ManualReview } from "@/modules/website/google-reviews/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const SELECT_CLASS =
  "mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const MIN_RATING_OPTIONS = ["any", "1", "2", "3", "4", "5"] as const;

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toISOString().replace("T", " ").slice(0, 16);
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
  const [needsSync, setNeedsSync] = useState(false);

  const original = {
    enabled: settings.enabled,
    placeId: settings.placeId ?? "",
    minRating: settings.minRating != null ? String(settings.minRating) : "any",
    maxCount: String(settings.maxCount),
  };
  const isDirty =
    enabled !== original.enabled ||
    placeId !== original.placeId ||
    minRating !== original.minRating ||
    maxCount !== original.maxCount;

  const [isPending, startTransition] = useTransition();
  const [manualReviews, setManualReviews] = useState<ManualReview[]>(settings.manualReviews ?? []);
  const [newReview, setNewReview] = useState<ManualReview>({ author: "", rating: 5, text: "", relativeTime: "" });
  const [manualOpen, setManualOpen] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);

  useEffect(() => {
    if (!addedFlash) return;
    const t = setTimeout(() => setAddedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [addedFlash]);

  function resetMessages() { setError(null); setNotice(null); }

  function handleSave() {
    resetMessages();
    const parsedCount = Number.parseInt(maxCount, 10);
    startTransition(async () => {
      const res = await saveGoogleReviewSettings({
        enabled,
        placeId: placeId.trim() || null,
        minRating: minRating === "any" ? null : Number.parseInt(minRating, 10),
        maxCount: Number.isNaN(parsedCount) ? null : parsedCount,
      });
      if (res?.error) setError(res.error);
      else { setNotice("Settings saved."); setNeedsSync(true); }
    });
  }

  function handleSync() {
    resetMessages();
    startTransition(async () => {
      const res = await syncGoogleReviews();
      if (res?.error) { setError(res.error); return; }
      setNeedsSync(false);
      setNotice(`Synced ${res.count ?? 0} review${res.count === 1 ? "" : "s"} from Google.`);
    });
  }

  function handleClear() {
    resetMessages();
    startTransition(async () => {
      const res = await clearGoogleReviewCache();
      if (res?.error) setError(res.error);
      else setNotice("Cache cleared.");
    });
  }

  function handleAddManual() {
    if (!newReview.author.trim() || !newReview.text.trim()) return;
    const updated = [...manualReviews, { ...newReview }];
    setManualReviews(updated);
    setNewReview({ author: "", rating: 5, text: "", relativeTime: "" });
    setAddedFlash(true);
    startTransition(async () => {
      await saveManualReviews(updated);
    });
  }

  const cachedCount = cache.reviews.length;
  const isConnected = enabled && !!placeId.trim();

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Google Reviews</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage how customer reviews appear on your website.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            <Star className="size-4" />
            Add reviews
            {manualReviews.length > 0 ? (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {manualReviews.length}
              </span>
            ) : null}
          </Button>
          {cache.rating != null ? (
            <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
              <span className="text-amber-400 text-lg leading-none">★</span>
              <span className="text-xl font-bold tabular-nums">{cache.rating.toFixed(1)}</span>
              <div className="text-xs text-muted-foreground leading-tight">
                <div>Google rating</div>
                {cache.userRatingCount != null ? <div>{cache.userRatingCount} reviews</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* API key warning */}
      {!configured ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Sync disabled — </span>
            <code className="font-mono text-xs">GOOGLE_PLACES_API_KEY</code> is not set on the server.
            You can still save settings and add manual reviews.
          </p>
        </div>
      ) : null}

      {/* Error / notice */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice && !error ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/8 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Connection & settings */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Connection</CardTitle>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${isConnected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                {isConnected
                  ? <><Wifi className="size-3.5" /> Connected</>
                  : <><WifiOff className="size-3.5" /> Disabled</>}
              </span>
            </div>
            <CardDescription>Link your Google Business place to pull reviews.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <input
                id="gr-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4 rounded accent-primary"
              />
              <Label htmlFor="gr-enabled" className="mb-0 cursor-pointer font-normal">
                Show reviews on the public website
              </Label>
            </div>

            <div>
              <Label htmlFor="gr-place-id">Google Place ID</Label>
              <Input
                id="gr-place-id"
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                placeholder="ChIJ…"
                className="mt-1.5 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Find it at <span className="font-mono">maps.google.com</span> → share → place ID.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gr-min-rating">Min rating</Label>
                <select id="gr-min-rating" value={minRating} onChange={(e) => setMinRating(e.target.value)} className={SELECT_CLASS}>
                  {MIN_RATING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt === "any" ? "Any" : `${opt}+ ★`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="gr-max-count">Max shown</Label>
                <Input id="gr-max-count" type="number" min={1} value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                {isDirty && !isPending ? (
                  <span className="absolute -right-1 -top-1 flex size-3 z-10">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                  </span>
                ) : null}
                <Button disabled={isPending} onClick={handleSave} className="w-full">
                  <Save className="size-4" />
                  {isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
              <div className="relative flex-1">
                {needsSync && !isPending ? (
                  <span className="absolute -right-1 -top-1 flex size-3 z-10">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                  </span>
                ) : null}
                <Button
                  variant={needsSync ? "default" : "outline"}
                  disabled={isPending || !configured}
                  onClick={handleSync}
                  className="w-full"
                  title={configured ? undefined : "Set GOOGLE_PLACES_API_KEY to enable syncing."}
                >
                  <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
                  Sync now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync status */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sync status</CardTitle>
            <CardDescription>Reviews are fetched from Google and cached here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Cached reviews</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{cachedCount}</p>
              </div>
              <div className="rounded-lg border px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Manual reviews</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{manualReviews.length}</p>
              </div>
            </div>
            <div className="rounded-lg border px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Last synced — </span>
              <span className="font-medium tabular-nums">{formatTimestamp(settings.lastSyncedAt)}</span>
            </div>
            {settings.lastError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
                {settings.lastError}
              </div>
            ) : null}
            <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClear} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-3.5" />
              Clear cache
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* All reviews preview */}
      {(cachedCount > 0 || manualReviews.length > 0) ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All reviews</CardTitle>
            <CardDescription>{cachedCount} from Google · {manualReviews.length} manual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto pr-1 [scrollbar-width:thin]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cache.reviews.map((review, index) => (
                  <div key={`google-${review.author}-${review.time ?? index}`} className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{review.author || "Anonymous"}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="tabular-nums">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {review.rating}
                        </Badge>
                        <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">Google</span>
                      </div>
                    </div>
                    {review.text ? <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{review.text}</p> : null}
                    {review.relativeTime ? <p className="text-xs text-muted-foreground/60">{review.relativeTime}</p> : null}
                  </div>
                ))}
                {manualReviews.map((review, index) => (
                  <div key={`manual-${review.author}-${index}`} className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{review.author || "Anonymous"}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="tabular-nums">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {review.rating}
                        </Badge>
                        <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">Manual</span>
                      </div>
                    </div>
                    {review.text ? <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{review.text}</p> : null}
                    {review.relativeTime ? <p className="text-xs text-muted-foreground/60">{review.relativeTime}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Manual reviews modal */}
      {manualOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setManualOpen(false); }}
        >
          <div className="flex w-full max-w-xl flex-col rounded-2xl border bg-background shadow-xl max-h-[90vh]">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="font-semibold">Manual reviews</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Copy-paste reviews from Google.</p>
              </div>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add review</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="mr-author">Author name</Label>
                    <Input
                      id="mr-author"
                      value={newReview.author}
                      onChange={(e) => setNewReview((p) => ({ ...p, author: e.target.value }))}
                      placeholder="Anna Svensson"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mr-rating">Rating</Label>
                    <select
                      id="mr-rating"
                      value={newReview.rating}
                      onChange={(e) => setNewReview((p) => ({ ...p, rating: Number(e.target.value) }))}
                      className={SELECT_CLASS}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{"★".repeat(n)} {n} stars</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="mr-text">Review text</Label>
                    <textarea
                      id="mr-text"
                      value={newReview.text}
                      onChange={(e) => setNewReview((p) => ({ ...p, text: e.target.value }))}
                      placeholder="Paste the review text here…"
                      rows={3}
                      className="mt-1.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 resize-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="mr-time">Time <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="mr-time"
                      value={newReview.relativeTime}
                      onChange={(e) => setNewReview((p) => ({ ...p, relativeTime: e.target.value }))}
                      placeholder="2 months ago"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={handleAddManual} disabled={isPending || !newReview.author.trim() || !newReview.text.trim()}>
                    <Plus className="size-3.5" />
                    {isPending ? "Saving…" : "Add"}
                  </Button>
                  {addedFlash ? (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 animate-in fade-in duration-200">
                      <CheckCircle2 className="size-4" />
                      Added!
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
