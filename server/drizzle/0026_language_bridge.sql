ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operating_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes_translated" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes_language" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "notes_translated" text;
