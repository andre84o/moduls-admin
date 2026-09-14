"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES = ["00", "15", "30", "45"]

interface DateTimePickerProps {
  name: string
  required?: boolean
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  name,
  required,
  placeholder = "Pick date & time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(undefined)
  const [hour, setHour] = React.useState("12")
  const [minute, setMinute] = React.useState("00")

  const hiddenValue = date
    ? format(
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), parseInt(hour), parseInt(minute)),
        "yyyy-MM-dd'T'HH:mm"
      )
    : ""

  const displayLabel = date
    ? `${format(date, "d MMM yyyy")} ${hour}:${minute}`
    : placeholder

  return (
    <div className={cn("relative", className)}>
      {/* Used by form validation and submission */}
      <input
        type="text"
        name={name}
        value={hiddenValue}
        onChange={() => undefined}
        required={required}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "mt-1.5 flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {displayLabel}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
          />
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Time</span>
            <Select value={hour} onValueChange={(v) => { if (v) setHour(v) }}>
              <SelectTrigger className="w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm font-medium text-muted-foreground">:</span>
            <Select value={minute} onValueChange={(v) => { if (v) setMinute(v) }}>
              <SelectTrigger className="w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
