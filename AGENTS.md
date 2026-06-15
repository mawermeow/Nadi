# Agent Instructions

## Repository Safety Rules

- 不要批次刪除檔案或資料夾。
- 禁止使用 rm -rf、rmdir /s、rd /s、del /s、Remove-Item -Recurse。
- 若必須刪除檔案，只能一次刪除一個明確檔案路徑。
- 若需要大量清理檔案，停止操作並請使用者手動處理。
- 不要還原使用者變更，除非使用者明確要求執行該還原。
- 手動修改檔案時優先使用 apply_patch。
- 不要提交 .env、API key、database url、auth secret、session secret 或任何私人憑證。
- 不要將使用者的飲食紀錄、睡眠紀錄、症狀紀錄、身體異狀、心理狀態、報表資料或個人資料提交到 git。
- 不要在 logs、tests、debug output 中輸出完整個人健康紀錄。
- 若需要示範資料，必須使用 mock data，不可使用真實個人資料。

## Project Snapshot

- Product: Nadi。
- 核心目標：建立一個個人 life-signal tracking PWA，讓使用者可以自訂紀錄項目，記錄飲食、睡眠、習慣、身體異狀與心理狀態，並透過報表探索時間序列資料之間的相對關聯。
- 專案定位：個人量化生活、自我觀察、資料分析工具，不是醫療診斷工具。
- MVP 暫時維持 Next.js / Vercel / Neon Postgres。
- MVP 暫時不導入照片上傳、AI 診斷、社交功能、複雜 worker、microservice 或 external analytics pipeline。
- MVP 優先支援單人使用或小範圍測試。
- 系統應支援：
    1. 使用者自訂 tracking items。
    2. 使用者建立 daily records。
    3. 使用者記錄 symptoms / body signals。
    4. 使用者查看 summary reports。
    5. 使用者探索 symptoms 與 habits / sleep / food / mood 的關聯。
- 產品語氣：冷靜、克制、觀察式、不製造焦慮、不提供醫療斷言。
- 核心理念：Observe yourself, not optimize yourself.

## Architecture

Expected repository structure:

```txt
app/
  Next.js App Router

components/
  ui/
  forms/
  charts/
  records/
  reports/

features/
  items/
  records/
  reports/
  auth/

lib/
  db/
  auth/
  validation/
  date/
  analytics/

db/
  schema.ts
  migrations/
  seed/

docs/
  system-design.md
  database-schema.md
  api-design.md
  architecture.md
  decisions/
  roadmap.md

public/
  logo/
    logo.svg
    icon.png

tests/
  unit/
  integration/
  e2e/
```

### Runtime Flow

```txt
1. 使用者透過 PWA 操作 UI。
2. Client 呼叫 Next.js Route Handler / Server Action。
3. Auth middleware 驗證使用者身分。
4. Validation layer 驗證輸入資料。
5. Service layer 執行 business logic。
6. Repository / DB layer 存取 Neon Postgres。
7. 回傳 typed response 給前端。
8. 前端更新 UI、charts 或 report view。
```

### Report Flow

```txt
1. 使用者選擇 date range 與 symptom item。
2. API 查詢指定區間內的 records。
3. 系統依 item type 區分 metric / symptom。
4. 系統計算 summary、trend 或 window-based correlation。
5. 回傳 report result。
6. 前端以 chart / table / insight card 呈現。
```

## Domain Rules

- Nadi 是自我觀察工具，不是醫療診斷工具。
- 不要將任何統計關聯描述為因果關係。
- 不要使用「一定是」、「證明」、「診斷為」、「造成」這類斷言。
- 優先使用：
    - 「可能相關」
    - 「可以觀察到」
    - 「在目前資料中呈現」
    - 「樣本數仍不足」
    - 「需要更多紀錄確認」
- 若使用者記錄高風險症狀，例如胸痛、呼吸困難、自傷意念、嚴重過敏、意識異常，系統應提醒使用者尋求專業醫療或緊急協助。
- 不要提供藥物劑量、醫療診斷、治療建議。
- 不要把 correlation report 包裝成醫療結論。
- 產品應鼓勵使用者觀察、整理與溝通，而不是自我診斷。

## Data Modeling Rules

- 使用 PostgreSQL 作為主要資料庫。
- 優先使用明確 schema，不要過早將所有資料塞入 JSONB。
- 每個主要 table 都應包含：
    - id
    - user_id
    - created_at
    - updated_at
