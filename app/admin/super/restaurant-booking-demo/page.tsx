import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RestaurantBookingDemo } from "./_components/restaurant-booking-demo";

export default async function RestaurantBookingDemoPage() {
  await requireSuperAdmin();

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
            This is the guest-facing booking experience only. Availability and submit are mocked here, so the preview never creates a real booking.
          </p>
        </div>
        <Link
          href="/admin/super/modules"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to modules
        </Link>
      </div>

      <RestaurantBookingDemo />
    </div>
  );
}
