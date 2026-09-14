"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES = ["00", "15", "30", "45"]

function snapMinute(raw: string): string {
  const n = parseInt(raw)
  return MINUTES.reduce((prev, cur) =>
    Math.abs(parseInt(cur) - n) < Math.abs(parseInt(prev) - n) ? cur : prev
  )
}

function parseTime(hhmm: string) {
  const [h, m] = hhmm.split(":")
  return { hour: h ?? "12", minute: snapMinute(m ?? "00") }
}

interface TimePickerProps {
  /** Form field name — renders a hidden input when set */
  name?: string
  required?: boolean
  defaultValue?: string
  className?: string
  /** Controlled value in HH:MM format */
  value?: string
  onChange?: (value: string) => void
}

export function TimePicker({
  name,
  required,
  defaultValue = "12:00",
  className,
  value,
  onChange,
}: TimePickerProps) {
  const isControlled = value !== undefined
  const initial = parseTime(isControlled ? (value ?? defaultValue) : defaultValue)

  const [open, setOpen] = React.useState(false)
  const [hour, setHour] = React.useState(initial.hour)
  const [minute, setMinute] = React.useState(initial.minute)

  // keep internal state in sync when controlled value changes
  React.useEffect(() => {
    if (isControlled && value) {
      const parsed = parseTime(value)
      setHour(parsed.hour)
      setMinute(parsed.minute)
    }
  }, [isControlled, value])

  const displayValue = isControlled
    ? parseTime(value ?? defaultValue)
    : { hour, minute }

  const formValue = `${displayValue.hour}:${displayValue.minute}`

  function handleHour(v: string) {
    if (!v) return
    if (!isControlled) setHour(v)
    onChange?.(`${v}:${displayValue.minute}`)
  }

  function handleMinute(v: string) {
    if (!v) return
    if (!isControlled) setMinute(v)
    onChange?.(`${displayValue.hour}:${v}`)
  }

  return (
    <div className={cn("relative", className)}>
      {name && (
        <input
          type="text"
          name={name}
          value={formValue}
          onChange={() => undefined}
          required={required}
          aria-hidden
          tabIndex={-1}
          className="sr-only"
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="mt-1.5 flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
          {formValue}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex items-center gap-2">
            <Select value={displayValue.hour} onValueChange={(v) => handleHour(v ?? "")}>
              <SelectTrigger className="w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm font-medium text-muted-foreground">:</span>
            <Select value={displayValue.minute} onValueChange={(v) => handleMinute(v ?? "")}>
              <SelectTrigger className="w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
