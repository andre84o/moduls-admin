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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

      <Card>
        <CardHeader>
          <CardTitle>All bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No bookings yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const badge = statusBadge[b.status];
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.guestName}
                        {b.guestEmail && (
                          <span className="block text-xs text-muted-foreground">
                            {b.guestEmail}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.propertyTitle ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmt(b.startAt)} → {fmt(b.endAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
                            onClick={() =>
                              startTransition(() => deleteBooking(b.id))
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
