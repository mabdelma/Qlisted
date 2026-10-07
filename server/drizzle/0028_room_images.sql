-- Rooms get a photo, like menu items already have.
--
-- Nullable with no backfill: an existing room simply has no image yet, and the
-- UI falls back to the bed icon it already shows.
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "image_url" text;
