"use client";

import { RestaurantBookingWidget } from "@/modules/restaurant-booking/components/restaurant-booking-widget";
import type {
  RestaurantBookingAvailability,
  RestaurantBookingSubmitInput,
  RestaurantBookingSubmitResult,
} from "@/modules/restaurant-booking/components/restaurant-booking-widget";

const PREVIEW_BUSINESS = "demo";

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export function RestaurantBookingDemo() {
  return (
    <RestaurantBookingWidget
      title="Reserve a table · Demo-projekt"
      subtitle="This preview uses the real Restaurant Booking API and writes real demo bookings to the database."
      loadAvailability={async ({ date, partySize }) => {
        const params = new URLSearchParams({
          date,
          partySize: String(partySize),
          previewBusiness: PREVIEW_BUSINESS,
        });
        const response = await fetch(
          `/api/public/restaurant-booking/availability?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as RestaurantBookingAvailability;
      }}
      submitBooking={async (input: RestaurantBookingSubmitInput) => {
        const response = await fetch("/api/public/restaurant-booking/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, previewBusiness: PREVIEW_BUSINESS }),
        });
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as RestaurantBookingSubmitResult;
      }}
    />
  );
}
