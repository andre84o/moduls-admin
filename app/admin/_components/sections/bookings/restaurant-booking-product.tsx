"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RestaurantBookingsSection } from "./restaurant-bookings";
import { RestaurantAvailabilityAdmin } from "./restaurant-availability-admin";
import type {
  AdminRestaurantBlockedPeriod,
  AdminRestaurantBooking,
  AdminRestaurantServicePeriod,
  AdminRestaurantTable,
  AdminRestaurantZone,
  RestaurantBookingSettingsInput,
} from "@/modules/restaurant-booking/types";

export function RestaurantBookingProduct({
  settings,
  zones,
  unzonedTables,
  bookings,
  servicePeriods,
  blockedPeriods,
}: {
  settings: RestaurantBookingSettingsInput;
  zones: AdminRestaurantZone[];
  unzonedTables: AdminRestaurantTable[];
  bookings: AdminRestaurantBooking[];
  servicePeriods: AdminRestaurantServicePeriod[];
  blockedPeriods: AdminRestaurantBlockedPeriod[];
}) {
  const [section, setSection] = useState<"reservations" | "availability">("reservations");

  return (
    <div>
      <div className="mb-6 flex gap-2 rounded-lg border bg-background p-1">
        <Button type="button" size="sm" variant={section === "reservations" ? "secondary" : "ghost"} onClick={() => setSection("reservations")}>
          Reservations
        </Button>
        <Button type="button" size="sm" variant={section === "availability" ? "secondary" : "ghost"} onClick={() => setSection("availability")}>
          Availability
        </Button>
      </div>

      {section === "reservations" ? (
        <RestaurantBookingsSection settings={settings} zones={zones} unzonedTables={unzonedTables} bookings={bookings} />
      ) : (
        <RestaurantAvailabilityAdmin
          servicePeriods={servicePeriods}
          blockedPeriods={blockedPeriods}
        />
      )}
    </div>
  );
}
