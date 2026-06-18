CREATE TYPE "public"."export_format" AS ENUM('csv', 'json', 'full_backup');--> statement-breakpoint
CREATE TABLE "export_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"export_format" "export_format" NOT NULL,
	"file_name" text NOT NULL,
	"schema_version" integer NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"report_snapshot_count" integer DEFAULT 0 NOT NULL,
	"device_count" integer DEFAULT 0 NOT NULL,
	"masked_user_reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "export_histories" ADD CONSTRAINT "export_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_histories_user_created_at_idx" ON "export_histories" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "export_histories_user_format_idx" ON "export_histories" USING btree ("user_id","export_format");
