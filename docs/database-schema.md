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

Item constraints:

- `title` 不可為空白字串
- `value_type = scale` 時，`scale_min` 與 `scale_max` 必須同時存在
- `value_type = scale` 時，`scale_min < scale_max`
- 非 `scale` 項目不可設定 `scale_min` / `scale_max`

### records

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | Owner, references `users.id`. |
| `item_id` | `uuid` | References `items.id`. |
| `value_number` | `double precision` | Numeric or scale value slot. |
| `value_text` | `text` | Text value slot. |
| `value_boolean` | `boolean` | Boolean value slot. |
| `recorded_at` | `timestamptz` | UTC event timestamp. |
| `note` | `text` | Optional note. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Update timestamp. |

Record constraints:

- `value_number`、`value_text`、`value_boolean` 三者中必須且只能有一個有值
- `note` 最多 500 字

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

## Planned Offline-first Additions

目前正式 schema 尚未加入 sync metadata，但未來 offline-first sync 方向建議為 `items` 與 `records` 補上以下欄位：

| Column | Type | Purpose |
| --- | --- | --- |
| `sync_status` | enum / text | `pending` / `synced` / `conflict` / `failed` |
| `version` | integer | optimistic concurrency control |
| `deleted_at` | `timestamptz` | soft delete tombstone |
| `last_synced_at` | `timestamptz` | 最近一次成功同步時間 |
| `device_id` | `uuid` or `text` | 最後修改來源裝置 |

設計原則：

- `archived` 與 `deleted_at` 不同
- `archived` 是產品層停用狀態
- `deleted_at` 是同步層 soft delete 狀態
- `report_snapshots` 暫不列為第一波 sync 對象

這些欄位目前還未實作，也尚未進行 migration。詳細設計請見 [offline-sync-design.md](/Users/mawer/WebstormProjects/Nadi/docs/offline-sync-design.md)。
