-- Backfill: enable RESTAURANT module for every business that already has an
-- ACTIVE WEBSITE Project. Runs idempotently (ON CONFLICT DO NOTHING).
--
-- Background: RESTAURANT was added as a new ProjectType. Le Rustique (and any
-- other business using restaurant sections) must have RESTAURANT enabled so
-- existing functionality is preserved after deploy. WEBSITE stays unaffected.
--
-- Run this once after deploying the schema migration that adds RESTAURANT to
-- the ProjectType enum.

INSERT INTO "Project" (id, "businessId", name, type, status, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  w."businessId",
  'RESTAURANT',
  'RESTAURANT',
  'ACTIVE',
  NOW(),
  NOW()
FROM "Project" w
WHERE w.type = 'WEBSITE'
  AND w.status = 'ACTIVE'
  -- Skip businesses that already have a RESTAURANT row (idempotent).
  AND NOT EXISTS (
    SELECT 1 FROM "Project" r
    WHERE r."businessId" = w."businessId"
      AND r.type = 'RESTAURANT'
  );
