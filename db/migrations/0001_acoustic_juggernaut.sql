ALTER TABLE "items" ADD CONSTRAINT "items_title_not_blank_check" CHECK (char_length(trim("items"."title")) > 0);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_scale_config_check" CHECK ((
        ("items"."value_type" = 'scale' and "items"."scale_min" is not null and "items"."scale_max" is not null and "items"."scale_min" < "items"."scale_max")
        or
        ("items"."value_type" <> 'scale' and "items"."scale_min" is null and "items"."scale_max" is null)
      ));