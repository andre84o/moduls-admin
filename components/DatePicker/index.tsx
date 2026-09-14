"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  /** Form field name — renders a hidden input when set */
  name?: string
  required?: boolean
  placeholder?: string
  className?: string
  /** Controlled value in YYYY-MM-DD format */
  value?: string
  onChange?: (value: string) => void
}

export function DatePicker({
  name,
  required,
  placeholder = "Pick a date",
  className,
  value,
  onChange,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(
    value ? parseISO(value) : undefined
  )

  const isControlled = value !== undefined
  const selectedDate = isControlled ? (value ? parseISO(value) : undefined) : internalDate

  function handleSelect(day: Date | undefined) {
    if (!day) return
    const iso = format(day, "yyyy-MM-dd")
    if (!isControlled) setInternalDate(day)
    onChange?.(iso)
    setOpen(false)
  }

  const hiddenValue = selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""
  const displayLabel = selectedDate ? format(selectedDate, "d MMM yyyy") : placeholder

  return (
    <div className={cn("relative", className)}>
      {name && (
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
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "mt-1.5 flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {displayLabel}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
