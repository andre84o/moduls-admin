"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRestaurantBooking,
  createRestaurantTable,
  createRestaurantZone,
  saveRestaurantBookingSettings,
  setRestaurantBookingTables,
  updateRestaurantTable,
  updateRestaurantZone,
} from "@/modules/restaurant-booking/actions";
import { setBookingStatus } from "@/lib/actions";
import type {
  AdminRestaurantBooking,
  AdminRestaurantBookingStatus,
  AdminRestaurantTable,
  AdminRestaurantZone,
  RestaurantBookingSettingsInput,
} from "@/modules/restaurant-booking/types";

type View = "overview" | "bookings" | "tables" | "settings";
type Feedback = { kind: "success" | "error"; text: string } | null;

const ACTIVE_STATUSES = new Set<AdminRestaurantBookingStatus>([
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
]);

const statusBadge: Record<
  AdminRestaurantBookingStatus,
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

function localDayKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fmtDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function numberFrom(formData: FormData, key: string): number {
  return Number(String(formData.get(key) ?? "0"));
}

export function RestaurantBookingsSection({
  settings,
  zones,
  unzonedTables,
  bookings,
}: {
  settings: RestaurantBookingSettingsInput;
  zones: AdminRestaurantZone[];
  unzonedTables: AdminRestaurantTable[];
  bookings: AdminRestaurantBooking[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();
  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [nowIso, setNowIso] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<Record<string, string[]>>(
    () => Object.fromEntries(bookings.map((booking) => [booking.id, booking.tables.map((t) => t.id)])),
  );

  useEffect(() => {
    const now = new Date();
    setTodayKey(localDayKey(now.toISOString()));
    setNowIso(now.toISOString());
  }, []);

  useEffect(() => {
    setSelectedTables(
      Object.fromEntries(bookings.map((booking) => [booking.id, booking.tables.map((t) => t.id)])),
    );
  }, [bookings]);

  const allTables: AdminRestaurantTable[] = [
    ...zones.flatMap((zone) => zone.tables),
    ...unzonedTables,
  ];
  const activeTables = allTables.filter((table) => table.active);
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.has(booking.status));
  const todayBookings = todayKey
    ? activeBookings.filter((booking) => localDayKey(booking.startAt) === todayKey)
    : [];
  const todayCovers = todayBookings.reduce((sum, booking) => sum + booking.partySize, 0);
  const unassigned = activeBookings.filter((booking) => booking.tables.length === 0).length;
  const upcoming = activeBookings
    .filter((booking) => !nowIso || booking.startAt >= nowIso)
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 8);

  function runAction(
    action: () => Promise<{ error?: string } | void>,
    success: string,
  ) {
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

  function handleSettings(formData: FormData) {
    runAction(
      () =>
        saveRestaurantBookingSettings({
          slotIntervalMin: numberFrom(formData, "slotIntervalMin"),
          defaultDurationMin: numberFrom(formData, "defaultDurationMin"),
          turnaroundMin: numberFrom(formData, "turnaroundMin"),
          minLeadTimeMin: numberFrom(formData, "minLeadTimeMin"),
          bookingHorizonDays: numberFrom(formData, "bookingHorizonDays"),
          maxPartySize: numberFrom(formData, "maxPartySize"),
          confirmationMode:
            String(formData.get("confirmationMode")) === "AUTO_CONFIRM"
              ? "AUTO_CONFIRM"
              : "REQUEST",
          allowTableCombinations: formData.get("allowTableCombinations") === "on",
        }),
      "Booking settings saved.",
    );
  }

  function handleCreateBooking(formData: FormData) {
    const localStart = String(formData.get("startAt") ?? "");
    const start = new Date(localStart);
    if (!localStart || Number.isNaN(start.getTime())) {
      setFeedback({ kind: "error", text: "Choose a valid booking date and time." });
      return;
    }

    runAction(
      () =>
        createRestaurantBooking({
          guestName: String(formData.get("guestName") ?? ""),
          guestEmail: String(formData.get("guestEmail") ?? "") || null,
          guestPhone: String(formData.get("guestPhone") ?? "") || null,
          partySize: numberFrom(formData, "partySize"),
          startAt: start.toISOString(),
          notes: String(formData.get("notes") ?? "") || null,
        }),
      "Booking created.",
    );
  }

  function toggleAssignedTable(bookingId: string, tableId: string, checked: boolean) {
    setSelectedTables((current) => {
      const previous = current[bookingId] ?? [];
      if (checked && !settings.allowTableCombinations) {
        return { ...current, [bookingId]: [tableId] };
      }
      const next = checked
        ? [...new Set([...previous, tableId])]
        : previous.filter((id) => id !== tableId);
      return { ...current, [bookingId]: next };
    });
  }

  function tableEditor(table: AdminRestaurantTable) {
    return (
      <form
        key={table.id}
        action={(formData) =>
          runAction(
            () =>
              updateRestaurantTable({
                id: table.id,
                name: String(formData.get("name") ?? ""),
                zoneId: String(formData.get("zoneId") ?? "") || null,
                minSeats: numberFrom(formData, "minSeats"),
                maxSeats: numberFrom(formData, "maxSeats"),
                combinationGroup: String(formData.get("combinationGroup") ?? "") || null,
                active: formData.get("active") === "on",
                sortOrder: numberFrom(formData, "sortOrder"),
              }),
            "Table updated.",
          )
        }
        className="grid gap-3 rounded-lg border p-4 md:grid-cols-7 md:items-end"
      >
        <div className="md:col-span-2">
          <Label>Name</Label>
          <Input name="name" defaultValue={table.name} required className="mt-1.5" />
        </div>
        <div>
          <Label>Zone</Label>
          <select
            name="zoneId"
            defaultValue={table.zoneId ?? ""}
            className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">No zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Min seats</Label>
          <Input name="minSeats" type="number" min={1} defaultValue={table.minSeats} className="mt-1.5" />
        </div>
        <div>
          <Label>Max seats</Label>
          <Input name="maxSeats" type="number" min={1} defaultValue={table.maxSeats} className="mt-1.5" />
        </div>
        <div>
          <Label>Combine group</Label>
          <Input
            name="combinationGroup"
            defaultValue={table.combinationGroup ?? ""}
            placeholder="e.g. A"
            className="mt-1.5"
          />
        </div>
        <div className="flex items-center gap-3">
          <input type="hidden" name="sortOrder" value={table.sortOrder} />
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked={table.active} />
            Active
          </label>
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Restaurant bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage reservations, tables, zones and booking rules.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        {([
          ["overview", "Overview"],
          ["bookings", "Bookings"],
          ["tables", "Tables & Zones"],
          ["settings", "Settings"],
        ] as const).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={view === id ? "secondary" : "ghost"}
            onClick={() => {
              setView(id);
              setFeedback(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {feedback && (
        <div
          className={
            feedback.kind === "error"
              ? "mb-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
              : "mb-6 rounded-md bg-muted px-4 py-3 text-sm"
          }
        >
          {feedback.text}
        </div>
      )}

      {view === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Today</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-semibold">{todayBookings.length}</p><p className="text-xs text-muted-foreground">bookings</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Covers today</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-semibold">{todayCovers}</p><p className="text-xs text-muted-foreground">guests</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Unassigned</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-semibold">{unassigned}</p><p className="text-xs text-muted-foreground">need a table</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Active tables</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-semibold">{activeTables.length}</p><p className="text-xs text-muted-foreground">available inventory</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Upcoming bookings</CardTitle></CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming restaurant bookings.</p>
              ) : (
                <div className="divide-y">
                  {upcoming.map((booking) => (
                    <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{booking.guestName}</p>
                        <p className="text-sm text-muted-foreground">
                          {fmtDateTime(booking.startAt)} · {booking.partySize} guests
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {booking.tables.length > 0
                            ? booking.tables.map((table) => table.name).join(", ")
                            : "No table"}
                        </span>
                        <Badge variant={statusBadge[booking.status].variant}>
                          {statusBadge[booking.status].label}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {view === "bookings" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>New booking</CardTitle></CardHeader>
            <CardContent>
              <form action={handleCreateBooking} className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Guest name</Label>
                  <Input name="guestName" required className="mt-1.5" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="guestPhone" className="mt-1.5" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="guestEmail" type="email" className="mt-1.5" />
                </div>
                <div>
                  <Label>Party size</Label>
                  <Input
                    name="partySize"
                    type="number"
                    min={1}
                    max={settings.maxPartySize}
                    defaultValue={2}
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Date & time</Label>
                  <Input name="startAt" type="datetime-local" required className="mt-1.5" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input name="notes" className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saving…" : "Add booking"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {bookings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No restaurant bookings yet.</p>
            ) : (
              bookings.map((booking) => {
                const badge = statusBadge[booking.status];
                const selected = selectedTables[booking.id] ?? [];
                const inactive = !ACTIVE_STATUSES.has(booking.status);
                return (
                  <Card key={booking.id}>
                    <CardHeader className="flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex flex-wrap items-center gap-2">
                          {booking.guestName}
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {fmtDateTime(booking.startAt)} · {booking.partySize} guests
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {booking.status === "PENDING" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              runAction(
                                () => setBookingStatus(booking.id, "CONFIRMED"),
                                "Booking confirmed.",
                              )
                            }
                          >
                            Confirm
                          </Button>
                        )}
                        {ACTIVE_STATUSES.has(booking.status) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                              runAction(
                                () => setBookingStatus(booking.id, "CANCELLED"),
                                "Booking cancelled.",
                              )
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Contact</p>
                          <p className="text-sm">{booking.guestPhone ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{booking.guestEmail ?? "No email"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Current table</p>
                          <p className="text-sm">
                            {booking.tables.length > 0
                              ? booking.tables
                                  .map((table) =>
                                    table.zone ? `${table.name} (${table.zone.name})` : table.name,
                                  )
                                  .join(", ")
                              : "Not assigned"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Ends</p>
                          <p className="text-sm">{fmtDateTime(booking.endAt)}</p>
                        </div>
                      </div>

                      {booking.notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Notes</p>
                          <p className="text-sm">{booking.notes}</p>
                        </div>
                      )}

                      <div className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Assign table</p>
                            <p className="text-xs text-muted-foreground">
                              Capacity and time conflicts are validated on the server.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending || inactive}
                            onClick={() =>
                              runAction(
                                () =>
                                  setRestaurantBookingTables({
                                    bookingId: booking.id,
                                    tableIds: selected,
                                  }),
                                "Table assignment saved.",
                              )
                            }
                          >
                            Save assignment
                          </Button>
                        </div>

                        {allTables.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Create tables first.</p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {allTables.map((table) => {
                              const checked = selected.includes(table.id);
                              const disabled = inactive || (!table.active && !checked);
                              const zoneName = zones.find((zone) => zone.id === table.zoneId)?.name;
                              return (
                                <label
                                  key={table.id}
                                  className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      toggleAssignedTable(
                                        booking.id,
                                        table.id,
                                        event.target.checked,
                                      )
                                    }
                                  />
                                  <span>
                                    <span className="font-medium">{table.name}</span>
                                    <span className="block text-xs text-muted-foreground">
                                      {table.minSeats}–{table.maxSeats} seats
                                      {zoneName ? ` · ${zoneName}` : ""}
                                      {!table.active ? " · inactive" : ""}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {view === "tables" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Add zone</CardTitle></CardHeader>
              <CardContent>
                <form
                  action={(formData) =>
                    runAction(
                      () =>
                        createRestaurantZone({
                          name: String(formData.get("name") ?? ""),
                          sortOrder: numberFrom(formData, "sortOrder"),
                        }),
                      "Zone created.",
                    )
                  }
                  className="grid gap-4 sm:grid-cols-[1fr_100px_auto] sm:items-end"
                >
                  <div>
                    <Label>Zone name</Label>
                    <Input name="name" placeholder="Dining room" required className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Order</Label>
                    <Input name="sortOrder" type="number" defaultValue={0} className="mt-1.5" />
                  </div>
                  <Button type="submit" disabled={isPending}>Add</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Add table</CardTitle></CardHeader>
              <CardContent>
                <form
                  action={(formData) =>
                    runAction(
                      () =>
                        createRestaurantTable({
                          name: String(formData.get("name") ?? ""),
                          zoneId: String(formData.get("zoneId") ?? "") || null,
                          minSeats: numberFrom(formData, "minSeats"),
                          maxSeats: numberFrom(formData, "maxSeats"),
                          combinationGroup: String(formData.get("combinationGroup") ?? "") || null,
                          active: true,
                          sortOrder: 0,
                        }),
                      "Table created.",
                    )
                  }
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <div>
                    <Label>Table name</Label>
                    <Input name="name" placeholder="Table 1" required className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Zone</Label>
                    <select
                      name="zoneId"
                      className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">No zone</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Min seats</Label>
                    <Input name="minSeats" type="number" min={1} defaultValue={1} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Max seats</Label>
                    <Input name="maxSeats" type="number" min={1} defaultValue={2} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Combine group</Label>
                    <Input name="combinationGroup" placeholder="Optional" className="mt-1.5" />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={isPending}>Add table</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Zones</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {zones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No zones yet.</p>
              ) : (
                zones.map((zone) => (
                  <form
                    key={zone.id}
                    action={(formData) =>
                      runAction(
                        () =>
                          updateRestaurantZone({
                            id: zone.id,
                            name: String(formData.get("name") ?? ""),
                            active: formData.get("active") === "on",
                            sortOrder: numberFrom(formData, "sortOrder"),
                          }),
                        "Zone updated.",
                      )
                    }
                    className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_100px_auto_auto] sm:items-end"
                  >
                    <div>
                      <Label>Name</Label>
                      <Input name="name" defaultValue={zone.name} required className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Order</Label>
                      <Input name="sortOrder" type="number" defaultValue={zone.sortOrder} className="mt-1.5" />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input name="active" type="checkbox" defaultChecked={zone.active} />
                      Active
                    </label>
                    <Button type="submit" size="sm" disabled={isPending}>Save</Button>
                  </form>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tables</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allTables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tables yet.</p>
              ) : (
                allTables.map(tableEditor)
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {view === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle>Restaurant booking settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleSettings} className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Slot interval (minutes)</Label>
                <Input name="slotIntervalMin" type="number" min={5} max={120} defaultValue={settings.slotIntervalMin} className="mt-1.5" />
              </div>
              <div>
                <Label>Booking duration (minutes)</Label>
                <Input name="defaultDurationMin" type="number" min={15} max={480} defaultValue={settings.defaultDurationMin} className="mt-1.5" />
              </div>
              <div>
                <Label>Turnaround (minutes)</Label>
                <Input name="turnaroundMin" type="number" min={0} max={180} defaultValue={settings.turnaroundMin} className="mt-1.5" />
              </div>
              <div>
                <Label>Minimum lead time (minutes)</Label>
                <Input name="minLeadTimeMin" type="number" min={0} max={10080} defaultValue={settings.minLeadTimeMin} className="mt-1.5" />
              </div>
              <div>
                <Label>Booking horizon (days)</Label>
                <Input name="bookingHorizonDays" type="number" min={1} max={365} defaultValue={settings.bookingHorizonDays} className="mt-1.5" />
              </div>
              <div>
                <Label>Max party size</Label>
                <Input name="maxPartySize" type="number" min={1} max={100} defaultValue={settings.maxPartySize} className="mt-1.5" />
              </div>
              <div>
                <Label>Confirmation mode</Label>
                <select
                  name="confirmationMode"
                  defaultValue={settings.confirmationMode}
                  className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="REQUEST">Request approval</option>
                  <option value="AUTO_CONFIRM">Auto confirm</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  name="allowTableCombinations"
                  type="checkbox"
                  defaultChecked={settings.allowTableCombinations}
                />
                Allow table combinations
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
