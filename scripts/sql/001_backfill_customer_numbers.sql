-- Backfill per-business sequential customer numbers for rows created before the
-- `number` column existed. Numbers are assigned per businessId in createdAt order,
-- so each business gets its own 1..N sequence (tenant isolation).
-- Safe to re-run: only fills rows where number IS NULL.
WITH ranked AS (
  SELECT
    id,
    (
      COALESCE(
        (SELECT MAX(c2.number) FROM customers c2 WHERE c2."businessId" = c."businessId"),
        0
      )
      + ROW_NUMBER() OVER (
          PARTITION BY c."businessId"
          ORDER BY c."createdAt" ASC, c.id ASC
        )
    ) AS new_number
  FROM customers c
  WHERE c.number IS NULL
)
UPDATE customers t
SET number = r.new_number
FROM ranked r
WHERE t.id = r.id;
