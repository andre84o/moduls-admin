"use client";

import { useRef, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBooking,
  setBookingStatus,
  deleteBooking,
} from "@/lib/actions";
import type {
  AdminBooking,
  AdminProperty,
  BookingStatus,
} from "../../types";

const statusBadge: Record<
  BookingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "secondary" },
  PAYMENT_PENDING: { label: "Payment pending", variant: "secondary" },
  CONFIRMED: { label: "Confirmed", variant: "default" },
  DECLINED: { label: "Declined", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
  EXPIRED: { label: "Expired", variant: "outline" },
  REFUNDED: { label: "Refunded", variant: "outline" },
};

// Check-in / check-out are date-based, so show the date without a time.
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

// Money is stored in MINOR units (öre/cents); show major units + currency code.
function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function BookingsSection({
  bookings,
  properties,
}: {
  bookings: AdminBooking[];
  properties: AdminProperty[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createBooking(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create bookings and respond to requests. The customer and admin are
          notified by email.
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>New booking</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            action={handleCreate}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor="guestName">Guest name</Label>
              <Input id="guestName" name="guestName" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="guestEmail">Guest email</Label>
              <Input
                id="guestEmail"
                name="guestEmail"
                type="email"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="propertyId">Property</Label>
              <select
                id="propertyId"
                name="propertyId"
                className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="startAt">Start</Label>
              <Input
                id="startAt"
                name="startAt"
                type="datetime-local"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="endAt">End</Label>
              <Input
                id="endAt"
                name="endAt"
                type="datetime-local"
                required
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" className="mt-1.5" />
            </div>

            {error && (
              <p className="sm:col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add booking"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-lg font-semibold tracking-tight">All bookings</h2>

      {bookings.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No bookings yet.
        </p>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const badge = statusBadge[b.status];
            const email = b.customerEmail ?? b.guestEmail;
            return (
              <Card key={b.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {b.propertyTitle ?? "Booking"}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <Badge variant={b.paid ? "default" : "outline"}>
                        {b.paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {fmtDate(b.startAt)} → {fmtDate(b.endAt)}
                      {b.nights != null
                        ? ` · ${b.nights} night${b.nights === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {b.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(() =>
                              setBookingStatus(b.id, "CONFIRMED"),
                            )
                          }
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(() =>
                              setBookingStatus(b.id, "DECLINED"),
                            )
                          }
                        >
                          Decline
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => startTransition(() => deleteBooking(b.id))}
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Customer
                      </p>
                      <p className="text-sm">{b.customerName ?? b.guestName}</p>
                      {email && (
                        <p className="text-xs break-all text-muted-foreground">
                          {email}
                        </p>
                      )}
                      {b.customerPhone && (
                        <p className="text-xs text-muted-foreground">
                          {b.customerPhone}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Guests
                      </p>
                      <p className="text-sm">
                        {b.adults} adult{b.adults === 1 ? "" : "s"} ·{" "}
                        {b.children} child{b.children === 1 ? "" : "ren"} ·{" "}
                        {b.infants} infant{b.infants === 1 ? "" : "s"} · {b.pets}{" "}
                        pet{b.pets === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Payment
                      </p>
                      <p className="text-sm">
                        {b.totalAmount != null
                          ? money(b.totalAmount, b.currency)
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.paid ? "Paid" : "Not paid"}
                      </p>
                      {b.stripeSessionId && (
                        <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                          {b.stripeSessionId}
                        </p>
                      )}
                    </div>

                    {b.notes && (
                      <div className="sm:col-span-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Notes
                        </p>
                        <p className="text-sm">{b.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
