"use client";

import { RestaurantBookingWidget } from "@/modules/restaurant-booking/components/restaurant-booking-widget";

const MOCK_TIMES = ["17:00", "17:30", "18:30", "19:00", "19:30", "20:30"];

function isoFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function RestaurantBookingDemo() {
  return (
    <RestaurantBookingWidget
      loadAvailability={async ({ date, partySize }) => {
        await new Promise((resolve) => setTimeout(resolve, 450));
        const slots = partySize >= 11
          ? []
          : MOCK_TIMES.map((time) => ({
              startAt: isoFor(date, time),
              endAt: isoFor(date, String(Number(time.slice(0, 2)) + 2).padStart(2, "0") + time.slice(2)),
              available: true,
            }));
        return { date, timezone: "Europe/Stockholm", partySize, slots };
      }}
      submitBooking={async () => {
        await new Promise((resolve) => setTimeout(resolve, 650));
        return { status: "PENDING" };
      }}
    />
  );
}
