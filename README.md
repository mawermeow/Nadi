<p align="center">
  <img src="./public/logo/nadi-logo.png" alt="Nadi logo" width="220" />
</p>

# Nadi

> 記錄自己的生活訊號

<p align="center">
  <a href="#readme-zh">中文版</a>
</p>

Nadi is a personal life-signal tracking system. Users can define their own tracking items, record daily signals, and review summary and correlation reports over a chosen date range.

## Project Status

Nadi is currently an MVP built with Next.js, Drizzle ORM, and PostgreSQL.

Implemented today:

- Custom tracking items
- Daily record creation and timeline view
- Summary report API and UI
- Correlation report API and UI
- Local-first foundation with IndexedDB
- Foreground sync foundation and device/account linking

Still in progress or out of scope for now:

- Full conflict resolution UX
- Reliable background sync on mobile platforms
- Photo upload
- Production hardening beyond MVP scope

## Features

- Custom items for metrics or symptoms
- Multiple value types: number, boolean, scale, text
- Record history with timestamps and notes
- Summary reports for recent data review
- Correlation reports between symptoms and other records
- Archived items to preserve historical meaning
- Local-first write flow backed by IndexedDB
- Sync queue and device-link foundation for future multi-device use

## Tech Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Drizzle ORM
- PostgreSQL / Neon Postgres
- Better Auth
- Vitest
- pnpm

## Screenshots

Branding asset:

<p>
  <img src="./public/logo/logo.svg" alt="Nadi mark" width="120" />
</p>

UI screenshots are not documented in the repository yet.

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Use `.envrc` for local secrets management. `.env.example` is documentation only and must not contain real credentials.

Recommended local variables:

```env
DATABASE_URL=
DIRECT_DATABASE_URL=
AUTH_SECRET=
AUTH_URL=http://localhost:3000

NADI_APP_MODE=local
NADI_DEBUG=false
NADI_ENABLE_OFFLINE_SYNC=false

NADI_REPORT_MAX_RANGE_DAYS=365
NADI_CORRELATION_DEFAULT_WINDOW_HOURS=24
NADI_CORRELATION_MIN_SAMPLE_SIZE=5
```

Recommended `.envrc` pattern:

```bash
source_env_if_exists ~/Secrets/Nadi/dev.env
```

### 3. Start the development app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local Database

If you want a local PostgreSQL instance for development:

```bash
pnpm db:docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

See [docs/local-docker.md](docs/local-docker.md) for the full setup flow.

## Available Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:push
pnpm db:studio
```

## Repository Guide

- [docs/slides/](docs/slides/): system design slide deck (GitHub Pages)
- [docs/system-design.md](docs/system-design.md): product and system design overview
- [docs/architecture.md](docs/architecture.md): runtime architecture and local-first direction
- [docs/api-design.md](docs/api-design.md): API shape and contracts
- [docs/database-schema.md](docs/database-schema.md): database model notes
- [docs/roadmap.md](docs/roadmap.md): planned phases
- [docs/offline-sync-design.md](docs/offline-sync-design.md): offline/local-first sync design

---

<a id="readme-zh"></a>

# Nadi 中文版

> 記錄自己的生活訊號

Nadi 是一個個人 life-signal tracking system。使用者可以自訂追蹤項目、記錄日常訊號，並在指定時間區間內查看 summary reports 與 correlation reports。

## 專案狀態

Nadi 目前是以 Next.js、Drizzle ORM 與 PostgreSQL 建構中的 MVP。

目前已實作：

- 自訂 tracking items
- Daily records 建立與 timeline view
- Summary report API 與 UI
- Correlation report API 與 UI
- 以 IndexedDB 為基礎的 local-first foundation
- Foreground sync foundation 與 device/account linking

目前尚未完成或暫不在範圍內：

- 完整 conflict resolution UX
- 行動平台可靠的背景同步
- Photo upload
- 超出 MVP 範圍的 production hardening

## 功能

- 可自訂 metric 或 symptom 類型的 items
- 支援 `number`、`boolean`、`scale`、`text` 多種 value type
- 可記錄帶時間戳與 note 的歷史資料
- 可查看 summary reports
- 可探索 symptom 與其他紀錄之間的 correlation reports
- 支援 archived items，保留歷史資料語意
- 以 IndexedDB 為基礎的 local-first 寫入流程
- 為未來多裝置使用預留 sync queue 與 device-link 基礎

## 技術棧

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Drizzle ORM
- PostgreSQL / Neon Postgres
- Better Auth
- Vitest
- pnpm

## 快速開始

### 1. 安裝依賴

```bash
pnpm install
```

### 2. 設定環境變數

本機 secrets 建議透過 `.envrc` 管理。`.env.example` 只作說明用途，不應填入真實憑證。

建議的本機變數：

```env
DATABASE_URL=
DIRECT_DATABASE_URL=
AUTH_SECRET=
AUTH_URL=http://localhost:3000

NADI_APP_MODE=local
NADI_DEBUG=false
NADI_ENABLE_OFFLINE_SYNC=false

NADI_REPORT_MAX_RANGE_DAYS=365
NADI_CORRELATION_DEFAULT_WINDOW_HOURS=24
NADI_CORRELATION_MIN_SAMPLE_SIZE=5
```

建議的 `.envrc` 寫法：

```bash
source_env_if_exists ~/Secrets/Nadi/dev.env
```

### 3. 啟動開發環境

```bash
pnpm dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

## 本機資料庫

若你要在本機啟動 PostgreSQL 開發環境：

```bash
pnpm db:docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

完整流程請看 [docs/local-docker.md](docs/local-docker.md)。

## 可用 Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:push
pnpm db:studio
```

## 文件導覽

- [docs/slides/](docs/slides/): system design 簡報（GitHub Pages）
- [docs/system-design.md](docs/system-design.md): 產品與系統設計概觀
- [docs/architecture.md](docs/architecture.md): runtime architecture 與 local-first 方向
- [docs/api-design.md](docs/api-design.md): API 介面與資料契約
- [docs/database-schema.md](docs/database-schema.md): database schema 說明
- [docs/roadmap.md](docs/roadmap.md): 開發階段規劃
- [docs/offline-sync-design.md](docs/offline-sync-design.md): offline/local-first sync 設計
