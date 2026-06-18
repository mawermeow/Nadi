# API Design

目前 API 仍以 online-first CRUD 為主，但已逐步補上與 local store 串接的 sync contract。

目前已完成：

- create API 可接受 client-generated UUID
- update API 可接受 `version` 並做 optimistic concurrency check
- items / records delete 已改為 soft delete
- GET list 預設排除 soft-deleted rows
- sync push / pull skeleton 已建立
- sync client 與 foreground sync service 已接上 sync API
- Better Auth email/password registration、login、logout
- account-based session management
- device-to-account linking API

目前尚未完成：

- UI 全面 local-first
- reliable iOS background sync
- 更進一步的裝置管理控制

## Base Rules

- Use REST endpoints under `/v1`.
- Require authenticated user context on all user-owned resources.
- Never accept `user_id` from request bodies as an authorization source.
- Return ISO 8601 strings for date and time values.
- Keep error payloads stable and avoid leaking stack traces.

## Resource Areas

- `GET /v1/items`
- `POST /v1/items`
- `PATCH /v1/items/:itemId`
- `DELETE /v1/items/:itemId`
- `GET /v1/records`
- `POST /v1/records`
- `PATCH /v1/records/:recordId`
- `DELETE /v1/records/:recordId`
- `POST /v1/sync/push`
- `POST /v1/sync/pull`
- `POST /v1/account/device-link`
- `POST /v1/exports`
- `GET /v1/exports/history`
- `POST /v1/imports/validate`
- `POST /v1/backups/recover`
- `GET /v1/ownership/summary`
- `GET /v1/reports/summary`
- `GET /v1/reports/correlation`
- `/api/auth/*` Better Auth handler:
  - `POST /api/auth/sign-up/email`
  - `POST /api/auth/sign-in/email`
  - `POST /api/auth/sign-out`
  - `GET /api/auth/get-session`

AI insights remain outside the current MVP scope.

## Phase 11 Ownership & Export API

### `POST /v1/exports`

建立目前登入使用者自己的資料匯出檔，並同步寫入 export history。

Request body:

```json
{
  "format": "csv"
}
```

Allowed formats:

- `csv`
- `json`
- `full_backup`

Rules:

- 只能匯出 authenticated session user 自己的資料
- `csv` 以人工閱讀與 spreadsheet 使用為主
- `json` 保留完整資料結構，供未來 migration / restore 使用
- `full_backup` 額外包含 schema version、exportedAt、masked user reference 與 device metadata
- response 以 attachment 形式回傳，不在 JSON body 內回傳完整內容

### `GET /v1/exports/history`

回傳目前登入使用者的 export history。

Response shape:

- `history[]`
  - `id`
  - `exportFormat`
  - `fileName`
  - `schemaVersion`
  - `itemCount`
  - `recordCount`
  - `reportSnapshotCount`
  - `deviceCount`
  - `maskedUserReference`
  - `createdAt`

### `POST /v1/imports/validate`

在真正恢復前先檢查 import / backup payload。

Request body:

```json
{
  "payload": {
    "schemaVersion": 1,
    "exportFormat": "full_backup"
  }
}
```

Validation rules:

- 檢查 schema version
- 檢查必要欄位與資料型別
- 檢查 item / record 關聯完整性
- 檢查 duplicate item / record / report snapshot id
- 不直接覆蓋既有資料

### `POST /v1/backups/recover`

只在 validation 通過後才允許套用恢復，並要求明確確認字串。

Request body:

```json
{
  "payload": {
    "schemaVersion": 1,
    "exportFormat": "full_backup"
  },
  "confirmText": "RESTORE"
}
```

Rules:

- recovery flow 採 `preview -> confirm -> apply`
- 若偵測 duplicate 或 schema mismatch，回傳 `409`，不覆蓋既有資料
- 實際寫入以 transaction 執行，匯入失敗時保留原資料不變

### `GET /v1/ownership/summary`

