CREATE TYPE "public"."sync_operation_outcome" AS ENUM('accepted', 'rejected', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."sync_session_status" AS ENUM('idle', 'syncing', 'synced', 'conflict', 'failed');--> statement-breakpoint
CREATE TABLE "sync_device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_started_at" timestamp with time zone,
	"last_sync_completed_at" timestamp with time zone,
	"last_push_at" timestamp with time zone,
	"last_pull_at" timestamp with time zone,
	"last_checkpoint_at" timestamp with time zone,
	"last_checkpoint_cursor" text,
	"last_sync_status" "sync_session_status" DEFAULT 'idle' NOT NULL,
	"last_error_code" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_operation_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"operation_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"outcome" "sync_operation_outcome" NOT NULL,
	"base_version" integer,
	"resulting_version" integer,
	"current_version" integer,
	"reason_code" text,
	"message" text,
	"client_created_at" timestamp with time zone NOT NULL,
	"client_updated_at" timestamp with time zone NOT NULL,
	"entity_updated_at" timestamp with time zone,
	"server_recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_device_sessions" ADD CONSTRAINT "sync_device_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_operation_receipts" ADD CONSTRAINT "sync_operation_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_device_sessions_user_device_idx" ON "sync_device_sessions" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "sync_device_sessions_user_status_idx" ON "sync_device_sessions" USING btree ("user_id","last_sync_status");--> statement-breakpoint
CREATE INDEX "sync_device_sessions_user_checkpoint_idx" ON "sync_device_sessions" USING btree ("user_id","last_checkpoint_at");--> statement-breakpoint
CREATE INDEX "sync_device_sessions_last_seen_at_idx" ON "sync_device_sessions" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_operation_receipts_user_operation_idx" ON "sync_operation_receipts" USING btree ("user_id","operation_id");--> statement-breakpoint
CREATE INDEX "sync_operation_receipts_user_device_recorded_idx" ON "sync_operation_receipts" USING btree ("user_id","device_id","server_recorded_at");--> statement-breakpoint
CREATE INDEX "sync_operation_receipts_user_entity_idx" ON "sync_operation_receipts" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sync_operation_receipts_user_outcome_idx" ON "sync_operation_receipts" USING btree ("user_id","outcome");
