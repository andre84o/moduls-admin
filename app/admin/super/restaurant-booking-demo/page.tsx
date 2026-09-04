import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ensureRestaurantBookingDemoSetup } from "@/modules/restaurant-booking/demo-preview";
import { RestaurantBookingDemo } from "./_components/restaurant-booking-demo";

export default async function RestaurantBookingDemoPage() {
  await requireSuperAdmin();
  const { business, ready } = await ensureRestaurantBookingDemoSetup();

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/30 to-background px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto mb-8 flex max-w-5xl flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <LockKeyhole className="size-3.5" />
            Super Admin only
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Restaurant Booking customer preview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            This preview uses the real public Restaurant Booking API against the seeded Demo-projekt tenant. Availability, capacity and bookings come from the real database.
          </p>
          {business && (
            <p className="mt-2 text-xs text-muted-foreground">
              Test tenant: <span className="font-medium text-foreground">{business.name}</span> · slug {business.slug}
            </p>
          )}
        </div>
        <Link
          href="/admin/super/modules"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to modules
        </Link>
      </div>

      {ready ? (
        <RestaurantBookingDemo />
      ) : (
        <div className="mx-auto max-w-2xl rounded-xl border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          Demo-projekt is not available in this environment. A real database and the seeded Demo-projekt tenant are required.
        </div>
      )}
    </div>
  );
}
