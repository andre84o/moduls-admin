-- Add RESTAURANT to ProjectType enum.
-- Applied directly via prisma db execute (migration history had drift from
-- prior db-push changes). This file records the change for history.
ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'RESTAURANT';
