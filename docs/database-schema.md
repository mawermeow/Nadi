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
- `device_id` 現在已開始參與 sync 與 account linking

目前新增 Phase 9 account system 所需結構：

- `users` 補上 auth 欄位
- `sessions`、`accounts`、`verifications`
- `device_account_links`

## Tables

### users

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `email` | `text` | Unique user email. |
| `email_verified` | `boolean` | Email verification flag for account auth. |
| `name` | `text` | Display name used by auth/session UI. |
| `image` | `text` | Optional avatar URL. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Last update timestamp. |

### sessions

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | References `users.id`, cascade delete. |
| `token` | `text` | Unique session token. |
| `expires_at` | `timestamptz` | Session expiration time. |
| `ip_address` | `text` | Optional device IP snapshot. |
| `user_agent` | `text` | Optional client user-agent snapshot. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Last update timestamp. |

### accounts

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `account_id` | `text` | Provider-side account id; email/password flow 會對應 credential account。 |
| `provider_id` | `text` | Auth provider id. |
| `user_id` | `uuid` | References `users.id`, cascade delete. |
| `access_token` | `text` | Optional provider token. |
| `refresh_token` | `text` | Optional provider refresh token. |
| `id_token` | `text` | Optional provider id token. |
| `access_token_expires_at` | `timestamptz` | Optional access token expiry. |
| `refresh_token_expires_at` | `timestamptz` | Optional refresh token expiry. |
| `scope` | `text` | Optional provider scope. |
| `password` | `text` | Password hash managed by Better Auth. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Last update timestamp. |

### verifications

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `identifier` | `text` | Verification target identifier. |
| `value` | `text` | Verification token payload. |
| `expires_at` | `timestamptz` | Expiration time. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Last update timestamp. |

### device_account_links

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | References `users.id`, cascade delete. |
| `device_id` | `text` | Persistent local device identifier. |
| `linked_at` | `timestamptz` | First time this device was linked to the account. |
| `last_seen_at` | `timestamptz` | Last sync or link activity seen by the server. |
| `last_merged_at` | `timestamptz` | Last time local data merge was confirmed through account sync flow. |
| `created_at` | `timestamptz` | Creation timestamp. |
| `updated_at` | `timestamptz` | Last update timestamp. |

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
- `accounts_provider_account_idx`
- `accounts_user_id_idx`
- `sessions_token_idx`
- `sessions_user_id_idx`
- `sessions_expires_at_idx`
- `verifications_identifier_idx`
- `verifications_expires_at_idx`
- `device_account_links_device_id_idx`
- `device_account_links_user_id_idx`
- `device_account_links_last_seen_at_idx`
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
- `device_id` 現在會由 local device id 帶入 sync push / pull
- `device_account_links` 用來記錄哪台裝置已被哪個帳號接管同步身份
- `archived` 與 `deleted_at` 不同
- `archived` 是產品層停用狀態
- `deleted_at` 是同步層 soft delete 狀態
- `report_snapshots` 暫不列為第一波 sync 對象
