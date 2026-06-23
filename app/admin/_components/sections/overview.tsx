import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardStats } from "../../types";

export function OverviewSection({
  stats,
  enabledModules,
}: {
  stats: DashboardStats;
  enabledModules: string[];
}) {
  // Each card belongs to a module and is hidden when that module is disabled.
  const cards = [
    {
      label: "Properties",
      value: stats.properties,
      hint: "in the catalogue",
      module: "RENTAL",
    },
    {
      label: "Bookings",
      value: stats.bookings,
      hint: `${stats.pendingBookings} awaiting reply`,
      module: "BOOKING",
    },
    { label: "Customers", value: stats.customers, hint: "in CRM", module: "CRM" },
    {
      label: "Pending",
      value: stats.pendingBookings,
      hint: "bookings to review",
      module: "BOOKING",
    },
  ];

  const visibleCards = cards.filter((s) => enabledModules.includes(s.module));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Here is a quick summary.
        </p>
      </header>

      {visibleCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCards.map((s) => (
            <Card key={s.label}>
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {s.value}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No modules enabled yet.</p>
      )}
    </div>
  );
}
