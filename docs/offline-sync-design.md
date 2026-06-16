# Offline-first Sync Design

## 目標

在不推翻現有 Next.js + PostgreSQL + Drizzle 架構的前提下，將 Nadi 的資料設計方向調整為 offline-first sync。

本階段只做設計，不直接實作 IndexedDB、operation queue、sync API 或 schema migration。

核心原則：

- PostgreSQL 仍是雲端主資料庫
- Web / PWA 階段的本機資料層以 IndexedDB 為主
- 不使用 localStorage 作為主要資料庫
- 未來若包成 iOS App，可將本機儲存層替換或擴充為 SQLite
- 所有資料 id 維持 UUID
- 不改掉目前既有 PostgreSQL request/response 資料流

## 目前現況

目前系統屬於 online-first：

1. Client 直接呼叫 `/v1/items`、`/v1/records`、`/v1/reports/*`
2. Server 驗證使用者與 payload
3. Service / Repository 直接寫入 PostgreSQL
4. Client 以 API response 更新畫面

目前已具備的基礎：

- 所有主要資料使用 UUID
- item 與 record 都有 `created_at` / `updated_at`
- user-owned data 透過 `user_id` 隔離
- item 已使用 soft archive

目前尚未具備 offline sync 所需能力：

- 沒有本機資料庫抽象層
- 沒有 operation queue
- 沒有 sync metadata 欄位
- 沒有版本衝突檢查
- `records` 刪除仍是 hard delete
- API 沒有 delta sync / batch sync 介面

## 需要調整的 schema 方向

### 1. items

建議未來加上：

- `sync_status`
- `version`
- `deleted_at`
- `last_synced_at`
- `device_id`

說明：

- `archived` 保留原有語意，代表產品層的停用狀態
- `deleted_at` 代表同步層的 soft delete 狀態
- `version` 用於 optimistic concurrency control
- `device_id` 用於追蹤最後一次修改來源裝置

### 2. records

建議未來加上：

- `sync_status`
- `version`
- `deleted_at`
- `last_synced_at`
- `device_id`

說明：

- 現在 `DELETE /v1/records/:recordId` 是 hard delete，未來需改為 soft delete
- list query 預設需排除 `deleted_at is not null`
- reports 預設也需排除已刪除資料

### 3. report_snapshots

目前不建議優先做 offline sync。

理由：

- report snapshots 可視為衍生資料
- 先同步 source-of-truth 的 items / records 即可
- 未來若需要快取報表，可在本機另設 report cache store，而不是先把 snapshot sync 複雜化

### 4. operation queue

建議新增獨立本機 store，不先放進 PostgreSQL 主 schema。

Web / PWA 階段建議存在 IndexedDB，例如：

```ts
type PendingOperation = {
  id: string;
  userId: string;
  deviceId: string;
  entityType: 'item' | 'record';
  entityId: string;
  operationType: 'create' | 'update' | 'delete';
  payload: unknown;
  baseVersion: number | null;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
};
```

這個 queue 屬於 client sync engine 的狀態，不應直接混進 domain table。

## 建議的共用 sync metadata

未來所有可同步的主要資料列，建議具備下列欄位：

```ts
type SyncMetadata = {
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
  lastSyncedAt: Date | null;
  deviceId: string | null;
};
```

欄位語意：

- `syncStatus`
  - `pending`：本機已寫入，但尚未同步完成
  - `synced`：本機與 server 已對齊
  - `conflict`：同步時發現版本衝突
  - `failed`：同步失敗，但不是版本衝突，例如網路或驗證錯誤
- `version`
  - 每次成功修改後遞增
  - server 作為最終裁決來源
- `deletedAt`
  - 用於 soft delete 與 cross-device tombstone
- `lastSyncedAt`
  - 記錄該列最近一次成功對齊 server 的時間
- `deviceId`
  - 記錄最後一次修改此列的裝置

## API 需要調整的方向

### 目前 API 的主要限制

- `POST /v1/items`、`POST /v1/records` 由 server 直接產生 UUID
- 既有 write API 沒有 `version`
- 既有 delete API 沒有 soft delete semantics
- list API 不支援 `updatedAfter`
- 沒有 batch sync endpoint
- 沒有 conflict payload contract

### 建議保留的相容策略

不要直接移除既有 API。

建議策略：

1. 既有 `/v1/items`、`/v1/records` 先維持可用
2. 之後新增 sync-aware 欄位與 endpoint
3. 本機 sync engine 完成後，再讓 Web client 逐步改走本機資料層

也就是先 additive，再逐步切換，不做一次性重寫。

### 建議新增的 API 能力

### 1. sync-aware mutation contract

未來 `POST` / `PATCH` body 建議接受：

- `id`
- `version`
- `deviceId`

例如：

```json
{
  "id": "uuid",
  "itemId": "uuid",
  "value": 6,
  "recordedAt": "2026-06-16T10:30:00.000Z",
  "note": "晚餐後",
  "version": 3,
  "deviceId": "device-uuid"
}
```

伺服器規則：

- create 時可接受 client 先產生的 UUID
- update / delete 時必須檢查 `version`
- 若 client version 落後，回傳 conflict

### 2. batch sync endpoint

建議新增：

- `POST /v1/sync/pull`
- `POST /v1/sync/push`

或合併為：

- `POST /v1/sync`

MVP sync 階段建議先拆成 `push` / `pull`，比較容易除錯。

#### `POST /v1/sync/push`

Request:

```json
{
  "deviceId": "device-uuid",
  "operations": [
    {
      "id": "operation-uuid",
      "entityType": "record",
      "entityId": "record-uuid",
      "operationType": "update",
      "baseVersion": 2,
      "payload": {
        "note": "補記"
      },
      "createdAt": "2026-06-16T12:00:00.000Z"
    }
  ]
}
```

