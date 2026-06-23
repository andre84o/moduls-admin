"use client";

import { useRef, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomer,
  setCustomerStage,
  deleteCustomer,
} from "@/lib/actions";
import type { AdminCustomer, CustomerStage } from "../../types";

const stages: { id: CustomerStage; label: string; next?: CustomerStage }[] = [
  { id: "LEAD", label: "Leads", next: "CONTACTED" },
  { id: "CONTACTED", label: "Contacted", next: "CUSTOMER" },
  { id: "CUSTOMER", label: "Customers" },
];

export function CustomersSection({
  customers,
}: {
  customers: AdminCustomer[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate(formData: FormData) {
    await createCustomer(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage leads and customer relationships through the pipeline.
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>New customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            action={handleCreate}
            className="grid gap-4 sm:grid-cols-3"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" className="mt-1.5" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add customer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {stages.map((stage) => {
          const items = customers.filter((c) => c.stage === stage.id);
          return (
            <Card key={stage.id} className="bg-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  {stage.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {items.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                ) : (
                  items.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.email && (
                            <p className="text-xs text-muted-foreground">
                              {c.email}
                            </p>
                          )}
                          {c.phone && (
                            <p className="text-xs text-muted-foreground">
                              {c.phone}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(() => deleteCustomer(c.id))
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                      {stage.next && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1.5 -ml-2.5 text-amber-600 hover:text-amber-700"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(() =>
                              setCustomerStage(c.id, stage.next!),
                            )
                          }
                        >
                          Move forward
                          <ArrowRight className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
