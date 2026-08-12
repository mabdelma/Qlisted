ALTER TABLE "loyalty_transactions" ADD COLUMN "order_id" text;--> statement-breakpoint
ALTER TABLE "promo_campaigns" ADD COLUMN "buy_quantity" integer;--> statement-breakpoint
ALTER TABLE "promo_campaigns" ADD COLUMN "get_quantity" integer;--> statement-breakpoint
ALTER TABLE "promo_campaigns" ADD COLUMN "get_discount_percent" double precision DEFAULT 100;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;