-- Remove the "cta" field from hero sections for a specific business.
-- Safe to re-run: the - operator is a no-op when the key doesn't exist.
-- Replace the businessId value with the correct one before running.
UPDATE website_sections
SET
  "draftContent"     = "draftContent"     - 'cta',
  "publishedContent" = "publishedContent" - 'cta'
WHERE type = 'hero'
  AND "businessId" = 'REPLACE_WITH_BUSINESS_ID';