回傳目前登入使用者的雲端 ownership summary。

內容包含：

- cloud item / record / report snapshot counts
- export history count 與 last export time
- devices list（來自 `device_account_links` 與 `sync_device_sessions` 的最小可行整合）

## Transitional Behavior

目前 update API 對既有前端仍保持相容：

- 若 body 有 `version`，server 會檢查 version
- 若 body 沒有 `version`，目前仍暫時允許更新

這是 transitional behavior。未來 offline-first client 應一律傳入 `version`。

## Item API

### `GET /v1/items`

預設只回傳未封存且未 soft delete 的項目。

Query params:

- `includeArchived=true`：包含已封存項目，但仍排除 soft-deleted rows

### `POST /v1/items`

Request body:

```json
{
  "id": "uuid",
  "title": "頭痛程度",
  "type": "symptom",
  "valueType": "scale",
  "sortOrder": 3,
  "scaleMin": 0,
  "scaleMax": 10
}
```

Rules:

- `id` 可選填；若提供則必須是合法 UUID
- 若 `id` 已存在，回傳 `409 conflict`
- 若未提供 `id`，server 仍會自動產生 UUID
- `title` 不可為空
- `type` 只能是 `metric` 或 `symptom`
- `valueType` 只能是 `number`、`boolean`、`scale`、`text`
- `scale` 型項目必須提供 `scaleMin` 與 `scaleMax`
- `sortOrder` 可選填；若未提供，server 會在同一 item type 內自動排到最後

### `PATCH /v1/items/:itemId`

Version 規則：

- 可接受 `version`
- 可接受 `sortOrder`
- 若提供 `version` 且與目前資料不一致，回傳 `409 conflict`
- 若未提供 `version`，目前仍暫時允許更新
- 更新成功後，server 會將 `version + 1`

### `DELETE /v1/items/:itemId`

目前為 soft delete。

Rules:

- 不做 hard delete
- 改為設定 `deletedAt`
- 同步更新 `updatedAt`
- `version + 1`
- response 維持 `{ "success": true }`

目前不做 cascade soft delete：

- soft-deleted item 不會自動把既有 records 一起 soft delete
- 既有 records 仍會留在資料庫
- 預設 record list 會排除 parent item 已 soft delete 的資料

## Record API

### `GET /v1/records`

預設回傳未 soft delete 的近期紀錄，依 `recordedAt` 由新到舊排序。

### `POST /v1/records`

Request body:

```json
{
  "id": "uuid",
  "itemId": "uuid",
  "value": 6.5,
  "recordedAt": "2026-06-15T10:30:00.000Z",
  "note": "午睡後補記"
}
```

Rules:

- `id` 可選填；若提供則必須是合法 UUID
- 若 `id` 已存在，回傳 `409 conflict`
- 若未提供 `id`，server 仍會自動產生 UUID
- `recordedAt` 必須是有效日期
- `note` 可留空，但最多 500 字
- `value` 必須符合 item 的 `valueType`
- archived item 不能建立新紀錄

### `PATCH /v1/records/:recordId`

Version 規則：

- 可接受 `version`
- 若提供 `version` 且與目前資料不一致，回傳 `409 conflict`
- 若未提供 `version`，目前仍暫時允許更新
- 更新成功後，server 會將 `version + 1`

### `DELETE /v1/records/:recordId`

目前為 soft delete，只允許刪除當前登入使用者自己的紀錄。

Rules:

- 不做 hard delete
- 改為設定 `deletedAt`
- 同步更新 `updatedAt`
- `version + 1`
- response 維持 `{ "success": true }`

## Sync API

目前 sync runtime 說明：

