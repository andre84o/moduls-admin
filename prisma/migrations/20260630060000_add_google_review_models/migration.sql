-- CreateTable
CREATE TABLE "google_review_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "placeId" TEXT,
    "minRating" INTEGER,
    "maxCount" INTEGER NOT NULL DEFAULT 6,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_review_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_review_cache" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_review_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_review_settings_businessId_key" ON "google_review_settings"("businessId");

-- CreateIndex
CREATE INDEX "google_review_settings_businessId_idx" ON "google_review_settings"("businessId");

-- CreateIndex
CREATE INDEX "google_review_cache_businessId_idx" ON "google_review_cache"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "google_review_cache_businessId_placeId_key" ON "google_review_cache"("businessId", "placeId");

-- AddForeignKey
ALTER TABLE "google_review_settings" ADD CONSTRAINT "google_review_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_review_cache" ADD CONSTRAINT "google_review_cache_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
