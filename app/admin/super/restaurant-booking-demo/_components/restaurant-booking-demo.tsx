"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, Clock3, Minus, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MOCK_TIMES = ["17:00", "17:30", "18:30", "19:00", "19:30", "20:30"];

type Step = "search" | "details" | "done";

export function RestaurantBookingDemo() {
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("search");
  const [confirmationMode, setConfirmationMode] = useState<"REQUEST" | "AUTO_CONFIRM">("REQUEST");

  const summaryDate = useMemo(() => {
    if (!date) return "No date selected";
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [date]);

  function reset() {
    setStep("search");
    setSelectedTime(null);
  }

  if (step === "done") {
    const autoConfirmed = confirmationMode === "AUTO_CONFIRM";
    return (
      <Card className="mx-auto max-w-xl overflow-hidden border-0 shadow-xl ring-1 ring-black/5">
        <CardContent className="px-7 py-10 text-center sm:px-10 sm:py-12">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-7" />
          </div>
          <Badge variant="outline" className="mt-6">Preview only</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            {autoConfirmed ? "Your table is booked" : "Booking request received"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {autoConfirmed
              ? "The guest would receive an immediate confirmation here."
              : "The guest would be told that the restaurant needs to approve the request."}
          </p>

          <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-3 rounded-xl bg-muted/60 p-4 text-left">
            <div>
              <p className="text-xs text-muted-foreground">Guests</p>
              <p className="mt-1 font-medium">{partySize}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="mt-1 font-medium">{summaryDate}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="mt-1 font-medium">{selectedTime}</p>
            </div>
          </div>

          <Button type="button" variant="outline" className="mt-7" onClick={reset}>
            Preview again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="overflow-hidden border-0 shadow-xl ring-1 ring-black/5">
        <CardContent className="p-0">
          <div className="border-b bg-background px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Preview only</Badge>
                  <span className="text-xs text-muted-foreground">Restaurant Booking</span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">Reserve a table</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose your party size, date and an available time.
                </p>
              </div>
              {step === "details" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("search")}
                >
                  <ChevronLeft /> Back
                </Button>
              )}
            </div>
          </div>

          {step === "search" ? (
            <div className="space-y-8 px-6 py-7 sm:px-8">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Guests</h3>
                </div>
                <div className="inline-flex items-center gap-4 rounded-xl border bg-background p-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove guest"
                    disabled={partySize <= 1}
                    onClick={() => setPartySize((value) => Math.max(1, value - 1))}
                  >
                    <Minus />
                  </Button>
                  <div className="min-w-20 text-center">
                    <p className="text-lg font-semibold">{partySize}</p>
                    <p className="text-xs text-muted-foreground">{partySize === 1 ? "guest" : "guests"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Add guest"
                    disabled={partySize >= 12}
                    onClick={() => setPartySize((value) => Math.min(12, value + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
              </section>

              <section>
                <Label htmlFor="demo-booking-date">Date</Label>
                <Input
                  id="demo-booking-date"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSelectedTime(null);
                  }}
                  className="mt-2 max-w-xs"
                />
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Available times</h3>
                </div>
                {!date ? (
                  <div className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                    Choose a date to see available times.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {MOCK_TIMES.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant={selectedTime === time ? "default" : "outline"}
                        className="h-11"
                        onClick={() => setSelectedTime(time)}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                )}
              </section>

              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                disabled={!date || !selectedTime}
                onClick={() => setStep("details")}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-6 px-6 py-7 sm:px-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="demo-name">Name</Label>
                  <Input id="demo-name" placeholder="Alex Johnson" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="demo-phone">Phone</Label>
                  <Input id="demo-phone" placeholder="+46 70 123 45 67" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="demo-email">Email</Label>
                  <Input id="demo-email" type="email" placeholder="alex@example.com" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="demo-note">Special request</Label>
                  <Input id="demo-note" placeholder="Optional" className="mt-2" />
                </div>
              </div>

              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-sm font-medium">Your reservation</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Guests</p>
                    <p className="mt-1">{partySize}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="mt-1">{summaryDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="mt-1">{selectedTime}</p>
                  </div>
                </div>
              </div>

              <Button type="button" size="lg" className="w-full" onClick={() => setStep("done")}> 
                {confirmationMode === "AUTO_CONFIRM" ? "Book table" : "Send booking request"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium">Demo controls</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Switch the confirmation mode to preview both guest outcomes. Nothing is written to the database.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                variant={confirmationMode === "REQUEST" ? "secondary" : "outline"}
                className="justify-start"
                onClick={() => setConfirmationMode("REQUEST")}
              >
                Request approval
              </Button>
              <Button
                type="button"
                variant={confirmationMode === "AUTO_CONFIRM" ? "secondary" : "outline"}
                className="justify-start"
                onClick={() => setConfirmationMode("AUTO_CONFIRM")}
              >
                Auto confirm
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What the real widget will do</p>
            <p className="mt-2 leading-6">
              The customer version will replace these mock times with the live availability API and submit through the atomic booking endpoint.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
