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

預期未來 runtime flow：

1. UI 優先讀本機資料層
2. 離線寫入先落本機資料庫與 operation queue
3. sync engine 背景 push pending operations 到 server
4. server 以 `version` 檢查衝突
5. client pull 最新變更並回寫本機資料庫

目前不實作：

- IndexedDB local store
- operation queue runtime
- sync API
- conflict resolution UI

詳細設計請見 [offline-sync-design.md](/Users/mawer/WebstormProjects/Nadi/docs/offline-sync-design.md)。

## Intentional Omissions In Current Build

目前正式執行中的系統尚未包含：

- Offline sync
- Background sync worker
- AI insights
- Photo upload
- Queues、Redis、microservices
