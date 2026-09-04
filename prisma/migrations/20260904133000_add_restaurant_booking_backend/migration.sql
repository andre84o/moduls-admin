-- Restaurant Booking backend models.
-- Core booking rows stay in bookings; restaurant-specific data is kept in
-- restaurant_booking_details so existing rental booking columns stay untouched.

CREATE TYPE "RestaurantConfirmationMode" AS ENUM ('AUTO_CONFIRM', 'REQUEST');

CREATE TABLE "restaurant_booking_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slotIntervalMin" INTEGER NOT NULL DEFAULT 30,
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 120,
    "turnaroundMin" INTEGER NOT NULL DEFAULT 0,
    "minLeadTimeMin" INTEGER NOT NULL DEFAULT 60,
    "bookingHorizonDays" INTEGER NOT NULL DEFAULT 60,
    "maxPartySize" INTEGER NOT NULL DEFAULT 12,
    "confirmationMode" "RestaurantConfirmationMode" NOT NULL DEFAULT 'REQUEST',
    "allowTableCombinations" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "restaurant_booking_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_zones" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "restaurant_zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_tables" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "minSeats" INTEGER NOT NULL DEFAULT 1,
    "maxSeats" INTEGER NOT NULL,
    "combinationGroup" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_booking_details" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "guestPhone" TEXT,
    "partySize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "restaurant_booking_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_tables" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "restaurantBookingId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restaurant_booking_settings_businessId_key"
    ON "restaurant_booking_settings"("businessId");
CREATE INDEX "restaurant_booking_settings_businessId_idx"
    ON "restaurant_booking_settings"("businessId");

CREATE UNIQUE INDEX "restaurant_zones_businessId_name_key"
    ON "restaurant_zones"("businessId", "name");
CREATE INDEX "restaurant_zones_businessId_idx"
    ON "restaurant_zones"("businessId");

CREATE UNIQUE INDEX "restaurant_tables_businessId_name_key"
    ON "restaurant_tables"("businessId", "name");
CREATE INDEX "restaurant_tables_businessId_idx"
    ON "restaurant_tables"("businessId");
CREATE INDEX "restaurant_tables_businessId_zoneId_idx"
    ON "restaurant_tables"("businessId", "zoneId");
CREATE INDEX "restaurant_tables_businessId_combinationGroup_idx"
    ON "restaurant_tables"("businessId", "combinationGroup");

CREATE UNIQUE INDEX "restaurant_booking_details_bookingId_key"
    ON "restaurant_booking_details"("bookingId");
CREATE INDEX "restaurant_booking_details_businessId_idx"
    ON "restaurant_booking_details"("businessId");
CREATE INDEX "restaurant_booking_details_businessId_bookingId_idx"
    ON "restaurant_booking_details"("businessId", "bookingId");

CREATE UNIQUE INDEX "booking_tables_restaurantBookingId_tableId_key"
    ON "booking_tables"("restaurantBookingId", "tableId");
CREATE INDEX "booking_tables_businessId_idx"
    ON "booking_tables"("businessId");
CREATE INDEX "booking_tables_businessId_restaurantBookingId_idx"
    ON "booking_tables"("businessId", "restaurantBookingId");
CREATE INDEX "booking_tables_businessId_tableId_idx"
    ON "booking_tables"("businessId", "tableId");

ALTER TABLE "restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "restaurant_zones"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_tables"
    ADD CONSTRAINT "booking_tables_restaurantBookingId_fkey"
    FOREIGN KEY ("restaurantBookingId") REFERENCES "restaurant_booking_details"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_tables"
    ADD CONSTRAINT "booking_tables_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- These tables are server-managed. RLS is enabled as defense in depth if the
-- public schema is exposed through Supabase Data API; no anon/authenticated
-- policies are created.
ALTER TABLE "restaurant_booking_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restaurant_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restaurant_tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restaurant_booking_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_tables" ENABLE ROW LEVEL SECURITY;
