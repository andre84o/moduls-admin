"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminBooking, AdminProperty } from "../../../types";
import type {
  AdminRestaurantBlockedPeriod,
  AdminRestaurantBooking,
  AdminRestaurantServicePeriod,
  AdminRestaurantTable,
  AdminRestaurantZone,
  RestaurantBookingSettingsInput,
} from "@/modules/restaurant-booking/types";
import { BookingsSection } from "./index";
import { RestaurantBookingProduct } from "./restaurant-booking-product";

export function BookingsHub({
  bookings,
  properties,
  rentalBookingEnabled,
  restaurantBookingEnabled,
  restaurantBookingSettings,
  restaurantZones,
  unzonedRestaurantTables,
  restaurantBookings,
  restaurantServicePeriods,
  restaurantBlockedPeriods,
}: {
  bookings: AdminBooking[];
  properties: AdminProperty[];
  rentalBookingEnabled: boolean;
  restaurantBookingEnabled: boolean;
  restaurantBookingSettings: RestaurantBookingSettingsInput;
  restaurantZones: AdminRestaurantZone[];
  unzonedRestaurantTables: AdminRestaurantTable[];
  restaurantBookings: AdminRestaurantBooking[];
  restaurantServicePeriods: AdminRestaurantServicePeriod[];
  restaurantBlockedPeriods: AdminRestaurantBlockedPeriod[];
}) {
  const hasBoth = rentalBookingEnabled && restaurantBookingEnabled;
  const [domain, setDomain] = useState<"rental" | "restaurant">(
    restaurantBookingEnabled && !rentalBookingEnabled ? "restaurant" : "rental",
  );

  const restaurantProduct = (
    <RestaurantBookingProduct
      settings={restaurantBookingSettings}
      zones={restaurantZones}
      unzonedTables={unzonedRestaurantTables}
      bookings={restaurantBookings}
      servicePeriods={restaurantServicePeriods}
      blockedPeriods={restaurantBlockedPeriods}
    />
  );

  if (rentalBookingEnabled && !restaurantBookingEnabled) {
    return <BookingsSection bookings={bookings} properties={properties} />;
  }

  if (!rentalBookingEnabled && restaurantBookingEnabled) return restaurantProduct;
  if (!rentalBookingEnabled && !restaurantBookingEnabled) return null;

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
        restaurantProduct
      )}
    </div>
  );
}
