-- Backfill the new RENTAL_BOOKING product entitlement for businesses that
-- already had both RENTAL and the shared BOOKING engine active before product
-- entitlements were separated. This preserves existing rental booking access.

INSERT INTO "business_feature_access" (
  "id",
  "businessId",
  "key",
  "enabled",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(r."businessId" || ':RENTAL_BOOKING'),
  r."businessId",
  'RENTAL_BOOKING',
  TRUE,
  NOW(),
  NOW()
FROM "projects" r
WHERE r."type" = 'RENTAL'
  AND r."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1
    FROM "projects" b
    WHERE b."businessId" = r."businessId"
      AND b."type" = 'BOOKING'
      AND b."status" = 'ACTIVE'
  )
ON CONFLICT ("businessId", "key")
DO UPDATE SET
  "enabled" = TRUE,
  "updatedAt" = NOW();
