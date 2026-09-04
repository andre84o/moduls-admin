ALTER TABLE "restaurant_booking_settings"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Stockholm';

CREATE TABLE "restaurant_service_periods" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "restaurant_service_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_service_periods_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "restaurant_service_periods_start_check" CHECK ("startMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "restaurant_service_periods_end_check" CHECK ("endMinute" BETWEEN 1 AND 1440),
  CONSTRAINT "restaurant_service_periods_range_check" CHECK ("endMinute" > "startMinute")
);

CREATE UNIQUE INDEX "restaurant_service_periods_businessId_weekday_startMinute_endMinute_key"
ON "restaurant_service_periods"("businessId", "weekday", "startMinute", "endMinute");

CREATE INDEX "restaurant_service_periods_businessId_weekday_idx"
ON "restaurant_service_periods"("businessId", "weekday");

CREATE TABLE "restaurant_blocked_periods" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "restaurant_blocked_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_blocked_periods_range_check" CHECK ("endAt" > "startAt")
);

CREATE INDEX "restaurant_blocked_periods_businessId_startAt_endAt_idx"
ON "restaurant_blocked_periods"("businessId", "startAt", "endAt");

ALTER TABLE "restaurant_service_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restaurant_blocked_periods" ENABLE ROW LEVEL SECURITY;
