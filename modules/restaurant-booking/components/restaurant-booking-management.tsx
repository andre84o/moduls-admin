"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  cancelRestaurantBookingByToken,
  getRestaurantBookingManagementAvailability,
  rescheduleRestaurantBookingByToken,
} from "@/modules/restaurant-booking/management-actions";

type ManagedBooking = {
  businessName: string;
  guestName: string;
  partySize: number;
  startAt: string;
  endAt: string;
  status: string;
  timezone: string;
  canManage: boolean;
};

type Slot = {
  startAt: string;
  endAt: string;
  available: boolean;
};

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateKey(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function statusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}

export function RestaurantBookingManagement({
  token,
  initialBooking,
}: {
  token: string;
  initialBooking: ManagedBooking;
}) {
  const [booking, setBooking] = useState(initialBooking);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(initialBooking.startAt, initialBooking.timezone));
  const [selectedStartAt, setSelectedStartAt] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableSlots = useMemo(
    () => slots?.filter((slot) => slot.available) ?? [],
    [slots],
  );

  function checkAvailability() {
    if (!selectedDate) return;
    setSelectedStartAt(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await getRestaurantBookingManagementAvailability({
        token,
        date: selectedDate,
      });
      if (!result.ok) {
        setSlots(null);
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      setSlots(result.availability.slots);
      if (!result.availability.slots.some((slot) => slot.available)) {
        setFeedback({ kind: "error", text: "No available times for that date." });
      }
    });
  }

  function reschedule() {
    if (!selectedStartAt) return;
    const selectedLabel = formatDateTime(selectedStartAt, booking.timezone);
    if (!window.confirm(`Reschedule your booking to ${selectedLabel}?`)) return;

    setFeedback(null);
    startTransition(async () => {
      const result = await rescheduleRestaurantBookingByToken({ token, startAt: selectedStartAt });
      if (!result.ok) {
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      setBooking((current) => ({
        ...current,
        startAt: result.startAt,
        endAt: result.endAt,
      }));
      setSelectedDate(dateKey(result.startAt, booking.timezone));
      setSelectedStartAt(null);
      setSlots(null);
      setFeedback({ kind: "success", text: "Your booking has been rescheduled." });
    });
  }

  function cancelBooking() {
    if (!window.confirm("Cancel this booking?")) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await cancelRestaurantBookingByToken(token);
      if (!result.ok) {
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      setBooking((current) => ({ ...current, status: result.status, canManage: false }));
      setSelectedStartAt(null);
      setSlots(null);
      setFeedback({ kind: "success", text: "Your booking has been cancelled." });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage booking</CardTitle>
        <p className="text-sm text-muted-foreground">{booking.businessName}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{booking.guestName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium">{statusLabel(booking.status)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date & time</p>
            <p className="font-medium">{formatDateTime(booking.startAt, booking.timezone)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Guests</p>
            <p className="font-medium">{booking.partySize}</p>
          </div>
        </div>

        {feedback && (
          <div
            className={
              feedback.kind === "error"
                ? "rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
                : "rounded-md bg-muted px-4 py-3 text-sm"
            }
          >
            {feedback.text}
          </div>
        )}

        {booking.canManage ? (
          <>
            <div className="space-y-3">
              <div>
                <h2 className="font-medium">Choose a new time</h2>
                <p className="text-sm text-muted-foreground">
                  Select a date and time, then confirm the change. Your table is reassigned automatically.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedStartAt(null);
                    setSlots(null);
                    setFeedback(null);
                  }}
                />
                <Button type="button" onClick={checkAvailability} disabled={isPending || !selectedDate}>
                  {isPending ? "Checking…" : "Check times"}
                </Button>
              </div>

              {slots && availableSlots.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot) => {
                      const selected = selectedStartAt === slot.startAt;
                      return (
                        <Button
                          key={slot.startAt}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          disabled={isPending}
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedStartAt(slot.startAt);
                            setFeedback(null);
                          }}
                        >
                          {formatTime(slot.startAt, booking.timezone)}
                        </Button>
                      );
                    })}
                  </div>

                  {selectedStartAt && (
                    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm">
                        Selected: <strong>{formatDateTime(selectedStartAt, booking.timezone)}</strong>
                      </p>
                      <Button type="button" disabled={isPending} onClick={reschedule}>
                        {isPending ? "Rescheduling…" : "Reschedule booking"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-5">
              <Button type="button" variant="destructive" disabled={isPending} onClick={cancelBooking}>
                Cancel booking
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This booking can no longer be changed online.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