- 所有 user-owned data 都必須透過 user_id 隔離。
- API 不應信任 request body 中傳入的 user_id。
- user_id 應從 authentication context 推導。
- item 被刪除時，優先使用 archived，不要直接 hard delete。
- records 應保留歷史語意。若 item title 或 unit 變更，需注意舊資料的解讀。
- recorded_at 應以 UTC 儲存。
- UI 顯示時再依使用者時區轉換。
- 對時間區間查詢，應明確處理 inclusive / exclusive boundary。
- 不要使用中文名稱作為主鍵。
- 所有 id 使用 UUID。

## Database Schema Expectations

Core tables:

```txt
users
items
records
report_snapshots
```

### users

```ts
type User = {
  id: string;
  email: string;
  createdAt: Date;
};
```

### items

```ts
type Item = {
  id: string;
  userId: string;
  title: string;
  type: 'metric' | 'symptom';
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin?: number;
  scaleMax?: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

### records

```ts
type Record = {
  id: string;
  userId: string;
  itemId: string;
  valueNumber?: number;
  valueText?: string;
  valueBoolean?: boolean;
  recordedAt: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

### report_snapshots

```ts
type ReportSnapshot = {
  id: string;
  userId: string;
  reportType: string;
  fromDate: string;
  toDate: string;
  resultJson: unknown;
  createdAt: Date;
};
```

## Drizzle Migration Rules

- Drizzle schema 是資料庫結構的唯一來源。
- 資料庫 schema 變更必須先修改 Drizzle schema 檔案，不要直接手動修改 PostgreSQL tables。
- 預期 schema 位置：

```txt
db/schema.ts
```

- 預期 migration 輸出位置：

```txt
db/migrations/
```

- 當需要修改 table、column、index、enum 或 constraint 時：
    1. 先更新 `db/schema.ts`。
    2. 產生 migration。
    3. 套用前檢查產生出的 SQL migration。
    4. 將 migration 套用到目標資料庫。
    5. 若 schema 變更具有文件意義，同步更新 `docs/database-schema.md`。

- 除非使用者明確要求，否則不要透過 Neon console 手動修改 production database schema。
- 不要在沒有使用者明確確認的情況下執行破壞性 migration。
- 破壞性 migration 包含 drop table、drop column、truncate table、可能造成資料遺失的 column type 變更，或重置 migrations。
- MVP 開發階段優先使用 additive migration：
    - 新增 table。
    - 新增 column。
    - 新增 index。
    - 先新增 nullable field，完成 backfill 後，必要時再改成 required。
- 如果 schema 變更可能造成資料遺失，應停止操作並先說明風險。
- 除非使用者明確確認目標資料庫，否則不要對 production 使用 `drizzle-kit push`。
- shared、staging 或 production database 優先使用 generated migration，不要直接 push schema。
- `drizzle-kit push` 只適合 local development 或 disposable preview database。
- Migration files 應提交到 git。
- Database credentials 必須放在 environment variables，不可提交到 git。

## Index Rules

Recommended indexes:

```sql
CREATE INDEX items_user_id_idx
ON items(user_id);

CREATE INDEX items_user_type_idx
ON items(user_id, type);

CREATE INDEX items_user_archived_idx
ON items(user_id, archived);

CREATE INDEX records_user_recorded_at_idx
ON records(user_id, recorded_at DESC);

CREATE INDEX records_user_item_recorded_at_idx
ON records(user_id, item_id, recorded_at DESC);

CREATE INDEX records_item_recorded_at_idx
ON records(item_id, recorded_at DESC);

CREATE INDEX report_snapshots_user_range_idx
ON report_snapshots(user_id, report_type, from_date, to_date);
```

Rules:
- 新增查詢前，先確認是否已有合適 index。
- 不要為每個 column 都盲目加 index。
- Index 應根據實際 query pattern 設計。
- 常見查詢優先支援：
    - 查詢使用者所有 items。
    - 查詢使用者某段時間 records。
    - 查詢使用者某個 item 的歷史 records。
    - 查詢 report snapshot。

## API Rules

- 預設使用 REST。
- API path 使用複數資源名稱。
- API version prefix 使用 `/v1`。
- 不要在 request body 中要求 user_id。
- 所有 API 必須通過 authentication。
- 所有 mutation 必須做 input validation。
- 錯誤回應應穩定，不要洩漏 stack trace。
- API 回傳資料應避免暴露不必要欄位。
- Date/time 使用 ISO 8601 string。

Expected endpoints:

```txt
GET    /v1/items
POST   /v1/items
PATCH  /v1/items/:itemId

GET    /v1/records
POST   /v1/records
DELETE /v1/records/:recordId

GET    /v1/reports/summary
GET    /v1/reports/correlation
```

## API Data Contracts

### Item

```ts
export type Item = {
  id: string;
  title: string;
  type: 'metric' | 'symptom';
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin?: number;
  scaleMax?: number;
  archived: boolean;
  createdAt: string;
};
```

### CreateItemRequest

```ts
export type CreateItemRequest = {
  title: string;
  type: 'metric' | 'symptom';
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin?: number;
  scaleMax?: number;
};
```

### Record

```ts
export type Record = {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: 'metric' | 'symptom';
  value: number | boolean | string;
  unit?: string;
  recordedAt: string;
  note?: string;
};
```

### CreateRecordRequest

```ts
export type CreateRecordRequest = {
  itemId: string;
  value: number | boolean | string;
  recordedAt: string;
  note?: string;
};
```

### SummaryReport

```ts
export type SummaryReport = {
  from: string;
  to: string;
  metrics: MetricSummary[];
  symptoms: SymptomSummary[];
};
```

### MetricSummary

```ts
export type MetricSummary = {
  itemId: string;
  title: string;
  unit?: string;
  avg?: number;
  min?: number;
  max?: number;
  total?: number;
  count: number;
};
```

### SymptomSummary

```ts
export type SymptomSummary = {
  itemId: string;
  title: string;
  occurrenceCount: number;
  avgSeverity?: number;
};
```

### CorrelationReport

```ts
export type CorrelationReport = {
  symptomItemId: string;
  symptomTitle: string;
  windowHours: number;
  candidates: CorrelationCandidate[];
};
```

### CorrelationCandidate

```ts
export type CorrelationCandidate = {
  itemId: string;
  title: string;
  unit?: string;
  correlationScore: number;
  sampleSize: number;
  description: string;
};
```

## Validation Rules

- title 不可為空。
- item.type 必須是 metric 或 symptom。
- item.valueType 必須是 number、boolean、scale 或 text。
- scale item 必須有 scaleMin 與 scaleMax。
- scaleMin 必須小於 scaleMax。
- record.value 必須符合 item.valueType。
- record.recordedAt 不可為 invalid date。
- note 應限制長度，避免過長內容。
- from / to date range 必須合法。
- report date range 應有最大限制，避免一次查詢過大範圍。

## Analytics Rules

- 前期只做簡單統計，不做醫療推論。
- Correlation 不等於 causation。
- 報表描述必須保留不確定性。
- 樣本數不足時應明確顯示。
- 若 sample size 太小，不應產生強烈結論。
- 建議 report response 包含 sampleSize。
- 任何 insight 都應能追溯到原始 records。
- 報表不應捏造資料。
- 不要把缺失資料補成 0，除非該 item 明確表示「未紀錄視為 0」。

## Offline-first Rules

- MVP 可以先不做完整 offline-first。
- 若實作離線紀錄，使用 IndexedDB 暫存 pending records。
- 離線資料同步時應使用 clientGeneratedId 去重。
- 不要使用 localStorage 儲存大量紀錄或敏感資料。
- localStorage 只能存 UI preference 或非敏感狀態。
- 若同步失敗，應保留 retry queue。
- 不要默默丟棄使用者輸入。

Suggested field:

```ts
clientGeneratedId?: string;
```

Suggested unique index:

```sql
CREATE UNIQUE INDEX records_user_client_generated_id_idx
ON records(user_id, client_generated_id);
```

## UI / UX Rules

- 紀錄流程應盡量低摩擦。
- 常用 item 應容易快速選取。
- 表單應支援手機操作。
- 記錄成功後應提供明確回饋。
- 報表應避免製造焦慮。
- 不要使用醫療診斷式文案。
- Insight card 應使用保守語氣。
- 空狀態應引導使用者建立第一個 item 或第一筆 record。
- Error message 應能幫助使用者修正輸入。
- 不要將 debug diagnostics 顯示給一般使用者。

## Security Rules

- 所有 user-owned tables 必須檢查 user_id。
- 不要從 client 接收 user_id 作為授權依據。
- 不要在 logs 中輸出完整 request body，因為可能包含私人紀錄。
- 不要在 client bundle 中暴露 server secrets。
- DATABASE_URL 僅能在 server-side 使用。
- Auth secret 不可提交。
- Session / token handling 應使用成熟套件。
- 若使用第三方 Auth，仍需在 DB 層保留 user mapping。
- Rate limit 可列為 production hardening，但 MVP 可先不做。
- 匯出資料功能應確認使用者身分。
- Debug mode 只能用於本機或受保護環境。

## Environment Notes

Recommended environment variables:

```env
DATABASE_URL=
DIRECT_DATABASE_URL=

AUTH_SECRET=
AUTH_URL=

NADI_APP_MODE=local
NADI_DEBUG=false
NADI_ENABLE_OFFLINE_SYNC=false

NADI_REPORT_MAX_RANGE_DAYS=365
NADI_CORRELATION_DEFAULT_WINDOW_HOURS=24
NADI_CORRELATION_MIN_SAMPLE_SIZE=5
```

Optional future variables:

```env
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=
OPENAI_REQUEST_TIMEOUT_SECONDS=
OPENAI_MAX_RETRIES=

NADI_ENABLE_AI_INSIGHTS=false
NADI_AI_MAX_CONTEXT_RECORDS=200
```

Rules:
- DATABASE_URL 不可提交。
- DIRECT_DATABASE_URL 不可提交。
- AUTH_SECRET 不可提交。
- OPENAI_API_KEY 不可提交。
- NADI_DEBUG=true 只能用於本機或受保護環境。
- 若未啟用 NADI_ENABLE_AI_INSIGHTS，不應呼叫任何 LLM API。
- 不要建立 .env 以外的 secrets 檔案。
- `.env.example` 可以存在，但只能放空值或安全 placeholder，用途僅限說明需要哪些參數，不作為本機實際載入來源。

## Secret Management

- 使用 direnv 管理本機 secrets。
- 本專案只透過 `.envrc` 管理與載入本機敏感參數。
- Secrets 不應存放於 repository 中。
- `.env.example` 只用於說明需要哪些 environment variables，不應存放真實值，也不作為本機實際載入來源。
- 實際參數應由 `.envrc` 透過 `source_env_if_exists` 載入 repository 外部的 secrets 檔案。
- 建議使用：

```envrc
source_env_if_exists ~/Secrets/Nadi/dev.env
```

- ~/Secrets/ 應保持在 git repo 外部。
- 不要在 logs、tests、debug output 中輸出完整 secrets。
- 若需要 debug，請使用 masked values。

## Local Commands

這些指令可在 package scripts 實作後調整。

```txt
安裝：
  pnpm install

啟動開發環境：
  pnpm dev

建置：
  pnpm build

啟動 production app：
  pnpm start

執行 lint：
  pnpm lint

執行 typecheck：
  pnpm typecheck

執行測試：
  pnpm test

執行 unit tests：
  pnpm test:unit

執行 integration tests：
  pnpm test:integration

執行 e2e tests：
  pnpm test:e2e

產生 database migration：
  pnpm db:generate

套用 database migration：
  pnpm db:migrate

直接 push database schema：
  pnpm db:push

開啟 database studio：
  pnpm db:studio

執行 database seed：
  pnpm db:seed

執行 report tests：
  pnpm test:reports

執行 API tests：
  pnpm test:api
```

## Testing Expectations

- 新增 business logic 時，先寫 focused tests。
- 至少應測試：
    - 建立 item。
    - 建立 metric record。
    - 建立 symptom record。
    - value type validation。
    - 使用者不能讀取其他使用者資料。
    - archived item 不再出現在預設 item list。
    - 仍可查詢 archived item 的歷史 records。
    - date range query。
    - summary report。
    - correlation report。
    - sample size 不足時的 fallback。
    - invalid date range。
    - unauthorized request。
- Report 測試應確認：
    - 不把 correlation 說成 causation。
    - sample size 正確。
    - date window 計算正確。
    - missing data 處理合理。
- API 測試應確認：
    - 不接受 user_id override。
    - 錯誤回應不暴露 stack trace。
    - validation error 有穩定格式。
- 在宣稱完成前，至少執行 focused tests 與可行的 broad verification。

## Implementation Tips

- 優先保持系統簡單，不要過早導入 queue、microservice、Redis 或 event sourcing。
- 第一版以 Next.js + Neon Postgres + Drizzle ORM 為主。
- Drizzle schema 應作為 database schema 的唯一來源。
- Schema 變更應透過 migration 管理，不要直接在 Neon console 手動改表。
- Business logic 應與 UI 分離。
- Report calculation 應獨立成純函式，方便測試。
- DB query 應集中在 repository layer，避免散落在 components。
- Validation schema 建議使用 zod。
- Date handling 應集中在 lib/date。
- 若使用 lodash，保持資料轉換清楚，避免過度 chain。
- 不要在 React component 中直接寫複雜統計邏輯。
- 不要在單次 API request 中執行過重分析。
- 若報表變慢，優先考慮：
    1. index。
    2. query 改寫。
    3. report snapshot。
    4. background job。
- 對 item type、value type、report type 使用明確 enum 或 union type。
- 不要為了未來可能需求過度抽象。

## Suggested Modules

```txt
features/items/
  actions.ts
  api.ts
  schema.ts
  service.ts
  repository.ts

features/records/
  actions.ts
  api.ts
  schema.ts
  service.ts
  repository.ts

features/reports/
  summary.ts
  correlation.ts
  service.ts
  repository.ts
  schema.ts

lib/db/
  client.ts
  schema.ts

lib/auth/
  session.ts
  require-user.ts

lib/validation/
  errors.ts

lib/date/
  range.ts
  timezone.ts
```

## Production Hardening Backlog

Priority order:

1. Auth 與 user data isolation。
2. Input validation。
3. Database migration workflow。
4. CSV / JSON export。
5. Basic backup strategy。
6. API rate limit。
7. Offline sync。
8. Report snapshots。
9. Vercel Cron for scheduled summaries。
10. Admin-only diagnostics。
11. Audit log for sensitive changes。
12. Optional AI insight generation。
13. Optional object storage for photos。
14. Optional queue / worker for heavy reports。

## Important Boundaries

- This is not a medical diagnosis tool.
- This is not a replacement for professional healthcare.
- This is not a mental health crisis tool.
- This is not a food allergy diagnosis system.
- This is not a productivity optimization system.
- The product should help users observe patterns, not create anxiety.
- The product should frame insights as hypotheses, not conclusions.
- The system should help users understand their own records, not tell them what is medically true.

## Documentation Rules

- README.md 應偏向：
    - Nadi 是什麼。
    - 如何啟動。
    - Tech stack。
    - Features。
    - Screenshots。
    - Project status。
- 詳細 system design 應放在 docs/system-design.md。
- API 文件應放在 docs/api-design.md。
- Database schema 應放在 docs/database-schema.md。
- 架構決策應放在 docs/decisions/。
- 若更動 database schema，需同步更新 docs/database-schema.md。
- 若更動 public API，需同步更新 docs/api-design.md。
- 若更動核心架構，需同步更新 docs/architecture.md 或新增 ADR。

## Branding Rules

- Product name: Nadi。
- Repo name 可以是 nadi。
- Logo assets 放在：

```txt
public/logo/
```

- README 可以顯示 logo，但不要讓 branding 影響工程可讀性。
- 文案應避免醫療權威感。
- 建議 tagline：

```txt
A personal life-signal tracking system.
```

或：

```txt
Observe yourself, not optimize yourself.
```

## Commit Classification Rules

Commit type 應根據整體 git diff 的主要目的判斷，
而不是最後修改的檔案。

優先順序：

1. feat
   - 新功能
   - 新 API
   - 新 workflow

2. fix
   - Bug 修正
   - 錯誤處理
   - Runtime 問題修正

3. refactor
   - 結構重構
   - 架構調整
   - 不新增功能的程式整理

4. perf
   - 效能優化

5. test
   - 測試相關

6. docs
   - 純文件修改
   - 若包含實際程式變更，不可使用 docs

7. chore
   - 工具
   - dependency
   - formatting
   - build/config 調整

### Important Rules

- 不要因為修改了 README 或 docs 就使用 docs。
- 若 commit 同時包含功能與文件更新，仍應使用 feat。
- 若 commit 同時包含 refactor 與文件更新，仍應使用 refactor。
- Commit message 應簡潔，不要過度描述細節。

### Examples

```txt
feat: 新增 symptom correlation report
fix: 修正 record date validation
refactor: 重構 report calculation flow
docs: 更新 system design 文件
test: 補上 records repository tests
```