- sync 是 foreground / `online` event 驅動
- 未登入時 client 保持 local-only，不送 cloud sync request
- 已登入但未完成 device link 時，client 不自動上傳本機資料
- `navigator.onLine === false` 時 client 不送 sync request
- iOS PWA background sync 不保證可靠，因此目前不依賴真正的 background task
- local store 已接上 sync API，但 UI 尚未全面改為 local-first
- conflict 目前只偵測與標記，不自動覆蓋本機資料
- pull 需要保留 tombstones，讓 client 能同步 soft delete 事件
- server 端 sync identity 一律以 authenticated session user 為準

## `POST /v1/sync/push`

Request body:

```json
{
  "deviceId": "device-local",
  "operations": [
    {
      "operationId": "op-uuid",
      "entityType": "record",
      "operationType": "update",
      "entityId": "uuid",
      "baseVersion": 2,
      "payload": {
        "value": 7,
        "recordedAt": "2026-06-16T01:00:00.000Z"
      },
      "clientCreatedAt": "2026-06-16T00:00:00.000Z",
      "clientUpdatedAt": "2026-06-16T01:00:00.000Z"
    }
  ]
}
```

Supported entities:

- `item`
- `record`

Supported operations:

- `create`
- `update`
- `delete`

Validation rules:

- `deviceId` 必填
- `operationId` 必填
- `entityType` 必須是 `item | record`
- `operationType` 必須是 `create | update | delete`
- `entityId` 必須是合法 UUID
- `baseVersion` 對 `update` / `delete` 必填
- `payload` 會依 entity / operation 做基本驗證

Response body:

```json
{
  "accepted": [],
  "rejected": [],
  "conflicts": [],
  "deviceSession": {
    "deviceId": "device-local",
    "lastSeenAt": "2026-06-16T12:00:00.000Z",
    "lastSyncStartedAt": "2026-06-16T12:00:00.000Z",
    "lastSyncCompletedAt": "2026-06-16T12:00:00.000Z",
    "lastPushAt": "2026-06-16T12:00:00.000Z",
    "lastPullAt": null,
    "lastCheckpointAt": null,
    "lastCheckpointCursor": null,
    "lastSyncStatus": "synced",
    "lastErrorCode": null,
    "lastErrorAt": null
  },
  "diagnostics": {
    "duplicateOperationCount": 0,
    "acceptedOperationCount": 1,
    "rejectedOperationCount": 0,
    "conflictOperationCount": 0,
    "pulledItemCount": 0,
    "pulledRecordCount": 0,
    "pulledTombstoneCount": 0
  },
  "serverTime": "2026-06-16T12:00:00.000Z"
}
```

Push 規則：

- `create`
  - 若 `entityId` 不存在，建立資料
  - 若 `entityId` 已存在，回 `rejected`
- `update`
  - 使用 `baseVersion` 檢查版本
  - 若版本不一致，回 `conflicts`
  - 若版本一致，更新資料並 `version + 1`
- `delete`
  - 使用 soft delete
  - 設定 `deletedAt`
  - `version + 1`
- server 會持久化 `operationId` receipt，重送同一筆 operation 時應 replay 既有結果，不重複建立資料
- diagnostics logging 只保留 operation metadata、version、error code，不保留完整私人紀錄內容

Conflict 偵測方式：

- compare `baseVersion` with current server `version`
- mismatch 時回傳 `currentVersion` 與 `serverEntity`

Client side handling：

- `accepted`：標記 local operation `synced`，同步更新 local entity `version`、`syncStatus`、`lastSyncedAt`
- `rejected`：標記 local operation / entity `failed`，保留 `lastError`
- `conflicts`：標記 local operation / entity `conflict`，不自動覆蓋本機資料

## `POST /v1/account/device-link`

用途：

- 把本機 `deviceId` 明確連結到目前登入帳號
- 作為 local-first merge 的顯式確認步驟
- 避免一登入就自動覆蓋或自動推送本機 pending changes

Request body:

```json
{
  "deviceId": "device-local",
  "localItemCount": 8,
  "localRecordCount": 42,
  "pendingOperationCount": 5,
  "forceRelink": false
}
```

Rules:

