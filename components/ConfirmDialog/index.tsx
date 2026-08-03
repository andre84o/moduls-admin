"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * ConfirmDialog — the global delete-confirmation dialog.
 *
 * A small, centered popup used by ANY delete (or destructive) button across the
 * app. It renders your existing button via the `trigger` prop and only calls
 * `onConfirm` after the user explicitly confirms.
 *
 * @example
 * <ConfirmDialog
 *   trigger={<Button variant="destructive" size="sm">Delete</Button>}
 *   onConfirm={() => startTransition(() => deleteThing())}
 *   disabled={isPending}
 * />
 */
export type ConfirmDialogProps = {
  /** The clickable element that opens the dialog (e.g. an existing delete Button). Passed to DialogTrigger's render prop. */
  trigger: React.ReactElement
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Called when the user confirms. */
  onConfirm: () => void
  /** Disables the confirm button (e.g. while a transition is pending). */
  disabled?: boolean
}

export function ConfirmDialog({
  trigger,
  title = "Delete this?",
  description = "This action can't be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  disabled,
}: ConfirmDialogProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton={false}
        className="max-w-xs gap-3 p-4 text-xs sm:max-w-xs"
      >
        <DialogHeader>
          <DialogTitle className="text-xs font-medium">{title}</DialogTitle>
          <DialogDescription className="text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
