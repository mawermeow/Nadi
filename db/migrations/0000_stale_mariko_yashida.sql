CREATE TYPE "public"."item_type" AS ENUM('metric', 'symptom');--> statement-breakpoint
CREATE TYPE "public"."item_value_type" AS ENUM('number', 'boolean', 'scale', 'text');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('summary', 'correlation');--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "item_type" NOT NULL,
	"unit" text,
	"value_type" "item_value_type" NOT NULL,
	"scale_min" integer,
	"scale_max" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"value_number" integer,
	"value_text" text,
	"value_boolean" boolean,
	"recorded_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"report_type" "report_type" NOT NULL,
	"from_date" text NOT NULL,
	"to_date" text NOT NULL,
	"result_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "items_user_type_idx" ON "items" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "items_user_archived_idx" ON "items" USING btree ("user_id","archived");--> statement-breakpoint
CREATE INDEX "records_user_recorded_at_idx" ON "records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "records_user_item_recorded_at_idx" ON "records" USING btree ("user_id","item_id","recorded_at");--> statement-breakpoint
CREATE INDEX "records_item_recorded_at_idx" ON "records" USING btree ("item_id","recorded_at");--> statement-breakpoint
CREATE INDEX "report_snapshots_user_range_idx" ON "report_snapshots" USING btree ("user_id","report_type","from_date","to_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");