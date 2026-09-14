"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { Circle, Eye, Pencil, Save, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { saveRestaurantFloorPlan } from "../floor-plan-actions";
import {
  clampRestaurantFloorPlanPosition,
  RESTAURANT_FLOOR_PLAN_DEFAULT_HEIGHT,
  RESTAURANT_FLOOR_PLAN_DEFAULT_WIDTH,
  RESTAURANT_FLOOR_PLAN_HEIGHT,
  RESTAURANT_FLOOR_PLAN_WIDTH,
} from "../floor-plan";
import type {
  AdminRestaurantBooking,
  AdminRestaurantTable,
  AdminRestaurantTableLayout,
  AdminRestaurantZone,
  RestaurantTableLayoutInput,
  RestaurantTableShapeValue,
} from "../types";

const UNZONED = "__UNZONED__";
const DRAG_KEY = "application/x-restaurant-table-id";
const ACTIVE_BOOKING_STATUSES = new Set(["PENDING", "PAYMENT_PENDING", "CONFIRMED"]);

type FloorTable = AdminRestaurantTable & {
  zoneKey: string;
  zoneName: string | null;
  zoneActive: boolean;
};

type LiveTableState = {
  kind: "BOOKED" | "SOON";
  booking: AdminRestaurantBooking;
};

function serializeLayouts(items: RestaurantTableLayoutInput[]) {
  return JSON.stringify([...items].sort((a, b) => a.tableId.localeCompare(b.tableId)));
}

function restaurantLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}

function restaurantLocalToUtcMs(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = wallClockAsUtc - timezoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  candidate = wallClockAsUtc - timezoneOffsetMs(new Date(candidate), timeZone);
  return candidate;
}

function formatBookingTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClasses(kind: "FREE" | "SOON" | "BOOKED" | "INACTIVE") {
  if (kind === "BOOKED") return "border-destructive bg-destructive/10 text-destructive";
  if (kind === "SOON") return "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (kind === "INACTIVE") return "border-muted-foreground/30 bg-muted text-muted-foreground";
  return "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
}

