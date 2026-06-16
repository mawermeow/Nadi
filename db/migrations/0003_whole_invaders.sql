CREATE TYPE "public"."sync_status" AS ENUM('pending', 'synced', 'conflict', 'failed');--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "sync_status" "sync_status" DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "sync_status" "sync_status" DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "device_id" text;--> statement-breakpoint
CREATE INDEX "items_user_sync_status_idx" ON "items" USING btree ("user_id","sync_status");--> statement-breakpoint
CREATE INDEX "items_user_updated_at_idx" ON "items" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "items_user_deleted_at_idx" ON "items" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "items_user_device_id_idx" ON "items" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "items_user_version_idx" ON "items" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "records_user_sync_status_idx" ON "records" USING btree ("user_id","sync_status");--> statement-breakpoint
CREATE INDEX "records_user_updated_at_idx" ON "records" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "records_user_deleted_at_idx" ON "records" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "records_user_device_id_idx" ON "records" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "records_user_version_idx" ON "records" USING btree ("user_id","version");