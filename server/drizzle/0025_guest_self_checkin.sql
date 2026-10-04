ALTER TABLE "room_bookings" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD COLUMN "checked_in_at" text;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD COLUMN "checked_out_at" text;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD COLUMN "checked_in_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "room_bookings_access_token_idx" ON "room_bookings" ("access_token");
