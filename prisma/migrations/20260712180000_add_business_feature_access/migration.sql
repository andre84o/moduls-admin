-- CreateTable
CREATE TABLE "business_feature_access" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_feature_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_feature_access_businessId_idx" ON "business_feature_access"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_feature_access_businessId_key_key" ON "business_feature_access"("businessId", "key");

-- AddForeignKey
ALTER TABLE "business_feature_access" ADD CONSTRAINT "business_feature_access_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
