"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { upsertCustomer, updateCustomerNote } from "@/lib/actions";
import type { AdminCustomer } from "../../types";

const FIELDS = [
  { key: "firstName", label: "First name", type: "text" },
  { key: "lastName", label: "Last name", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "mobile", label: "Mobile", type: "tel" },
  { key: "address", label: "Address", type: "text" },
  { key: "postalCode", label: "Postal code", type: "text" },
  { key: "country", label: "Country", type: "text" },
  { key: "gender", label: "Gender", type: "text" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type FormState = Record<FieldKey, string>;

function emptyForm(): FormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    address: "",
    postalCode: "",
    country: "",
    gender: "",
  };
}

function formFrom(c: AdminCustomer): FormState {
  return {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    address: c.address ?? "",
    postalCode: c.postalCode ?? "",
    country: c.country ?? "",
    gender: c.gender ?? "",
  };
}

function title(form: FormState): string {
  return [form.firstName, form.lastName].filter(Boolean).join(" ").trim();
}

export function CustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: AdminCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Keyed so all local state re-initializes when the target changes. */}
        <CustomerDialogBody
          key={customer?.id ?? "new"}
          customer={customer}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialogBody({
  customer,
  onOpenChange,
}: {
  customer: AdminCustomer | null;
  onOpenChange: (open: boolean) => void;
}) {
  const createMode = customer === null;

  const [editing, setEditing] = useState(createMode);
  const [form, setForm] = useState<FormState>(() =>
    customer ? formFrom(customer) : emptyForm(),
  );
  const [note, setNote] = useState(() => customer?.note ?? "");
  const [isPending, startTransition] = useTransition();

  function set(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function saveInfo(formData: FormData) {
    startTransition(async () => {
      await upsertCustomer(formData);
      if (createMode) onOpenChange(false);
      else setEditing(false);
    });
  }

  function saveNote(formData: FormData) {
    startTransition(async () => {
      await updateCustomerNote(formData);
    });
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between gap-2 pr-6">
          <DialogTitle className="text-sm">
            {createMode ? "New customer" : title(form) || "Customer"}
          </DialogTitle>
          {!createMode && !editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Edit customer"
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
          )}
        </div>
        <DialogDescription className="text-xs">
          {editing
            ? "Edit the customer's contact details."
            : "Customer details."}
        </DialogDescription>
      </DialogHeader>

      {/* Contact details — edited together, saved with one Save button. */}
      <form action={saveInfo} className="space-y-4">
        <input type="hidden" name="id" value={customer?.id ?? ""} />

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key} className="text-xs text-muted-foreground">
                {f.label}
              </Label>
              {editing ? (
                <Input
                  id={f.key}
                  name={f.key}
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="h-8 text-sm"
                />
              ) : (
                <p className="text-sm">{form[f.key] || "—"}</p>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="flex justify-end gap-2">
            {!createMode && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isPending}
                onClick={() => {
                  if (customer) setForm(formFrom(customer));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" size="xs" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </form>

      {/* Note — handled separately with its own Save button. */}
      {!createMode && (
        <>
          <Separator />
          <form action={saveNote} className="space-y-2">
            <input type="hidden" name="id" value={customer?.id ?? ""} />
            <Label htmlFor="note" className="text-xs text-muted-foreground">
              Note
            </Label>
            <Textarea
              id="note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Extra information about this customer…"
              rows={4}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button type="submit" size="xs" disabled={isPending}>
                {isPending ? "Saving…" : "Save note"}
              </Button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
