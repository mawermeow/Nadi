# Offline-first Sync Design

## 目標

在不推翻現有 Next.js + PostgreSQL + Drizzle 架構的前提下，將 Nadi 的資料設計方向調整為 offline-first sync。

目前已進入 Phase F：Local-first UI integration。

目前已完成：

- schema preparation
- server sync contract
- sync push / pull skeleton
- IndexedDB local store skeleton
- foreground sync client / service
- online / offline network monitor
- sync state store
- local-first items / records UI

目前仍未完成：

- reliable iOS background task integration
- conflict resolution UI
- UI 全面 local-first 化
- reports UI 仍部分依賴 server API

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
- sync client：負責 `push` / `pull` request validation、response parsing、error handling
- foreground sync service：`pushPendingOperations()`、`pullRemoteChanges()`、`runSync()`、`retryFailedOperations()`
- network helper：監聽 `online` / `offline` event
- sync state：`idle`、`syncing`、`offline`、`error`、`conflict`
- Dashboard / 新增紀錄 / 紀錄列表 / 設定頁已優先讀取 IndexedDB
- item / record 核心寫入已改走 local service

仍未具備：

- reliable iOS background sync
- 完整 conflict resolution UI

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

目前已完成：

- `operationId` 會寫入 `sync_operation_receipts`
- server 會 replay 已處理過的 operation 結果，避免 push retry 重複建立資料
- receipt 會保存 outcome、version、error code 與時間戳，供 diagnostics 與 conflict traceability 使用

## Local Store 與 Background Sync

目前已導入 local store 與 foreground sync：

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

目前 sync runtime flow：

1. local write service 先寫入 IndexedDB 並建立 `syncOperation`
2. foreground sync service 讀取 `pending` / `failed` operations
3. online 時 `push` 到 `/v1/sync/push`
4. `accepted` 會把 local entity 與 operation 標記為 `synced`
5. `rejected` 會標記 `failed` 並留下 `lastError`
6. `conflicts` 會標記 `conflict`，但不自動覆蓋本機資料
7. 接著 `pull` `/v1/sync/pull`
8. remote `items` / `records` merge 回 IndexedDB
9. `tombstones` 會回寫 local soft delete
10. 更新 `serverTime`、`lastPulledAt`、`lastSyncedAt`

network 規則：

- `navigator.onLine === false` 時不送 request
- `online` event 觸發 `runSync()`
- `offline` event 只更新 sync state，不強制送 request

UI local-first 規則：

- 前端主要讀寫來源已切到 IndexedDB local store
- 畫面先顯示 local data，再由 foreground sync 更新本機資料
- 線上時背景執行 `runSync()`，同步完成後 UI 重新讀取 local data
- 離線時仍可新增、修改、刪除 items / records
- 每筆資料可標示 `pending` / `failed` / `conflict`
- conflict 目前只標示，不自動解決

Phase 10 補強：

- pull 改為 checkpoint + cursor 分頁，降低多裝置大量變更時的遺漏與不一致
- server 會保存 `sync_device_sessions`，記錄每台裝置最近的 push / pull / checkpoint 狀態
- client 會保存輕量 diagnostics event，不記錄完整私人紀錄內容
- pull tombstone 不會覆蓋本機 `pending` / `failed` / `conflict` 資料

重要限制：

- 目前是 foreground / online event 驅動，不依賴真正的 iOS background task
- iOS PWA background sync 不保證可靠，因此本階段不把它當成正確性前提
- conflict 目前只偵測與標記，不自動 merge 或覆蓋
- pull 會保留 tombstones，避免只同步活資料
- items / records 核心 UI 已 local-first；reports 仍會走既有 server API
- PostgreSQL 仍是雲端主資料庫
