# API Design

目前 API 仍以 online-first CRUD 為主，但已逐步補上與 local store 串接的 sync contract。

目前已完成：

- create API 可接受 client-generated UUID
- update API 可接受 `version` 並做 optimistic concurrency check
- items / records delete 已改為 soft delete
- GET list 預設排除 soft-deleted rows
- sync push / pull skeleton 已建立
- sync client 與 foreground sync service 已接上 sync API

目前尚未完成：

- UI 全面 local-first
- reliable iOS background sync
- sync operation idempotency persistence
- 完整 conflict resolution UI

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
- `GET /v1/reports/summary`
- `GET /v1/reports/correlation`

AI insights remain outside the current MVP scope.

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

### `PATCH /v1/items/:itemId`

Version 規則：

- 可接受 `version`
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
- `navigator.onLine === false` 時 client 不送 sync request
- iOS PWA background sync 不保證可靠，因此目前不依賴真正的 background task
- local store 已接上 sync API，但 UI 尚未全面改為 local-first
- conflict 目前只偵測與標記，不自動覆蓋本機資料
- pull 需要保留 tombstones，讓 client 能同步 soft delete 事件

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

Conflict 偵測方式：

- compare `baseVersion` with current server `version`
- mismatch 時回傳 `currentVersion` 與 `serverEntity`

Client side handling：

- `accepted`：標記 local operation `synced`，同步更新 local entity `version`、`syncStatus`、`lastSyncedAt`
- `rejected`：標記 local operation / entity `failed`，保留 `lastError`
- `conflicts`：標記 local operation / entity `conflict`，不自動覆蓋本機資料

## `POST /v1/sync/pull`

Request body:

```json
{
  "deviceId": "device-local",
  "lastPulledAt": "2026-06-16T00:00:00.000Z"
}
```

Response body:

```json
{
  "items": [],
  "records": [],
  "tombstones": [],
  "serverTime": "2026-06-16T12:00:00.000Z"
}
```

Pull 規則：

- 若沒有 `lastPulledAt`，回傳完整初始資料
- 若有 `lastPulledAt`，回傳 `updatedAt > lastPulledAt` 的變更
- `items[]` / `records[]` 只放尚未 soft delete 的資料
- `tombstones[]` 放 `deletedAt != null` 的刪除事件

Tombstone 用途：

- 讓未來 client local store 能知道刪除事件
- sync pull 不只回傳活資料，也要回傳刪除事件
- client 收到 tombstone 時，會對對應 local entity 套用 soft delete

## Idempotency Note

`operationId` 的長期設計目標是 server-side idempotency。

未來應做：

- 將 `operationId` 儲存在 server
- server 避免重複套用相同 operation

目前 skeleton 限制：

- 尚未建立 `sync_operations` table
- 尚未持久化 `operationId`
- 若相同 operation 被重送，目前無法保證完整冪等性

## Reports

報表查詢目前已排除 soft-deleted `items` / `records`。
