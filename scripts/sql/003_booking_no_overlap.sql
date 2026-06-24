-- Prevent overlapping bookings for the same property within a business.
--
-- This is the real race-condition backstop behind the application-level overlap
-- check. The app check is the friendly path; this constraint guarantees no two
-- active bookings can ever occupy the same property + date range concurrently.
--
-- DEFERRED: do NOT run this yet. Apply it only once the booking code actually
-- writes PAYMENT_PENDING / CONFIRMED statuses and proper [startAt, endAt) ranges
-- (Phase 6). Running it earlier is harmless but pointless. When applied, handle
-- the resulting exclusion-violation error gracefully ("those dates were just
-- taken").
--
-- Requires btree_gist so the equality columns (businessId, propertyId) can sit
-- in the same EXCLUDE as the range overlap (&&). tsrange is half-open [start,end).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    "businessId"  WITH =,
    "propertyId"  WITH =,
    tsrange("startAt", "endAt") WITH &&
  )
  WHERE (status IN ('CONFIRMED', 'PAYMENT_PENDING') AND "propertyId" IS NOT NULL);
