import type { Metadata } from "next";
import { RestaurantBookingManagement } from "@/modules/restaurant-booking/components/restaurant-booking-management";
import { getRestaurantBookingManagement } from "@/modules/restaurant-booking/management-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage booking",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default async function RestaurantBookingManagementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getRestaurantBookingManagement(token);

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-background py-16">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Booking link unavailable</h1>
          <p className="mt-3 text-muted-foreground">{result.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background py-16">
      <div className="mx-auto max-w-xl px-4">
        <RestaurantBookingManagement token={token} initialBooking={result.booking} />
      </div>
    </main>
  );
}
