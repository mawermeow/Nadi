# Local Docker Database

這份流程提供一個可在本機快速驗證 Phase 1 基礎架構的 PostgreSQL 環境。

## 目的

- 快速啟動一個可用的本機 PostgreSQL
- 驗證 `db/schema.ts` 產生的 migration 是否能正常套用
- 驗證 Next.js app 可連上本機資料庫啟動

## 前置條件

- 已安裝 Docker Desktop 或相容的 Docker Engine
- 本機可使用 `docker compose`
- 已安裝 `pnpm`

## Compose 設計

- Service：`postgres`
- Image：`postgres:16-alpine`
- Host port：`5432`
- Database：`nadi`
- User：`nadi`
- Password：`nadi_local_dev`
- Volume：`nadi_postgres_data`
- Timezone：`UTC`
- Healthcheck：使用 `pg_isready`

這組帳密只用於本機快速測試，不應複製到正式環境。

## Driver 說明

- 本機 Docker PostgreSQL 會透過 `pg` driver 連線
- Neon 環境仍可維持使用 Neon driver
- `pnpm db:migrate` 會優先使用 `DIRECT_DATABASE_URL`，沒有時才退回 `DATABASE_URL`

## 建議的本機設定

將下列內容放進你的 `.envrc` 或本機 `.env`：

```env
DATABASE_URL=postgresql://nadi:nadi_local_dev@localhost:5432/nadi
DIRECT_DATABASE_URL=postgresql://nadi:nadi_local_dev@localhost:5432/nadi

NADI_APP_MODE=local
NADI_DEBUG=false
NADI_ENABLE_OFFLINE_SYNC=false
```

說明：

- `pnpm db:migrate` 與 `drizzle-kit` 現在會主動載入 Next 相容的 env 檔案
- 若你是從 IDE 直接執行 script，放在 `.env` 也能被讀到
- 若你遵循目前專案的 secret 管理規則，仍然建議優先使用 `.envrc`

## 快速流程

1. 啟動 PostgreSQL

```bash
pnpm db:docker:up
```

2. 確認容器已健康啟動

```bash
docker compose ps
```

3. 套用 migration

```bash
pnpm db:migrate
```

4. 載入本機 mock data

```bash
pnpm db:seed
```

5. 啟動開發環境

```bash
pnpm dev
```

6. 開啟應用

```txt
http://localhost:3000
```

## 常用檢查

查看資料庫 logs：

```bash
pnpm db:docker:logs
```

直接進入 `psql`：

```bash
pnpm db:docker:psql
```

查詢現有資料表：

```sql
\dt
```

## 停止流程

停止本機資料庫但保留資料 volume：

```bash
pnpm db:docker:down
```

## 完全重置本機資料庫

若你要完全移除這套本機 PostgreSQL，包含 Docker volume 內的資料，可使用：

```bash
docker compose down -v
```

這會刪除：

- PostgreSQL container
- compose network
- `nadi_postgres_data` volume
- volume 內的所有本機測試資料

這是破壞性操作。執行後，本機資料庫內容無法保留。

若你要在清空後重新建立一個乾淨的本機資料庫，可接著執行：

```bash
pnpm db:docker:up
pnpm db:migrate
pnpm db:seed
```

## 建議驗證順序

最短驗證路徑如下：

1. `pnpm db:docker:up`
2. `pnpm db:migrate`
3. `pnpm db:seed`
4. `pnpm dev`
5. `pnpm db:docker:psql`
6. 在 `psql` 內執行 `\dt`，確認 `users`、`items`、`records`、`report_snapshots`

## 範圍說明

這份本機 Docker 流程目前只提供：

- PostgreSQL 容器
- migration 驗證
- mock seed data
- app 與資料庫的本機連線測試

這份流程目前不包含：

- Neon 雲端環境
- Auth provider
- reports
- offline sync

## Mock Seed 說明

`pnpm db:seed` 會為目前本機 `NADI_APP_MODE=local` 的固定使用者建立一組可重跑的 mock data。

特性：

- 使用固定 UUID，可重複執行而不會無限新增重複資料
- 不會清空你現有的資料表
- 主要覆蓋 `items`、`records`、summary report、correlation report 的驗證情境

內容包含：

- metric items：睡眠時數、飲水量、咖啡、步行、備註心情
- symptom items：頭痛程度、疲勞感、腸胃不適描述
- 1 個 archived item：`舊版壓力量表`
- 約 3 週的 mock records，刻意讓部分頭痛事件出現在低睡眠與有喝咖啡的日子，方便驗證 correlation flow
