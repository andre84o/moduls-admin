import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardStats } from "../../types";

export function OverviewSection({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Properties", value: stats.properties, hint: "in the catalogue" },
    {
      label: "Bookings",
      value: stats.bookings,
      hint: `${stats.pendingBookings} awaiting reply`,
    },
    { label: "Customers", value: stats.customers, hint: "in CRM" },
    {
      label: "Pending",
      value: stats.pendingBookings,
      hint: "bookings to review",
    },
  ];

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Here is a quick summary.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
