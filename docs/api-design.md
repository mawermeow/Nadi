# API Design

目前正式 API 仍是 online-first CRUD，但已完成 Phase B 的 server sync contract preparation。

目前已具備：

- create API 可接受 client-generated UUID
- update API 可接受 `version` 並做 optimistic concurrency check
- items / records delete 已改為 soft delete
- GET list 預設排除 soft-deleted rows

目前仍未實作：

- sync API
- IndexedDB local store
- operation queue
- conflict resolution UI

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

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "睡眠",
      "type": "metric",
      "unit": "小時",
      "valueType": "number",
      "archived": false,
      "version": 3,
      "createdAt": "2026-06-15T12:00:00.000Z"
    }
  ]
}
```

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

目前支援：

- 更新 `title`
- 更新或清空 `unit`
- 更新 `archived`
- 對 scale item 更新 `scaleMin` / `scaleMax`

`PATCH` 不接受 `user_id`，只會更新當前登入使用者自己的項目。

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

Query params:

- `itemId`
- `from`
- `to`

其中 `from` / `to` 必須同時提供，格式為 ISO 8601。

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

目前支援更新：

- `itemId`
- `value`
- `recordedAt`
- `note`

更新時仍會依據目標 item 的 `valueType` 驗證 `value`。

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

## Summary Report API

### `GET /v1/reports/summary`

Query params:

- `from`
- `to`

Rules:

- `from` / `to` 必填
- 需為 ISO 8601 格式
- 查詢範圍不可超過 `NADI_REPORT_MAX_RANGE_DAYS`
- 只統計目前登入使用者自己的 records

## Correlation Report API

### `GET /v1/reports/correlation`

Query params:

- `symptomItemId`
- `from`
- `to`
- `windowHours`

Rules:

- `symptomItemId` 必須是目前登入使用者自己的 symptom item
- `from` / `to` 必填
- 需為 ISO 8601 格式
- 查詢範圍不可超過 `NADI_REPORT_MAX_RANGE_DAYS`
- `windowHours` 需為正整數，且目前限制在 168 小時內
- 報表只使用目前登入使用者自己的 records
- 結果只描述「可能相關」的模式，不表示因果關係
