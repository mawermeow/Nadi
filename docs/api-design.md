# API Design

Phase 1 does not implement resource APIs yet. This document records the base conventions that later phases should follow.

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

Reports are intentionally excluded from Phase 1 implementation.
