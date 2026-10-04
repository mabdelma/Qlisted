ALTER TABLE "menu_items" ADD COLUMN "room_service_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "booking_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_booking_id_room_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."room_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_housekeeper_id_users_id_fk" FOREIGN KEY ("housekeeper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_booking_id_idx" ON "orders" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "room_bookings_tenant_checkin_idx" ON "room_bookings" USING btree ("tenant_id","check_in");--> statement-breakpoint
CREATE INDEX "room_bookings_room_status_idx" ON "room_bookings" USING btree ("room_id","status");