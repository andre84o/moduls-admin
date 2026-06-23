"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerDialog } from "./customer-dialog";
import type { AdminCustomer } from "../../types";

function fullName(c: AdminCustomer): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name;
}

function initials(c: AdminCustomer): string {
  const parts = [c.firstName, c.lastName].filter(Boolean) as string[];
  const source = parts.length ? parts : c.name.split(/\s+/);
  return source
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CustomersSection({ customers }: { customers: AdminCustomer[] }) {
  // `selected` opens an existing customer; `creating` opens an empty one.
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [creating, setCreating] = useState(false);

  const dialogOpen = selected !== null || creating;

  return (
    <div>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your customers and their details.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <UserPlus />
          Add customer
        </Button>
      </header>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-xs">No.</TableHead>
              <TableHead className="text-xs">Customer</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No customers yet.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(c)}
                >
                  <TableCell className="text-sm font-medium tabular-nums text-muted-foreground">
                    {c.number != null ? `#${c.number}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-slate-800 text-xs font-semibold text-white">
                        {initials(c)}
                      </span>
                      <span className="text-sm font-medium">{fullName(c)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatJoined(c.joinedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <CustomerDialog
        customer={selected}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setCreating(false);
          }
        }}
      />
    </div>
  );
}
