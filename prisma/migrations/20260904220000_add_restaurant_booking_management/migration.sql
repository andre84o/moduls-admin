ALTER TABLE "restaurant_booking_details"
ADD COLUMN "managementToken" TEXT;

CREATE UNIQUE INDEX "restaurant_booking_details_managementToken_key"
ON "restaurant_booking_details"("managementToken");
