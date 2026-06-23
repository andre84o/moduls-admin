"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "../../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Does an event cover the given day? */
function covers(ev: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
  const s = new Date(ev.startAt).getTime();
  const e = new Date(ev.endAt).getTime();
  return s <= dayEnd && e >= dayStart;
}

export function CalendarSection({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Build the grid starting on Monday.
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookings and blocked time across the month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            {monthLabel}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="pb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-24 rounded-md" />;
              const dayEvents = events.filter((ev) => covers(ev, day));
              const isToday = startOfDay(day) === startOfDay(today);
              return (
                <div
                  key={i}
                  className="min-h-24 rounded-md border bg-card p-1.5"
                >
                  <span
                    className={
                      "inline-flex size-6 items-center justify-center rounded-full text-xs " +
                      (isToday
                        ? "bg-amber-500 font-semibold text-white"
                        : "text-muted-foreground")
                    }
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        title={ev.title}
                        className={
                          "truncate rounded px-1 py-0.5 text-[10px] leading-tight " +
                          (ev.kind === "blocked"
                            ? "bg-muted text-muted-foreground line-through"
                            : ev.status === "CONFIRMED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800")
                        }
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
