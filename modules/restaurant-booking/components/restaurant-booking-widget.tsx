"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, Clock3, Loader2, Minus, Plus, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AvailabilitySlot = {
  startAt: string;
  endAt: string;
  available: boolean;
};

export type RestaurantBookingAvailability = {
  date: string;
  timezone: string;
  partySize: number;
  slots: AvailabilitySlot[];
};

export type RestaurantBookingSubmitInput = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  startAt: string;
  notes: string;
};

export type RestaurantBookingSubmitResult = {
  status: "PENDING" | "CONFIRMED";
  bookingId?: string;
};

type Step = "search" | "details" | "done";

type Props = {
  title?: string;
  subtitle?: string;
  maxPartySize?: number;
  loadAvailability: (input: { date: string; partySize: number }) => Promise<RestaurantBookingAvailability>;
  submitBooking: (input: RestaurantBookingSubmitInput) => Promise<RestaurantBookingSubmitResult>;
};

function formatTime(value: string, timezone?: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

function formatDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function RestaurantBookingWidget({
  title = "Reserve a table",
  subtitle = "Choose your party size, date and an available time.",
  maxPartySize = 12,
  loadAvailability,
  submitBooking,
}: Props) {
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [availability, setAvailability] = useState<RestaurantBookingAvailability | null>(null);
  const [selectedStartAt, setSelectedStartAt] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("search");
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RestaurantBookingSubmitResult | null>(null);

  const summaryDate = useMemo(() => formatDate(date), [date]);
  const selectedTime = useMemo(
    () => selectedStartAt ? formatTime(selectedStartAt, availability?.timezone) : null,
    [selectedStartAt, availability?.timezone],
  );

  async function refreshAvailability(
    nextDate = date,
    nextPartySize = partySize,
    options: { preserveError?: boolean } = {},
  ) {
    if (!nextDate) return;
    setLoadingAvailability(true);
    if (!options.preserveError) setError(null);
    setSelectedStartAt(null);
    try {
      const next = await loadAvailability({ date: nextDate, partySize: nextPartySize });
      setAvailability(next);
    } catch {
      setAvailability(null);
      setError("We couldn't load available times. Please try again.");
    } finally {
      setLoadingAvailability(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    if (!selectedStartAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitBooking({
        guestName: String(formData.get("guestName") ?? "").trim(),
        guestEmail: String(formData.get("guestEmail") ?? "").trim(),
        guestPhone: String(formData.get("guestPhone") ?? "").trim(),
        notes: String(formData.get("notes") ?? "").trim(),
        partySize,
        startAt: selectedStartAt,
      });
      setResult(response);
      setStep("done");
    } catch {
      setError("That time is no longer available. Please choose another time.");
      setStep("search");
      await refreshAvailability(date, partySize, { preserveError: true });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("search");
    setResult(null);
    setSelectedStartAt(null);
    setError(null);
    if (date) void refreshAvailability();
  }

  if (step === "done" && result) {
    return (
      <Card className="mx-auto w-full max-w-xl overflow-hidden border-0 shadow-xl ring-1 ring-black/5">
        <CardContent className="px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            {result.status === "CONFIRMED" ? "Your table is booked" : "Booking request received"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {result.status === "CONFIRMED"
              ? "Your reservation is confirmed. We look forward to seeing you."
              : "The restaurant has received your request and will confirm it shortly."}
          </p>
          <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-3 rounded-xl bg-muted/60 p-4 text-left">
            <div><p className="text-xs text-muted-foreground">Guests</p><p className="mt-1 font-medium">{partySize}</p></div>
            <div><p className="text-xs text-muted-foreground">Date</p><p className="mt-1 font-medium">{summaryDate}</p></div>
            <div><p className="text-xs text-muted-foreground">Time</p><p className="mt-1 font-medium">{selectedTime}</p></div>
          </div>
          <Button type="button" variant="outline" className="mt-7" onClick={reset}>
            Make another booking
          </Button>
        </CardContent>
      </Card>
    );
  }

  const slots = availability?.slots.filter((slot) => slot.available) ?? [];

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-0 shadow-xl ring-1 ring-black/5">
      <CardContent className="p-0">
        <div className="border-b bg-background px-5 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {step === "details" && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setStep("search"); setError(null); }}>
                <ChevronLeft /> Back
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-8">
            {error}
          </div>
        )}

        {step === "search" ? (
          <div className="space-y-7 px-5 py-6 sm:px-8 sm:py-7">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Guests</h3>
              </div>
              <div className="inline-flex items-center gap-3 rounded-xl border bg-background p-1.5">
                <Button type="button" variant="ghost" size="icon" aria-label="Remove guest" disabled={partySize <= 1 || loadingAvailability} onClick={() => {
                  const next = Math.max(1, partySize - 1);
                  setPartySize(next);
                  if (date) void refreshAvailability(date, next);
                }}><Minus /></Button>
                <div className="min-w-20 text-center">
                  <p className="text-lg font-semibold">{partySize}</p>
                  <p className="text-xs text-muted-foreground">{partySize === 1 ? "guest" : "guests"}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Add guest" disabled={partySize >= maxPartySize || loadingAvailability} onClick={() => {
                  const next = Math.min(maxPartySize, partySize + 1);
                  setPartySize(next);
                  if (date) void refreshAvailability(date, next);
                }}><Plus /></Button>
              </div>
            </section>

            <section>
              <Label htmlFor="restaurant-booking-date">Date</Label>
              <Input id="restaurant-booking-date" type="date" value={date} onChange={(event) => {
                const next = event.target.value;
                setDate(next);
                setAvailability(null);
                setSelectedStartAt(null);
                if (next) void refreshAvailability(next, partySize);
              }} className="mt-2 w-full sm:max-w-xs" />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Available times</h3>
                </div>
                {date && availability && !loadingAvailability && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void refreshAvailability()}>
                    <RefreshCw /> Refresh
                  </Button>
                )}
              </div>

              {!date ? (
                <div className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                  Choose a date to see available times.
                </div>
              ) : loadingAvailability ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Checking availability…
                </div>
              ) : availability && slots.length === 0 ? (
                <div className="rounded-xl border border-dashed px-5 py-8 text-center">
                  <p className="text-sm font-medium">No tables available</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try another date or party size.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {slots.map((slot) => (
                    <Button key={slot.startAt} type="button" variant={selectedStartAt === slot.startAt ? "default" : "outline"} className="h-11" onClick={() => setSelectedStartAt(slot.startAt)}>
                      {formatTime(slot.startAt, availability?.timezone)}
                    </Button>
                  ))}
                </div>
              )}
            </section>

            <Button type="button" size="lg" className="w-full sm:w-auto" disabled={!selectedStartAt || loadingAvailability} onClick={() => { setStep("details"); setError(null); }}>
              Continue
            </Button>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-6 px-5 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="restaurant-booking-name">Name</Label><Input id="restaurant-booking-name" name="guestName" required autoComplete="name" className="mt-2" /></div>
              <div><Label htmlFor="restaurant-booking-phone">Phone</Label><Input id="restaurant-booking-phone" name="guestPhone" required autoComplete="tel" className="mt-2" /></div>
              <div><Label htmlFor="restaurant-booking-email">Email</Label><Input id="restaurant-booking-email" name="guestEmail" type="email" required autoComplete="email" className="mt-2" /></div>
              <div><Label htmlFor="restaurant-booking-notes">Special request</Label><Input id="restaurant-booking-notes" name="notes" placeholder="Optional" className="mt-2" /></div>
            </div>

            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm font-medium">Your reservation</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Guests</p><p className="mt-1">{partySize}</p></div>
                <div><p className="text-xs text-muted-foreground">Date</p><p className="mt-1">{summaryDate}</p></div>
                <div><p className="text-xs text-muted-foreground">Time</p><p className="mt-1">{selectedTime}</p></div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="animate-spin" /> Booking…</> : "Book table"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
