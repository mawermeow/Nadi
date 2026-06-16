# Offline-first Sync Design

## 目標

在不推翻現有 Next.js + PostgreSQL + Drizzle 架構的前提下，將 Nadi 的資料設計方向調整為 offline-first sync。

目前已進入 Phase B：server sync contract preparation。

目前階段重點：

- 保留既有 API runtime 形狀與前端相容性
- create API 支援 client-generated UUID
- update API 補上 version check
- delete API 改為 soft delete
- 不實作 IndexedDB
- 不新增 sync API
- 不改 UI
- 不改掉既有 PostgreSQL 資料流

核心原則：

- PostgreSQL 仍是雲端主資料庫
- Web / PWA 階段的本機資料層以 IndexedDB 為主
- 不使用 localStorage 作為主要資料庫
- 未來若包成 iOS App，可將本機儲存層替換或擴充為 SQLite
- 所有資料 id 維持 UUID

## 目前現況

目前系統仍屬於 online-first，但已具備部分 sync-ready server contract：

1. Client 直接呼叫 `/v1/items`、`/v1/records`、`/v1/reports/*`
2. Server 驗證使用者與 payload
3. Service / Repository 直接讀寫 PostgreSQL
4. Client 以 API response 更新畫面

目前已具備：

- 所有主要資料使用 UUID
- item 與 record 都有 `created_at` / `updated_at`
- user-owned data 透過 `user_id` 隔離
- item / record schema 已有 sync metadata 欄位
- create API 可接受 client-generated UUID
- update API 已可做 version check
- delete API 已改為 soft delete

目前仍未具備：

- IndexedDB local store
- operation queue
- sync API
- delta sync / batch sync
- conflict resolution UI

## Schema 狀態

### items

目前已存在：

- `sync_status`
- `version`
- `deleted_at`
- `last_synced_at`
- `device_id`

### records

目前已存在：

- `sync_status`
- `version`
- `deleted_at`
- `last_synced_at`
- `device_id`

補充：

- `syncStatus` 目前 server-side default 為 `synced`
- `deletedAt` 現在已開始被 delete API 使用
- `version` 現在已開始被 update API 用於 version check
- `deviceId` 目前只是預留，不代表 client 已送出 device id

## API 狀態

### 已完成的 server contract

- `POST /v1/items`、`POST /v1/records`
  - 可接受 client-generated UUID
  - 未提供 id 時，server 仍會自動產生 UUID
  - 若 id 已存在，回傳 `409 conflict`

- `PATCH /v1/items/:id`、`PATCH /v1/records/:id`
  - 可接受 `version`
  - 若 version 不一致，回傳 `409 conflict`
  - 若 version 一致，server 會將 `version + 1`
  - 若 body 沒有 `version`，目前仍暫時允許更新，屬於 transitional behavior

- `DELETE /v1/items/:id`、`DELETE /v1/records/:id`
  - 改為 soft delete
  - 不再做 hard delete

- `GET /v1/items`、`GET /v1/records`
  - 預設排除 soft-deleted rows

### 尚未完成的部分

- `deviceId` 尚未進入既有 create / update API contract
- sync API 尚未實作
- `updatedAfter` / cursor pull 尚未實作
- accepted / rejected / conflicts / latestChanges 回應格式尚未實作

## Soft Delete 策略

目前：

- item soft delete 不做 cascade soft delete
- record soft delete 只會影響該筆 record

這代表：

- soft-deleted item 不會自動將既有 records 一起 tombstone
- 既有 records 仍保留在資料庫
- 預設 record list 會排除 parent item 已 soft delete 的資料

這是 Phase B 的保守策略，先避免一次重寫過多 domain 行為。

## 後續建議

### Phase C：Sync API

建議新增：

- `POST /v1/sync/push`
- `POST /v1/sync/pull`

預期 response contract：

- `accepted`
- `rejected`
- `conflicts`
- `latestChanges`

### Phase D：Client local store

- 導入 IndexedDB
- 建立 local repositories
- UI 優先讀本機資料

### Phase E：Background sync

- operation queue
- reconnect 後批次同步
- conflict 標示與 retry
