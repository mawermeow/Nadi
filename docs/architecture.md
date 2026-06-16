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

目前 Phase F runtime flow：

1. items / records UI 優先讀取 IndexedDB
2. local write flow 先寫入 IndexedDB 與 `syncOperations`
3. 畫面立即用 local data 更新，不等待 server response
4. foreground sync service 在前景互動或 `online` event 時執行 `runSync()`
5. sync client push `pending` / `failed` operations 到 server
6. server 以 `version` 檢查衝突，回傳 `accepted` / `rejected` / `conflicts`
7. client 更新 local entity sync 狀態
8. client 再 pull 最新 `items` / `records` / `tombstones`
9. remote changes merge 回 IndexedDB，UI 重新讀取 local data

目前仍未完成：

- iOS background task integration 尚未實作
- conflict resolution UI 尚未實作
- reports 與部分 server-rendered fallback 仍依賴既有 API

詳細設計請見 [offline-sync-design.md](/Users/mawer/WebstormProjects/Nadi/docs/offline-sync-design.md)。

## Phase F Status

目前已補上 local-first 核心流程：

- 使用 IndexedDB 作為本機資料層
- 建立 `items`、`records`、`syncOperations`、`syncMeta` store
- 建立 local repository 與 local write service
- 建立 sync client 與 foreground sync service
- 建立 online / offline network monitor
- 建立 sync state store
- Dashboard / 新增紀錄 / 紀錄列表 / 設定頁讀寫已接到 local store

目前仍維持：

- reports 仍主要走既有 API
- foreground sync 不依賴 iOS background task
- PostgreSQL 仍是雲端主資料庫

## Intentional Omissions In Current Build

目前正式執行中的系統尚未包含：

- reliable iOS background sync
- full conflict resolution workflow
- AI insights
- Photo upload
- Queues、Redis、microservices
