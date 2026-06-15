# API Design

Phase 2 implements the Item API and keeps the same base conventions for later phases.

## Base Rules

- Use REST endpoints under `/v1`.
- Require authenticated user context on all user-owned resources.
- Never accept `user_id` from request bodies as an authorization source.
- Return ISO 8601 strings for date and time values.
- Keep error payloads stable and avoid leaking stack traces.

## Planned Resource Areas

- `GET /v1/items`
- `POST /v1/items`
- `PATCH /v1/items/:itemId`
- `GET /v1/records`
- `POST /v1/records`
- `DELETE /v1/records/:recordId`

Reports are intentionally excluded from the current Phase 2 implementation.

## Item API

### `GET /v1/items`

預設只回傳未封存項目。

Query params:

- `includeArchived=true`：包含已封存項目

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
      "createdAt": "2026-06-15T12:00:00.000Z"
    }
  ]
}
```

### `POST /v1/items`

Request body:

```json
{
  "title": "頭痛程度",
  "type": "symptom",
  "valueType": "scale",
  "scaleMin": 0,
  "scaleMax": 10
}
```

Rules:

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
