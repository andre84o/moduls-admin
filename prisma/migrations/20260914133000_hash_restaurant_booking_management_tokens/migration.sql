-- Management links become tenant-addressable capability tokens. Only SHA-256
-- hashes are persisted; the raw token exists only in the URL/email.
--
-- Legacy tokens intentionally cannot be migrated into the new public format:
-- they do not contain a tenant locator, so accepting them would require reading
-- business-owned data without businessId. Revoking them is required by the
-- shared-SaaS tenant-isolation rule.

CREATE UNIQUE INDEX "restaurant_booking_details_businessId_id_key"
ON "restaurant_booking_details"("businessId", "id");

CREATE TABLE "restaurant_booking_management_tokens" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "restaurantBookingId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_booking_management_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restaurant_booking_management_tokens_businessId_tokenHash_key"
ON "restaurant_booking_management_tokens"("businessId", "tokenHash");

CREATE INDEX "restaurant_booking_management_tokens_businessId_restaurantBookingId_idx"
ON "restaurant_booking_management_tokens"("businessId", "restaurantBookingId");

ALTER TABLE "restaurant_booking_management_tokens"
ADD CONSTRAINT "restaurant_booking_management_tokens_businessId_restaurantBookingId_fkey"
FOREIGN KEY ("businessId", "restaurantBookingId")
REFERENCES "restaurant_booking_details"("businessId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "restaurant_booking_details_managementToken_key";

ALTER TABLE "restaurant_booking_details"
DROP COLUMN IF EXISTS "managementToken";