- route 必須登入
- `deviceId` 必填
- server 不接受 `userId`，一律從 session 推導
- 若同一 `deviceId` 已綁到其他帳號，預設回 `409 conflict`
- 只有使用者明確改綁時才可送 `forceRelink=true`

Response body:

```json
{
  "deviceLink": {
    "userId": "uuid",
    "deviceId": "device-local",
    "linkedAt": "2026-06-16T12:00:00.000Z",
    "lastSeenAt": "2026-06-16T12:00:00.000Z",
    "lastMergedAt": null
  },
  "requiresLocalMerge": true
}
```

Merge semantics:

- `requiresLocalMerge=true` 代表本機仍有 items / records / pending operations，需要後續跑 sync
- 真正的 local-to-cloud merge 仍透過既有 `push` / `pull` flow 執行
- server 不會因登入就直接覆蓋其他裝置的 pending changes

## `POST /v1/sync/pull`

Request body:

```json
{
  "deviceId": "device-local",
  "lastPulledAt": "2026-06-16T00:00:00.000Z",
  "checkpoint": {
    "until": "2026-06-16T12:00:00.000Z",
    "cursor": "{\"updatedAt\":\"2026-06-16T09:00:00.000Z\",\"entityType\":\"item\",\"entityId\":\"uuid\"}",
    "limit": 100
  }
}
```

Response body:

```json
{
  "items": [],
  "records": [],
  "tombstones": [],
  "checkpoint": {
    "since": "2026-06-16T00:00:00.000Z",
    "until": "2026-06-16T12:00:00.000Z",
    "nextCursor": null,
    "hasMore": false,
    "limit": 100,
    "returnedCount": 0
  },
  "deviceSession": {
    "deviceId": "device-local",
    "lastSeenAt": "2026-06-16T12:00:00.000Z",
    "lastSyncStartedAt": "2026-06-16T12:00:00.000Z",
    "lastSyncCompletedAt": "2026-06-16T12:00:00.000Z",
    "lastPushAt": "2026-06-16T11:58:00.000Z",
    "lastPullAt": "2026-06-16T12:00:00.000Z",
    "lastCheckpointAt": "2026-06-16T12:00:00.000Z",
    "lastCheckpointCursor": null,
    "lastSyncStatus": "synced",
    "lastErrorCode": null,
    "lastErrorAt": null
  },
  "diagnostics": {
    "duplicateOperationCount": 0,
    "acceptedOperationCount": 0,
    "rejectedOperationCount": 0,
    "conflictOperationCount": 0,
    "pulledItemCount": 0,
    "pulledRecordCount": 0,
    "pulledTombstoneCount": 0
  },
  "serverTime": "2026-06-16T12:00:00.000Z"
}
```

Pull 規則：

- 若沒有 `lastPulledAt`，回傳完整初始資料
- 若有 `lastPulledAt`，回傳 `updatedAt > lastPulledAt` 且 `updatedAt <= checkpoint.until` 的變更
- `items[]` / `records[]` 只放尚未 soft delete 的資料
- `tombstones[]` 放 `deletedAt != null` 的刪除事件
- 若資料量過大，server 可回 `checkpoint.hasMore=true` 與 `nextCursor`，client 必須在同一個 `until` watermark 下繼續拉取
- client 只有在 `hasMore=false` 時才應推進本機 `lastPulledAt`

Tombstone 用途：

- 讓未來 client local store 能知道刪除事件
- sync pull 不只回傳活資料，也要回傳刪除事件
- client 收到 tombstone 時，會對對應 local entity 套用 soft delete

## Idempotency Note

目前 server 已透過 `sync_operation_receipts` 持久化 `operationId`，用來：

- 避免 push retry 重複建立 item / record
- 在多裝置不穩定網路下 replay 同一筆 operation 的既有結果
- 讓 conflict / reject 有 server-side traceability

## Reports

報表查詢目前已排除 soft-deleted `items` / `records`。
