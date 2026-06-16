# Offline-first Sync Design

## 目標

在不推翻現有 Next.js + PostgreSQL + Drizzle 架構的前提下，將 Nadi 的資料設計方向調整為 offline-first sync。

目前已進入 Phase D：Client local store skeleton。

目前已完成：

- schema preparation
- server sync contract
- sync push / pull skeleton
- IndexedDB local store skeleton

目前仍未完成：

- background sync
- operation queue persistence
- idempotency persistence
- conflict resolution UI

## 目前狀態

目前系統仍屬於 online-first，但已具備本機資料層骨架與 server sync skeleton。

已具備：

- create API 可接受 client-generated UUID
- update API 已可做 version check
- delete API 已改為 soft delete
- sync push / pull route 已建立
- pull 可回傳 tombstones
- IndexedDB stores：`items`、`records`、`syncOperations`、`syncMeta`
- local repository：item / record / syncOperation / syncMeta
- local write service：先寫本機資料並建立 pending sync operation
- deviceId 會儲存在 `syncMeta`

未具備：

- background sync loop
- reconnect retry
- operation dedup persistence

## Sync Push

Route:

- `POST /v1/sync/push`

Request 包含：

- `deviceId`
- `operations[]`

每筆 operation 目前包含：

- `operationId`
- `entityType`
- `operationType`
- `entityId`
- `baseVersion`
- `payload`
- `clientCreatedAt`
- `clientUpdatedAt`

目前支援 entity：

- `item`
- `record`

目前支援 operation：

- `create`
- `update`
- `delete`

處理方式：

- `create`
  - `entityId` 不存在時建立資料
  - `entityId` 已存在時回 `rejected`
- `update`
  - 使用 `baseVersion` 比對 server `version`
  - mismatch 時回 `conflicts`
  - match 時更新並 `version + 1`
- `delete`
  - 使用 soft delete
  - 設定 `deletedAt`
  - `version + 1`

## Sync Pull

Route:

- `POST /v1/sync/pull`

Request 包含：

- `deviceId`
- `lastPulledAt`

Response 包含：

- `items[]`
- `records[]`
- `tombstones[]`
- `serverTime`

Pull 規則：

- 若沒有 `lastPulledAt`，回傳完整初始資料
- 若有 `lastPulledAt`，回傳 `updatedAt > lastPulledAt` 的變更
- `items[]` / `records[]` 為未 soft delete 的資料
- `tombstones[]` 為已 soft delete 的刪除事件

## Conflict 偵測

目前 conflict 偵測方式很直接：

- 對 `update` / `delete` 比對 `baseVersion`
- 若 `baseVersion !== currentVersion`，回傳 conflict

目前回傳的 conflict 內容包含：

- `operationId`
- `entityType`
- `operationType`
- `entityId`
- `baseVersion`
- `currentVersion`
- `serverEntity`

這一版只做到偵測 conflict，不做自動 merge。

## Tombstone 策略

目前 tombstone 來源是：

- `deletedAt != null` 的 item
- `deletedAt != null` 的 record

pull 時會回傳 tombstones，讓未來 local store 能同步刪除事件，而不只是同步活資料。

## Idempotency 策略

長期方向：

- `operationId` 應被 server 持久化
- 相同 `operationId` 不應重複套用

目前 skeleton 限制：

- 尚未建立 `sync_operations` table
- 尚未儲存 `operationId`
- 尚未做到真正 server-side idempotency

因此目前只是在文件與型別上保留 `operationId`，方便下一階段接續實作。

## Local Store 與 Background Sync

目前已導入 local store skeleton：

- IndexedDB 為主要本機資料庫
- `items`
- `records`
- `syncOperations`
- `syncMeta`

目前 local write flow：

- `createLocalItem`
- `updateLocalItem`
- `deleteLocalItem`
- `createLocalRecord`
- `updateLocalRecord`
- `deleteLocalRecord`

這些 function 目前會：

1. 先寫入 IndexedDB
2. 同時建立 `syncOperation`
3. 將 entity `syncStatus` 設為 `pending`
4. 不直接呼叫 sync API

目前尚未導入：

- background sync
- 自動 retry / reconnect flush

所以這一階段仍只是 local store skeleton：

- UI 主要仍使用既有 API
- IndexedDB 尚未全面接入畫面
- background sync 尚未實作
- PostgreSQL 仍是雲端主資料庫
