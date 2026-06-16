# Architecture

## Current Runtime

目前正式資料流仍是 online-first：

1. Client 透過 Next.js App Router 與 Route Handlers 互動
2. Server 驗證使用者與輸入資料
3. Service / Repository 直接讀寫 PostgreSQL
4. UI 以 API response 更新畫面

技術基礎：

- Next.js App Router
- TypeScript
- Tailwind CSS
- Drizzle ORM
- Neon Postgres

## Planned Direction: Offline-first Sync

未來資料架構將朝 offline-first sync 調整，但不會一次重寫目前系統。

目標方向：

- PostgreSQL 保持為雲端主資料庫
- Web / PWA 增加 IndexedDB 本機資料層
- 未來可替換或擴充為 SQLite 本機儲存層
- 保留既有 Route Handlers、Service、Repository 與 Drizzle schema 主軸

目前 Phase E runtime flow：

1. UI 仍以既有 API 為主，IndexedDB 尚未全面成為主要讀取來源
2. local write flow 會先寫入 IndexedDB 與 `syncOperations`
3. foreground sync service 在使用者前景互動或 `online` event 時執行 `runSync()`
4. sync client 先 push `pending` / `failed` operations 到 server
5. server 以 `version` 檢查衝突，回傳 `accepted` / `rejected` / `conflicts`
6. client 更新 local entity sync 狀態
7. client 再 pull 最新 `items` / `records` / `tombstones`
8. remote changes merge 回 IndexedDB，並更新 `lastPulledAt` / `lastSyncedAt`

目前仍未完成：

- IndexedDB 尚未全面接入畫面
- iOS background task integration 尚未實作
- conflict resolution UI 尚未實作

詳細設計請見 [offline-sync-design.md](/Users/mawer/WebstormProjects/Nadi/docs/offline-sync-design.md)。

## Phase E Status

目前已補上 local sync runtime：

- 使用 IndexedDB 作為本機資料層
- 建立 `items`、`records`、`syncOperations`、`syncMeta` store
- 建立 local repository 與 local write service
- 建立 sync client 與 foreground sync service
- 建立 online / offline network monitor
- 建立 sync state store

目前仍維持：

- UI 主要走既有 API
- IndexedDB 尚未全面接入畫面
- foreground sync 不依賴 iOS background task
- PostgreSQL 仍是雲端主資料庫

## Intentional Omissions In Current Build

目前正式執行中的系統尚未包含：

- full local-first UI reads
- reliable iOS background sync
- AI insights
- Photo upload
- Queues、Redis、microservices
