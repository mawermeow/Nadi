# Database Schema

`db/schema.ts` 仍是資料庫結構的唯一來源。

本文件目前描述：

- 現行正式 schema
- Phase A 的 schema preparation
- Phase B 的 server contract 使用情況

目前 schema 已可支援 Phase B server contract：

- 新增 sync metadata 欄位
- `deleted_at` 已開始被 items / records delete API 使用
- `version` 已開始被 items / records update API 使用於 version check
- `device_id` 目前仍只是預留

目前仍未實作：

- sync API
- IndexedDB local store
- operation queue

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
| `archived` | `boolean` | Product-level archive flag, defaults to `false`. |
| `sync_status` | `sync_status` | Sync state, server-side default `synced`. |
| `version` | `integer` | Version field, default `1`. |
| `deleted_at` | `timestamptz` | Soft delete tombstone. |
| `last_synced_at` | `timestamptz` | Last successful sync time placeholder. |
| `device_id` | `text` | Device identifier placeholder. |
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
| `sync_status` | `sync_status` | Sync state, server-side default `synced`. |
| `version` | `integer` | Version field, default `1`. |
| `deleted_at` | `timestamptz` | Soft delete tombstone. |
| `last_synced_at` | `timestamptz` | Last successful sync time placeholder. |
| `device_id` | `text` | Device identifier placeholder. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Update timestamp. |

Record constraints:

- `value_number`、`value_text`、`value_boolean` 三者中必須且只能有一個有值
- `note` 最多 500 字

### report_snapshots

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
- `items_user_sync_status_idx`
- `items_user_updated_at_idx`
- `items_user_deleted_at_idx`
- `items_user_device_id_idx`
- `items_user_version_idx`
- `records_user_recorded_at_idx`
- `records_user_item_recorded_at_idx`
- `records_item_recorded_at_idx`
- `records_user_sync_status_idx`
- `records_user_updated_at_idx`
- `records_user_deleted_at_idx`
- `records_user_device_id_idx`
- `records_user_version_idx`
- `report_snapshots_user_range_idx`

## Current Semantics

- `sync_status` 目前 server-side default 為 `synced`
- `deleted_at` 現在已被 items / records delete API 使用
- `version` 現在已被 items / records update API 使用於 version check
- `device_id` 目前只是預留，不代表 client 已送出 device id
- `archived` 與 `deleted_at` 不同
- `archived` 是產品層停用狀態
- `deleted_at` 是同步層 soft delete 狀態
- `report_snapshots` 暫不列為第一波 sync 對象
