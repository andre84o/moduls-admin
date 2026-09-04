"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRestaurantBlockedPeriodSafely,
  createRestaurantServicePeriodSafely,
  deleteRestaurantBlockedPeriodSafely,
  deleteRestaurantServicePeriodSafely,
  previewRestaurantAvailabilitySafely,
  saveRestaurantBookingTimezoneSafely,
} from "@/modules/restaurant-booking/configuration-actions";
import type {
  AdminRestaurantBlockedPeriod,
  AdminRestaurantServicePeriod,
  RestaurantAvailabilityResult,
} from "@/modules/restaurant-booking/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Feedback = { kind: "success" | "error"; text: string } | null;

function minuteLabel(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeToMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatSlot(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RestaurantAvailabilityAdmin({
  timezone,
  servicePeriods,
  blockedPeriods,
}: {
  timezone: string;
  servicePeriods: AdminRestaurantServicePeriod[];
  blockedPeriods: AdminRestaurantBlockedPeriod[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [preview, setPreview] = useState<RestaurantAvailabilityResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | void>, success: string) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && "error" in result && result.error) {
          setFeedback({ kind: "error", text: result.error });
          return;
        }
        setFeedback({ kind: "success", text: success });
        router.refresh();
      } catch {
        setFeedback({ kind: "error", text: "Something went wrong. Please try again." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={feedback.kind === "error" ? "rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive" : "rounded-md bg-muted px-4 py-3 text-sm"}>
          {feedback.text}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Timezone</CardTitle></CardHeader>
        <CardContent>
          <form
            action={(formData) => run(() => saveRestaurantBookingTimezoneSafely(String(formData.get("timezone") ?? "")), "Timezone saved.")}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label>Restaurant timezone</Label>
              <Input name="timezone" defaultValue={timezone} placeholder="Europe/Stockholm" className="mt-1.5" />
            </div>
            <Button type="submit" disabled={isPending}>Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Service hours</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form
            action={(formData) =>
              run(
                () => createRestaurantServicePeriodSafely({
                  weekday: Number(formData.get("weekday")),
                  startMinute: timeToMinute(String(formData.get("start") ?? "")),
                  endMinute: timeToMinute(String(formData.get("end") ?? "")),
                }),
                "Service period added.",
              )
            }
            className="grid gap-3 sm:grid-cols-[1fr_140px_140px_auto] sm:items-end"
          >
            <div>
              <Label>Day</Label>
              <select name="weekday" className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm">
                {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </div>
            <div>
              <Label>From</Label>
              <Input name="start" type="time" defaultValue="17:00" required className="mt-1.5" />
            </div>
            <div>
              <Label>To</Label>
              <Input name="end" type="time" defaultValue="22:00" required className="mt-1.5" />
            </div>
            <Button type="submit" disabled={isPending}>Add</Button>
          </form>

          {servicePeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service hours configured. Public availability will stay closed.</p>
          ) : (
            <div className="space-y-2">
              {servicePeriods.map((period) => (
                <div key={period.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{WEEKDAYS[period.weekday]} · {minuteLabel(period.startMinute)}–{minuteLabel(period.endMinute)}</span>
                  <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => deleteRestaurantServicePeriodSafely(period.id), "Service period removed.")}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Blocked periods</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form
            action={(formData) => {
              const start = new Date(String(formData.get("startAt") ?? ""));
              const end = new Date(String(formData.get("endAt") ?? ""));
              run(
                () => createRestaurantBlockedPeriodSafely({
                  startAt: start.toISOString(),
                  endAt: end.toISOString(),
                  reason: String(formData.get("reason") ?? "") || null,
                }),
                "Blocked period added.",
              );
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label>From</Label>
              <Input name="startAt" type="datetime-local" required className="mt-1.5" />
            </div>
            <div>
              <Label>To</Label>
              <Input name="endAt" type="datetime-local" required className="mt-1.5" />
            </div>
            <div>
              <Label>Reason</Label>
              <Input name="reason" placeholder="Private event" className="mt-1.5" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isPending}>Block time</Button>
            </div>
          </form>

          {blockedPeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked periods.</p>
          ) : (
            <div className="space-y-2">
              {blockedPeriods.map((period) => (
                <div key={period.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span>
                    {new Date(period.startAt).toLocaleString()} → {new Date(period.endAt).toLocaleString()}
                    {period.reason ? ` · ${period.reason}` : ""}
                  </span>
                  <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => deleteRestaurantBlockedPeriodSafely(period.id), "Blocked period removed.")}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Availability preview</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form
            action={(formData) => {
              setFeedback(null);
              startTransition(async () => {
                const result = await previewRestaurantAvailabilitySafely({
                  date: String(formData.get("date") ?? ""),
                  partySize: Number(formData.get("partySize")),
                });
                setPreview(result);
              });
            }}
            className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
          >
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required className="mt-1.5" />
            </div>
            <div>
              <Label>Party size</Label>
              <Input name="partySize" type="number" min={1} defaultValue={2} required className="mt-1.5" />
            </div>
            <Button type="submit" disabled={isPending}>Check</Button>
          </form>

          {preview && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Timezone: {preview.timezone}</p>
              {preview.slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots for this date and party size.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {preview.slots.map((slot) => (
                    <span key={slot.startAt} className={slot.available ? "rounded-md border px-3 py-1.5 text-sm" : "rounded-md border px-3 py-1.5 text-sm text-muted-foreground line-through"}>
                      {formatSlot(slot.startAt, preview.timezone)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
