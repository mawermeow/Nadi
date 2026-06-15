ALTER TABLE "records" ALTER COLUMN "value_number" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_single_value_check" CHECK ((
        (case when "records"."value_number" is not null then 1 else 0 end) +
        (case when "records"."value_text" is not null then 1 else 0 end) +
        (case when "records"."value_boolean" is not null then 1 else 0 end)
      ) = 1);--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_note_length_check" CHECK ("records"."note" is null or char_length("records"."note") <= 500);