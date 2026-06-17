ALTER TABLE "items" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "items"
SET "sort_order" = ordered_items.sort_order
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", "type"
      ORDER BY "created_at" ASC, "id" ASC
    ) - 1 AS sort_order
  FROM "items"
  WHERE "deleted_at" IS NULL
) AS ordered_items
WHERE "items"."id" = ordered_items."id";
--> statement-breakpoint
CREATE INDEX "items_user_type_sort_order_idx" ON "items" USING btree ("user_id","type","sort_order");
