# Database Schema

Phase 1 establishes the database foundation only. Drizzle schema in `db/schema.ts` is the single source of truth.

## Tables

### users

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `email` | `text` | Unique user email. |
| `created_at` | `timestamptz` | Creation timestamp. |

### items

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | Owner, references `users.id`. |
| `title` | `text` | Item title. |
| `type` | `item_type` | `metric` or `symptom`. |
| `unit` | `text` | Optional display unit. |
| `value_type` | `item_value_type` | `number`, `boolean`, `scale`, or `text`. |
| `scale_min` | `integer` | Optional lower bound for scale items. |
| `scale_max` | `integer` | Optional upper bound for scale items. |
| `archived` | `boolean` | Soft archive flag, defaults to `false`. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Update timestamp. |

### records

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | Owner, references `users.id`. |
| `item_id` | `uuid` | References `items.id`. |
| `value_number` | `integer` | Numeric value slot. |
| `value_text` | `text` | Text value slot. |
| `value_boolean` | `boolean` | Boolean value slot. |
| `recorded_at` | `timestamptz` | UTC event timestamp. |
| `note` | `text` | Optional note. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Update timestamp. |

### report_snapshots

This table is schema-only in Phase 1. No report endpoints or calculation flow are implemented yet.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | Owner, references `users.id`. |
| `report_type` | `report_type` | `summary` or `correlation`. |
| `from_date` | `text` | Inclusive range start. |
| `to_date` | `text` | Inclusive range end. |
| `result_json` | `jsonb` | Stored snapshot payload. |
| `created_at` | `timestamptz` | Creation timestamp. |

## Indexes

- `users_email_idx`
- `items_user_id_idx`
- `items_user_type_idx`
- `items_user_archived_idx`
- `records_user_recorded_at_idx`
- `records_user_item_recorded_at_idx`
- `records_item_recorded_at_idx`
- `report_snapshots_user_range_idx`
