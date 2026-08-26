-- Fix WebsitePages whose `title` was incorrectly set to the businessId (a CUID).
-- This happened when a page was seeded before a proper title was passed.
-- The fix derives a readable title from the page `key`.
-- Safe to re-run: only updates rows where the title looks like a CUID.

UPDATE website_pages
SET title = initcap(replace(key, '-', ' '))
WHERE title ~ '^c[a-z0-9]{20,30}$';