Response:

```json
{
  "accepted": [],
  "rejected": [],
  "conflicts": [],
  "latestChanges": []
}
```

這四個欄位就是目前要求中最重要的 sync response contract。

#### `POST /v1/sync/pull`

Request:

```json
{
  "deviceId": "device-uuid",
  "cursor": "2026-06-16T00:00:00.000Z"
}
```

Response:

```json
{
  "cursor": "2026-06-16T12:00:00.000Z",
  "changes": []
}
```

`changes` 應包含：

- 新增
- 更新
- soft delete tombstone

### 3. list endpoints 補 delta query

若暫時不做完整 `/v1/sync/pull`，也可先加：

- `GET /v1/items?updatedAfter=...`
- `GET /v1/records?updatedAfter=...`

但這只適合作為過渡方案，不建議當最終 sync protocol。

## 同步策略

## 寫入流程

離線或弱網路時：

1. 使用者在 client 建立或修改資料
2. 先寫入本機資料庫
3. 寫入對應 operation queue
4. UI 立即讀本機資料顯示結果
5. `syncStatus` 標示為 `pending`

恢復連線後：

1. sync worker 讀取 pending operations
2. 依建立順序批次送到 sync push API
3. server 逐筆回傳 accepted / rejected / conflicts
4. client 更新本機列的 `syncStatus`、`version`、`lastSyncedAt`
5. 若有衝突，再拉取 `latestChanges`

## 讀取流程

建議未來調整為：

1. UI 優先讀本機資料庫
2. sync engine 背景 pull 最新資料
3. 本機資料更新後，UI 自動刷新

這樣可以避免畫面完全依賴 API round-trip。

## 衝突處理

server 必須檢查：

- `entityId`
- `userId`
- `version`

基本規則：

- `baseVersion === currentVersion`：接受
- `baseVersion < currentVersion`：回傳 conflict
- `baseVersion > currentVersion`：視為非法或資料異常，回傳 rejected

衝突 response 建議至少包含：

```ts
type SyncConflict = {
  entityType: 'item' | 'record';
  entityId: string;
  reason: 'VERSION_MISMATCH';
  serverVersion: number;
  clientVersion: number;
  serverRecord: unknown;
};
```

MVP 階段建議先做 server-wins + 顯示衝突狀態，不要急著做自動 merge。

## 刪除策略

未來 delete 必須改成 soft delete。

理由：

- 離線刪除需要 tombstone
- 其他裝置需要得知某筆資料已刪除
- 若 hard delete，其他裝置無法可靠同步刪除事件

建議：

- `deleted_at is not null` 視為已刪除
- 預設 list / report query 排除已刪除資料
- sync pull 仍要回傳 tombstone

`items.archived` 與 `deleted_at` 不應混用：

- `archived`：產品層停用
- `deleted_at`：同步層刪除

## 本機資料層建議

本階段不實作，但設計方向建議如下：

### Web / PWA

- IndexedDB 作為主要本機資料庫
- 可考慮未來使用 Dexie 或極薄封裝
- 不使用 localStorage 儲存主要資料

### iOS App 未來方向

- 保留 repository / storage adapter 介面
- Web 使用 IndexedDB adapter
- iOS 可替換為 SQLite adapter

重點不是現在建立過度抽象的 generic framework，而是先讓資料模型與 API contract 能容納這個方向。

## 建議的分階段實作

### Phase A：Schema preparation

只做 additive migration：

- items 新增 sync metadata 欄位
- records 新增 sync metadata 欄位
- 新增必要 index

此階段仍維持既有 API 與 UI flow。

### Phase B：Server sync contract

- 讓 create / update API 能接受 client-provided UUID
- mutation 加入 version 檢查
- records delete 改為 soft delete
- 新增 `/v1/sync/push` 與 `/v1/sync/pull`

### Phase C：Client local store

- 導入 IndexedDB
- 建立 local repositories
- UI 優先讀本機資料
- write 先進 local DB 再進 queue

### Phase D：Background sync

- 網路恢復後自動同步
- conflict 標示與基本重試
- pending / failed / conflict 的 UI 提示

### Phase E：Cross-platform storage adaptation

- 將本機儲存層抽出 adapter
- 視需要提供 SQLite implementation

## 建議的 migration 與 index

未來 schema migration 建議優先 additive：

- `items.version`
- `items.deleted_at`
- `items.last_synced_at`
- `items.device_id`
- `items.sync_status`
- `records.version`
- `records.deleted_at`
- `records.last_synced_at`
- `records.device_id`
- `records.sync_status`

建議 index：

- `(user_id, updated_at desc)`
- `(user_id, deleted_at)`
- `(user_id, sync_status)`

若未來 pull 以 `updated_at` / cursor 為主，`updated_at` 相關 index 會比現在更重要。

## 不建議現在做的事

- 不要一次把所有 UI 改成只讀本機 DB
- 不要直接把 localStorage 當主資料庫
- 不要先引入 iCloud / CloudKit
- 不要把 sync queue 做成 microservice
- 不要現在就抽過度通用的多平台 generic sync framework

## 決策摘要

這個方向的關鍵不是「先做離線」，而是先把資料列、API contract、刪除語意與版本控制整理成未來可同步。

短期內最值得先做的是：

1. 為 items / records 補 sync metadata 欄位設計
2. 將 records delete 改為 soft delete 設計
3. 規劃 batch sync response contract
4. 預留 client-generated UUID 與 version 機制

在這些基礎完成前，不建議直接開始寫 IndexedDB 實作。
