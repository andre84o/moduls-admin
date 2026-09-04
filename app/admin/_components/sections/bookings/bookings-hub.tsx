"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminBooking, AdminProperty } from "../../../types";
import type {
  AdminRestaurantBooking,
  AdminRestaurantTable,
  AdminRestaurantZone,
  RestaurantBookingSettingsInput,
} from "@/modules/restaurant-booking/types";
import { BookingsSection } from "./index";
import { RestaurantBookingsSection } from "./restaurant-bookings";

export function BookingsHub({
  bookings,
  properties,
  rentalEnabled,
  restaurantBookingEnabled,
  restaurantBookingSettings,
  restaurantZones,
  unzonedRestaurantTables,
  restaurantBookings,
}: {
  bookings: AdminBooking[];
  properties: AdminProperty[];
  rentalEnabled: boolean;
  restaurantBookingEnabled: boolean;
  restaurantBookingSettings: RestaurantBookingSettingsInput;
  restaurantZones: AdminRestaurantZone[];
  unzonedRestaurantTables: AdminRestaurantTable[];
  restaurantBookings: AdminRestaurantBooking[];
}) {
  const hasBoth = rentalEnabled && restaurantBookingEnabled;
  const [domain, setDomain] = useState<"rental" | "restaurant">(
    restaurantBookingEnabled && !rentalEnabled ? "restaurant" : "rental",
  );

  if (!restaurantBookingEnabled) {
    return <BookingsSection bookings={bookings} properties={properties} />;
  }

  if (!rentalEnabled) {
    return (
      <RestaurantBookingsSection
        settings={restaurantBookingSettings}
        zones={restaurantZones}
        unzonedTables={unzonedRestaurantTables}
        bookings={restaurantBookings}
      />
    );
  }

  return (
    <div>
      {hasBoth && (
        <div className="mb-6 flex gap-2 rounded-lg border bg-background p-1">
          <Button
            type="button"
            size="sm"
            variant={domain === "rental" ? "secondary" : "ghost"}
            onClick={() => setDomain("rental")}
          >
            Rental
          </Button>
          <Button
            type="button"
            size="sm"
            variant={domain === "restaurant" ? "secondary" : "ghost"}
            onClick={() => setDomain("restaurant")}
          >
            Restaurant
          </Button>
        </div>
      )}

      {domain === "rental" ? (
        <BookingsSection bookings={bookings} properties={properties} />
      ) : (
        <RestaurantBookingsSection
          settings={restaurantBookingSettings}
          zones={restaurantZones}
          unzonedTables={unzonedRestaurantTables}
          bookings={restaurantBookings}
        />
      )}
    </div>
  );
}