export function RestaurantFloorPlanSection({
  zones,
  unzonedTables,
  layouts,
  bookings,
  timezone,
  canEdit,
}: {
  zones: AdminRestaurantZone[];
  unzonedTables: AdminRestaurantTable[];
  layouts: AdminRestaurantTableLayout[];
  bookings: AdminRestaurantBooking[];
  timezone: string;
  canEdit: boolean;
}) {
  const allTables = useMemo<FloorTable[]>(
    () => [
      ...zones.flatMap((zone) =>
        zone.tables.map((table) => ({
          ...table,
          zoneKey: zone.id,
          zoneName: zone.name,
          zoneActive: zone.active,
        })),
      ),
      ...unzonedTables.map((table) => ({
        ...table,
        zoneKey: UNZONED,
        zoneName: null,
        zoneActive: true,
      })),
    ],
    [zones, unzonedTables],
  );

  const zoneOptions = useMemo(
    () => [
      ...zones
        .filter((zone) => zone.tables.length > 0)
        .map((zone) => ({ key: zone.id, label: zone.name })),
      ...(unzonedTables.length > 0 ? [{ key: UNZONED, label: "Unzoned" }] : []),
    ],
    [zones, unzonedTables],
  );

  const initialZone = zoneOptions[0]?.key ?? "";
  const [zoneKey, setZoneKey] = useState(initialZone);
  const [mode, setMode] = useState<"EDIT" | "LIVE">("LIVE");
  const [items, setItems] = useState<RestaurantTableLayoutInput[]>(() => layouts.map((item) => ({ ...item })));
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeLayouts(layouts));
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const boardRef = useRef<HTMLDivElement>(null);

  const nowParts = useMemo(() => restaurantLocalParts(new Date(), timezone), [timezone]);
  const [liveDate, setLiveDate] = useState(nowParts.date);
  const [liveTime, setLiveTime] = useState(nowParts.time);

  const zoneTables = allTables.filter((table) => table.zoneKey === zoneKey);
  const zoneTableIds = new Set(zoneTables.map((table) => table.id));
  const zoneLayouts = items.filter((item) => zoneTableIds.has(item.tableId));
  const placedIds = new Set(items.map((item) => item.tableId));
  const unplacedTables = zoneTables.filter((table) => !placedIds.has(table.id));
  const selectedTable = allTables.find((table) => table.id === selectedTableId) ?? null;
  const selectedLayout = items.find((item) => item.tableId === selectedTableId) ?? null;
  const dirty = serializeLayouts(items) !== savedSnapshot;

  const selectedAtMs = useMemo(
    () => restaurantLocalToUtcMs(liveDate, liveTime, timezone),
    [liveDate, liveTime, timezone],
  );

  const liveStateByTable = useMemo(() => {
    const result = new Map<string, LiveTableState>();
    for (const booking of bookings) {
      if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) continue;
      const start = new Date(booking.startAt).getTime();
      const end = new Date(booking.endAt).getTime();
      const bookedNow = selectedAtMs >= start && selectedAtMs < end;
      const startsSoon = start > selectedAtMs && start - selectedAtMs <= 30 * 60_000;
      if (!bookedNow && !startsSoon) continue;

      for (const table of booking.tables) {
        const current = result.get(table.id);
        if (bookedNow) {
          result.set(table.id, { kind: "BOOKED", booking });
          continue;
        }
        if (!current || (current.kind === "SOON" && start < new Date(current.booking.startAt).getTime())) {
          result.set(table.id, { kind: "SOON", booking });
        }
      }
    }
    return result;
  }, [bookings, selectedAtMs]);

  function placeTable(tableId: string) {
    if (!canEdit || placedIds.has(tableId)) return;
    const index = zoneLayouts.length;
    const x = 40 + (index % 5) * 180;
    const y = 40 + Math.floor(index / 5) * 120;
    const position = clampRestaurantFloorPlanPosition({
      x,
      y,
      width: RESTAURANT_FLOOR_PLAN_DEFAULT_WIDTH,
      height: RESTAURANT_FLOOR_PLAN_DEFAULT_HEIGHT,
    });
    setItems((current) => [
      ...current,
      {
        tableId,
        x: position.x,
        y: position.y,
        width: RESTAURANT_FLOOR_PLAN_DEFAULT_WIDTH,
        height: RESTAURANT_FLOOR_PLAN_DEFAULT_HEIGHT,
        shape: "RECTANGLE",
        rotation: 0,
      },
    ]);
    setSelectedTableId(tableId);
    setMessage(null);
  }

  function handleDragStart(event: DragEvent, tableId: string) {
    event.dataTransfer.setData(DRAG_KEY, tableId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!canEdit || !boardRef.current) return;
    const tableId = event.dataTransfer.getData(DRAG_KEY);
    if (!zoneTables.some((table) => table.id === tableId)) return;

    const rect = boardRef.current.getBoundingClientRect();
    const existing = items.find((item) => item.tableId === tableId);
    const width = existing?.width ?? RESTAURANT_FLOOR_PLAN_DEFAULT_WIDTH;
    const height = existing?.height ?? RESTAURANT_FLOOR_PLAN_DEFAULT_HEIGHT;
    const rawX = ((event.clientX - rect.left) / rect.width) * RESTAURANT_FLOOR_PLAN_WIDTH - width / 2;
    const rawY = ((event.clientY - rect.top) / rect.height) * RESTAURANT_FLOOR_PLAN_HEIGHT - height / 2;
    const position = clampRestaurantFloorPlanPosition({ x: rawX, y: rawY, width, height });

    setItems((current) => {
      const currentItem = current.find((item) => item.tableId === tableId);
      if (currentItem) {
        return current.map((item) =>
          item.tableId === tableId ? { ...item, ...position } : item,
        );
      }
      return [
        ...current,
        {
          tableId,
          ...position,
          width,
          height,
          shape: "RECTANGLE" as const,
          rotation: 0,
        },
      ];
    });
    setSelectedTableId(tableId);
    setMessage(null);
  }

  function updateSelected(patch: Partial<RestaurantTableLayoutInput>) {
    if (!selectedTableId || !canEdit) return;
    setItems((current) =>
      current.map((item) => {
        if (item.tableId !== selectedTableId) return item;
        const next = { ...item, ...patch };
        const position = clampRestaurantFloorPlanPosition(next);
        return { ...next, ...position };
      }),
    );
    setMessage(null);
  }

  function setShape(shape: RestaurantTableShapeValue) {
    if (!selectedLayout) return;
    if (shape === "ROUND") {
      const size = Math.max(selectedLayout.width, selectedLayout.height);
      updateSelected({ shape, width: size, height: size, rotation: 0 });
      return;
    }
    updateSelected({ shape });
  }

  function setSize(size: "SMALL" | "MEDIUM" | "LARGE") {
    if (!selectedLayout) return;
    const dimensions =
      selectedLayout.shape === "ROUND"
        ? size === "SMALL"
          ? { width: 90, height: 90 }
          : size === "MEDIUM"
            ? { width: 120, height: 120 }
            : { width: 150, height: 150 }
        : size === "SMALL"
          ? { width: 110, height: 70 }
          : size === "MEDIUM"
            ? { width: 140, height: 90 }
            : { width: 180, height: 110 };
    updateSelected(dimensions);
  }

  function removeSelected() {
    if (!selectedTableId || !canEdit) return;
    setItems((current) => current.filter((item) => item.tableId !== selectedTableId));
    setSelectedTableId(null);
    setMessage(null);
  }

  function save() {
    if (!canEdit || !dirty) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveRestaurantFloorPlan({ items });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setSavedSnapshot(serializeLayouts(items));
      setSelectedTableId(null);
      setMode("LIVE");
      setMessage("Floor plan saved.");
    });
  }

  if (allTables.length === 0) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Floor plan</h1>
        <p className="text-sm text-muted-foreground">
          Create restaurant tables under Bookings first. Floor plan uses those same tables and never creates separate inventory.
        </p>
      </section>
    );
  }

  const selectedLiveState = selectedTableId ? liveStateByTable.get(selectedTableId) ?? null : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Floor plan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visual layout only. Booking availability and conflicts still come from the Restaurant Booking engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant={mode === "EDIT" ? "secondary" : "ghost"}
              onClick={() => setMode("EDIT")}
            >
              <Pencil className="size-4" />
              Edit layout
            </Button>
          )}
          <Button
            variant={mode === "LIVE" ? "secondary" : "ghost"}
            onClick={() => setMode("LIVE")}
          >
            <Eye className="size-4" />
            Live floor
          </Button>
          {mode === "EDIT" && canEdit && (
            <Button onClick={save} disabled={!dirty || isPending}>
              <Save className="size-4" />
              {isPending ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-background p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Zone</span>
          <select
            className="h-9 min-w-48 rounded-md border bg-background px-3 text-sm"
            value={zoneKey}
            onChange={(event) => {
              setZoneKey(event.target.value);
              setSelectedTableId(null);
            }}
          >
            {zoneOptions.map((zone) => (
              <option key={zone.key} value={zone.key}>
                {zone.label}
              </option>
            ))}
          </select>
        </label>

        {mode === "LIVE" && (
          <>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Date</span>
              <DatePicker
                value={liveDate}
                onChange={setLiveDate}
                placeholder="Pick date"
                className="mt-0"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Time</span>
              <TimePicker
                value={liveTime}
                onChange={setLiveTime}
                className="mt-0"
              />
            </label>
            <span className="pb-2 text-xs text-muted-foreground">{timezone}</span>
          </>
        )}

        {mode === "EDIT" && dirty && (
          <span className="pb-2 text-xs font-medium text-amber-700 dark:text-amber-300">Unsaved changes</span>
        )}
        {message && <span className="pb-2 text-xs text-muted-foreground">{message}</span>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          ref={boardRef}
          className="relative w-full overflow-hidden rounded-xl border bg-muted/20 shadow-sm"
          style={{ aspectRatio: `${RESTAURANT_FLOOR_PLAN_WIDTH} / ${RESTAURANT_FLOOR_PLAN_HEIGHT}` }}
          onDragOver={(event) => {
            if (mode === "EDIT" && canEdit) event.preventDefault();
          }}
          onDrop={mode === "EDIT" ? handleDrop : undefined}
        >
          {zoneLayouts.length === 0 && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-muted-foreground">
              {mode === "EDIT"
                ? "Place tables from the panel on the right, then drag them into position."
                : "No tables have been placed in this zone yet."}
            </div>
          )}

          {zoneLayouts.map((layout) => {
            const table = allTables.find((candidate) => candidate.id === layout.tableId);
            if (!table) return null;
            const liveState = liveStateByTable.get(table.id);
            const liveKind = !table.active || !table.zoneActive
              ? "INACTIVE"
              : liveState?.kind ?? "FREE";
            const selected = selectedTableId === table.id;

            return (
              <button
                key={table.id}
                type="button"
                draggable={mode === "EDIT" && canEdit}
                onDragStart={(event) => handleDragStart(event, table.id)}
                onClick={() => setSelectedTableId(table.id)}
                className={cn(
                  "absolute flex select-none flex-col items-center justify-center border-2 px-2 text-center text-xs font-medium shadow-sm transition-shadow",
                  mode === "LIVE" ? statusClasses(liveKind) : "border-border bg-background",
                  selected && "ring-2 ring-primary ring-offset-2",
                  mode === "EDIT" && canEdit && "cursor-move",
                )}
                style={{
                  left: `${(layout.x / RESTAURANT_FLOOR_PLAN_WIDTH) * 100}%`,
                  top: `${(layout.y / RESTAURANT_FLOOR_PLAN_HEIGHT) * 100}%`,
                  width: `${(layout.width / RESTAURANT_FLOOR_PLAN_WIDTH) * 100}%`,
                  height: `${(layout.height / RESTAURANT_FLOOR_PLAN_HEIGHT) * 100}%`,
                  borderRadius: layout.shape === "ROUND" ? "9999px" : "0.75rem",
                  transform: `rotate(${layout.rotation}deg)`,
                }}
              >
                <span className="truncate">{table.name}</span>
                <span className="text-[10px] font-normal opacity-80">
                  {mode === "LIVE"
                    ? liveKind === "BOOKED"
                      ? `${liveState?.booking.partySize ?? ""} guests`
                      : liveKind === "SOON"
                        ? "Soon"
                        : liveKind === "INACTIVE"
                          ? "Inactive"
                          : "Free"
                    : `${table.minSeats}-${table.maxSeats} seats`}
                </span>
              </button>
            );
          })}
        </div>

        <aside className="space-y-4">
          {mode === "EDIT" ? (
            <>
              <div className="rounded-lg border bg-background p-4">
                <h2 className="font-medium">Unplaced tables</h2>
                <div className="mt-3 space-y-2">
                  {unplacedTables.length === 0 ? (
                    <p className="text-xs text-muted-foreground">All tables in this zone are placed.</p>
                  ) : (
                    unplacedTables.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        draggable={canEdit}
                        onDragStart={(event) => handleDragStart(event, table.id)}
                        onClick={() => placeTable(table.id)}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span>{table.name}</span>
                        <span className="text-xs text-muted-foreground">{table.maxSeats} seats</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedTable && selectedLayout && (
                <div className="space-y-4 rounded-lg border bg-background p-4">
                  <div>
                    <h2 className="font-medium">{selectedTable.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedTable.zoneName ?? "Unzoned"} · {selectedTable.minSeats}-{selectedTable.maxSeats} seats
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium">Shape</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedLayout.shape === "RECTANGLE" ? "secondary" : "outline"}
                        onClick={() => setShape("RECTANGLE")}
                      >
                        <Square className="size-4" />
                        Rectangle
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedLayout.shape === "ROUND" ? "secondary" : "outline"}
                        onClick={() => setShape("ROUND")}
                      >
                        <Circle className="size-4" />
                        Round
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium">Size</span>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSize("SMALL")}>Small</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSize("MEDIUM")}>Medium</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSize("LARGE")}>Large</Button>
                    </div>
                  </div>

                  {selectedLayout.shape === "RECTANGLE" && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium">Rotation</span>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => updateSelected({ rotation: 0 })}>0°</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => updateSelected({ rotation: 90 })}>90°</Button>
                      </div>
                    </div>
                  )}

                  <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={removeSelected}>
                    <Trash2 className="size-4" />
                    Remove from floor
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-background p-4">
              <h2 className="font-medium">Live status</h2>
              {!selectedTable ? (
                <p className="mt-2 text-sm text-muted-foreground">Select a table to see its status.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{selectedTable.name}</span>
                    <span className="text-xs text-muted-foreground">{selectedTable.zoneName ?? "Unzoned"}</span>
                  </div>
                  {!selectedTable.active || !selectedTable.zoneActive ? (
                    <p className="text-muted-foreground">This table or its zone is inactive.</p>
                  ) : selectedLiveState ? (
                    <>
                      <p className="font-medium">
                        {selectedLiveState.kind === "BOOKED" ? "Booked" : "Booking starts soon"}
                      </p>
                      <p>{selectedLiveState.booking.guestName} · {selectedLiveState.booking.partySize} guests</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBookingTime(selectedLiveState.booking.startAt, timezone)} - {formatBookingTime(selectedLiveState.booking.endAt, timezone)}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedLiveState.booking.status}</p>
                    </>
                  ) : (
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">Free at selected time</p>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
