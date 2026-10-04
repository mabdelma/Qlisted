ALTER TABLE "tenants" ADD COLUMN "operating_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes_translated" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes_language" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "notes_translated" text;
