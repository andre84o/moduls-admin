-- Extend the shared `media` table into a central media library for images AND
-- documents that can attach to any entity. Mirrors the Prisma `Media` model.
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Run this on live databases that were created before this change (the demo
-- environment has no database, so it is applied via `prisma db push`/migrate).

-- Kind of file: compressed image vs. stored document.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaKind') THEN
    CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');
  END IF;
END$$;

-- Storage visibility: PUBLIC (website images/logos, permanent url) vs.
-- PRIVATE (all documents + customer files, served via signed URLs). Default
-- PRIVATE so nothing is accidentally exposed. Decided server-side only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaVisibility') THEN
    CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
  END IF;
END$$;

ALTER TABLE media ADD COLUMN IF NOT EXISTS "ownerType"  TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS "ownerId"    TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS "kind"       "MediaKind" NOT NULL DEFAULT 'IMAGE';
ALTER TABLE media ADD COLUMN IF NOT EXISTS "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE media ADD COLUMN IF NOT EXISTS "folder"     TEXT NOT NULL DEFAULT 'general';
ALTER TABLE media ADD COLUMN IF NOT EXISTS "name"       TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS "size"       INTEGER;
ALTER TABLE media ADD COLUMN IF NOT EXISTS "width"      INTEGER;
ALTER TABLE media ADD COLUMN IF NOT EXISTS "height"     INTEGER;

-- `url` was NOT NULL when media only held public property images. Private files
-- (documents, customer files) store no permanent url, so the column must allow
-- NULL. Existing public rows keep their url untouched.
ALTER TABLE media ALTER COLUMN "url" DROP NOT NULL;

-- Pre-existing rows were all public, website-facing property images. Mark them
-- PUBLIC so they keep serving via their permanent url (the column default of
-- PRIVATE only applies to rows inserted from now on).
UPDATE media SET "visibility" = 'PUBLIC' WHERE "url" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "media_businessId_ownerType_ownerId_idx"
  ON media ("businessId", "ownerType", "ownerId");
CREATE INDEX IF NOT EXISTS "media_businessId_kind_idx"
  ON media ("businessId", "kind");
