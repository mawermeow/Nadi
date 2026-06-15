# Nadi
> 命名靈感：來自梵文「脈、流動、能量通道」，有安靜、抽象、生命流動的感覺。

> 個人飲食、睡眠與異狀紀錄 PWA 系統設計

## 1. Functional Requirements

使用者應該能夠：
1. 自訂紀錄項目
    - 例如：睡眠、喝水、咖啡、運動、過敏、頭痛、焦慮、腸胃不適。
    - 每個項目可以設定標題、類型、單位與輸入格式。

2. 建立每日紀錄
    - 使用者可以選擇一個已建立的項目。
    - 填入數值、發生時間、備註。
    - 例如：睡眠 6.5 小時、咖啡 2 杯、頭痛程度 4/10。

3. 查看報表與關聯分析
    - 使用者可以查詢某段時間內的紀錄。
    - 系統可以產生趨勢圖、統計摘要。
    - 系統可以初步分析「異狀」與「飲食、睡眠、行為紀錄」之間的相對關聯。

暫不支援：
- 照片上傳。
- 多人社交功能。
- 醫療診斷。
- 醫生端後台。
- 即時通知。
- 複雜 AI 診斷。

---

## 2. Non-functional Requirements

### 2.1 資料持久性（Durability）

使用者的生活紀錄具有長期價值，系統應盡量避免資料遺失。

目標：
- 所有紀錄寫入後應永久保存。
- 使用 PostgreSQL 作為主要資料庫。
- 支援匯出 CSV / JSON，降低平台鎖定風險。
- 前期可接受沒有高階備援，但應避免只存在 LocalStorage。

---

### 2.2 安全性（Security）

系統會儲存個人飲食、睡眠與身體異狀資料，屬於高度私人的生活紀錄。

目標：
- 所有 API 都必須驗證使用者身分。
- user_id 應從 Auth Token 推導，不應由 request body 傳入。
- 使用者只能讀寫自己的紀錄。
- 密碼不自行保存，優先使用第三方 Auth 或 Supabase / Clerk / Neon Auth。
- API 層需做輸入驗證，避免非法資料寫入。

---

### 2.3 可擴展性（Scalability）

前期主要是個人使用或少量使用者，因此不需要過度設計。

目標：
- 前期支援個人使用與小規模 MVP。
- 使用 Vercel + Neon Postgres 即可。
- 當資料量成長後，可透過 index、分頁、報表預計算來擴展。
- 暫不需要 Message Queue、Cache、Sharding。

---

### 2.4 延遲（Latency）

紀錄操作應該快速完成，避免使用者因操作成本太高而放棄紀錄。

目標：
- 新增紀錄 API 回應時間目標低於 300ms。
- 查詢近期紀錄 API 回應時間目標低於 500ms。
- 複雜報表可接受 1–3 秒。
- 若報表變慢，後續可加入預計算或背景任務。

---

### 2.5 離線能力（Offline Support）

PWA 常在手機上使用，可能遇到網路不穩。

目標：
- 前期可以先不做完整離線同步。
- 可用 IndexedDB 暫存尚未同步的紀錄。
- 網路恢復後再同步到後端。
- 若發生同步衝突，以 created_at / updated_at 判斷最新版本。

---

## 3. API Design

預設使用 REST API。

Base URL:
```http
/v1
```

所有 API 都需要 Authentication。

---

### 3.1 Item API

#### Create Item

```http
POST /v1/items
```

Request:
```ts
{
  title: string;
  type: "metric" | "symptom";
  unit?: string;
  value_type: "number" | "boolean" | "scale" | "text";
  scale_min?: number;
  scale_max?: number;
}
```

Response:
```ts
Item {
  id: string;
  title: string;
  type: "metric" | "symptom";
  unit?: string;
  value_type: "number" | "boolean" | "scale" | "text";
  scale_min?: number;
  scale_max?: number;
  created_at: string;
}
```

---

#### Get Items

```http
GET /v1/items -> Item[]
```

Response:
```ts
Item[] {
  id: string;
  title: string;
  type: "metric" | "symptom";
  unit?: string;
  value_type: "number" | "boolean" | "scale" | "text";
}
```

---

#### Update Item

```http
PATCH /v1/items/{itemId}
```

Request:
```ts
{
  title?: string;
  unit?: string;
  archived?: boolean;
}
```

Response:
```ts
Item {
  id: string;
  title: string;
  type: "metric" | "symptom";
  unit?: string;
  value_type: string;
  archived: boolean;
}
```

---

### 3.2 Record API

#### Create Record

```http
POST /v1/records
```

Request:
```ts
{
  item_id: string;
  value: number | boolean | string;
  recorded_at: string;
  note?: string;
}
```

Response:
```ts
Record {
  id: string;
  item_id: string;
  item_title: string;
  value: number | boolean | string;
  unit?: string;
  recorded_at: string;
  note?: string;
}
```

---

#### Get Records

```http
GET /v1/records?from=2026-06-01&to=2026-06-15&item_id=xxx
```

Response:
```ts
Record[] {
  id: string;
  item_id: string;
  item_title: string;
  item_type: "metric" | "symptom";
  value: number | boolean | string;
  unit?: string;
  recorded_at: string;
  note?: string;
}
```

---

#### Delete Record

```http
DELETE /v1/records/{recordId}
```

Response:
```ts
{
  success: boolean;
}
```

---

### 3.3 Report API

#### Get Summary Report

```http
GET /v1/reports/summary?from=2026-06-01&to=2026-06-15
```

Response:
```ts
SummaryReport {
  from: string;
  to: string;
  metrics: MetricSummary[];
  symptoms: SymptomSummary[];
}
```

```ts
MetricSummary {
  item_id: string;
  title: string;
  unit?: string;
  avg?: number;
  min?: number;
  max?: number;
  total?: number;
  count: number;
}
```

```ts
SymptomSummary {
  item_id: string;
  title: string;
  occurrence_count: number;
  avg_severity?: number;
}
```

---

#### Get Correlation Report

```http
GET /v1/reports/correlation?symptom_item_id=xxx&from=2026-06-01&to=2026-06-15&window_hours=24
```

Response:
```ts
CorrelationReport {
  symptom_item_id: string;
  symptom_title: string;
  window_hours: number;
  candidates: CorrelationCandidate[];
}
```

```ts
CorrelationCandidate {
  item_id: string;
  title: string;
  unit?: string;
  correlation_score: number;
  sample_size: number;
  description: string;
}
```

Example:
```ts
{
  symptom_title: "頭痛",
  window_hours: 24,
  candidates: [
    {
      title: "睡眠",
      unit: "小時",
      correlation_score: -0.62,
      sample_size: 18,
      description: "頭痛發生前 24 小時內，睡眠時間偏低時較常出現頭痛。"
    }
  ]
}
```

---

## 4. High-Level Design

### 4.1 Architecture

```txt
Client PWA
  |
  | HTTPS
  v
Next.js App on Vercel
  |
  | API Routes / Server Actions
  v
Application Service Layer
  |
  | SQL
  v
Neon Postgres
```

前期不加入：
- Message Queue
- Redis Cache
- Object Storage
- Search Engine
- Worker Service

---

### 4.2 Component

#### Client PWA

負責：
- 顯示紀錄表單。
- 顯示每日紀錄。
- 顯示報表。
- 可選擇性使用 IndexedDB 做離線暫存。

---

#### Next.js / Vercel

負責：
- API endpoint。
- Authentication middleware。
- Input validation。
- Business logic。
- 呼叫 PostgreSQL。
- 產生報表資料。

---

#### Neon Postgres

負責：
- 儲存使用者自訂項目。
- 儲存每日紀錄。
- 支援時間區間查詢。
- 支援報表聚合與關聯分析。

---

## 4.3 Database Design

使用 PostgreSQL。

---

### users

```sql
users {
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL
}
```

Index:
```sql
UNIQUE INDEX users_email_idx ON users(email);
```

---

### items

使用者自訂的紀錄項目。

```sql
items {
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- metric | symptom
  unit TEXT,
  value_type TEXT NOT NULL, -- number | boolean | scale | text
  scale_min NUMERIC,
  scale_max NUMERIC,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
}
```

Index:
```sql
INDEX items_user_id_idx ON items(user_id);
INDEX items_user_type_idx ON items(user_id, type);
INDEX items_user_archived_idx ON items(user_id, archived);
```

設計理由：
- user_id 用於隔離不同使用者資料。
- type 用於區分一般紀錄與異狀。
- archived 用於隱藏項目，而不是直接刪除，避免歷史紀錄失去語意。

---

### records

實際紀錄資料。

```sql
records {
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  item_id UUID NOT NULL REFERENCES items(id),
  value_number NUMERIC,
  value_text TEXT,
  value_boolean BOOLEAN,
  recorded_at TIMESTAMP NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
}
```

Index:
```sql
INDEX records_user_recorded_at_idx ON records(user_id, recorded_at DESC);
INDEX records_user_item_recorded_at_idx ON records(user_id, item_id, recorded_at DESC);
INDEX records_item_recorded_at_idx ON records(item_id, recorded_at DESC);
```

設計理由：
- records_user_recorded_at_idx 支援查詢某段時間內所有紀錄。
- records_user_item_recorded_at_idx 支援查詢某個項目的歷史趨勢。
- recorded_at 使用 DESC，方便查最近紀錄。
- value 拆成 number / text / boolean，避免所有值都塞 JSON，讓報表分析更容易。

---

### report_snapshots

前期可以不做。當報表查詢變慢時再加入。

```sql
report_snapshots {
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  report_type TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL
}
```

Index:
```sql
INDEX report_snapshots_user_range_idx 
ON report_snapshots(user_id, report_type, from_date, to_date);
```

---

## 4.4 Query Flow

### Create Record Flow

```txt
Client
  -> POST /v1/records
  -> Auth Middleware 驗證使用者
  -> Validate item_id 是否屬於目前使用者
  -> Validate value 是否符合 item.value_type
  -> Insert records
  -> Return Record
```

---

### Get Records Flow

```txt
Client
  -> GET /v1/records?from&to
  -> Auth Middleware
  -> Query records by user_id and recorded_at
  -> Join items 取得 title, unit, type
  -> Return Record[]
```

---

### Generate Correlation Report Flow

```txt
Client
  -> GET /v1/reports/correlation
  -> Auth Middleware
  -> 查詢指定 symptom 發生時間
  -> 查詢 symptom 發生前 N 小時內的 metric records
  -> 計算簡單 correlation score
  -> Return CorrelationReport
```

---

## 5. Deep Dive

### 5.1 自訂項目如何設計

這個系統的核心不是固定欄位，而是讓使用者自己建立項目。

不建議設計成：
```sql
daily_records {
  sleep_hours,
  water_ml,
  coffee_count,
  headache_level
}
```

因為使用者之後一定會想增加更多項目，例如：
- 藥物
- 運動
- 情緒
- 經期
- 過敏
- 腸胃狀況
- 壓力
- 特定食物

比較好的設計是：
```txt
items 定義項目
records 儲存紀錄
```

也就是 EAV-like model，但不要過度泛化。

---

### 5.2 為什麼選 PostgreSQL

這個系統的核心價值在報表與分析，不只是單純儲存資料。

PostgreSQL 適合：
- 時間區間查詢。
- group by 聚合。
- join items 和 records。
- 計算平均、總和、最大值、最小值。
- 後續做 correlation analysis。
- 匯出 CSV。
- 保留資料一致性。

不優先選 DynamoDB，因為：
- DynamoDB 需要先知道主要查詢模式。
- 探索式分析比較不自然。
- join 與 ad-hoc query 不方便。

不優先選 Firebase，因為：
- 快速開發很方便。
- 但複雜報表、聚合分析、時間序列查詢會逐漸變麻煩。
- 資料結構變多後，容易需要額外同步與 denormalization。

結論：
```txt
前期 MVP：Neon Postgres
ORM：Drizzle 或 Prisma
部署：Vercel
```

---

### 5.3 報表與關聯分析

前期不需要做太複雜的統計模型。

可以先做三種分析：

#### 1. 時間趨勢

例如：
- 睡眠時間趨勢。
- 咖啡攝取量趨勢。
- 頭痛嚴重程度趨勢。

#### 2. 條件統計

例如：
- 睡眠低於 6 小時時，頭痛出現比例。
- 咖啡超過 2 杯時，焦慮平均分數。
- 運動日與非運動日的睡眠差異。

#### 3. Window-based Correlation

例如：
- 頭痛發生前 24 小時內，哪些紀錄比較常出現？
- 過敏發生前 48 小時內，是否比較常吃某類食物？
- 睡眠不足後 1–2 天，是否更容易出現異狀？

---

### 5.4 報表效能

前期可以直接查 records 即時計算。

當資料變多後再優化：

1. 加強 index
    - records(user_id, recorded_at)
    - records(user_id, item_id, recorded_at)

2. 報表快照
    - 每天預先計算 summary。
    - 存到 report_snapshots。

3. 背景任務
    - 使用 Vercel Cron 或外部 worker。
    - 每天凌晨重新計算前一天報表。

---

### 5.5 離線與同步

前期可以先做線上版。

如果要支援離線：
```txt
Client IndexedDB
  -> 暫存 pending records
  -> 網路恢復後 sync
  -> Server 根據 client_generated_id 去重
```

records 可增加：
```sql
client_generated_id UUID
```

Index:
```sql
UNIQUE INDEX records_user_client_generated_id_idx
ON records(user_id, client_generated_id);
```

這可以避免離線同步時重複建立同一筆紀錄。

---

### 5.6 Edge Cases

#### 使用者刪除 item

不應直接刪除 item，應改成 archived。

原因：
- 舊紀錄仍需要知道當時的項目名稱與單位。
- 如果直接刪除，歷史報表會失去語意。

---

#### 使用者修改 item unit

例如從「杯」改成「ml」。

處理方式：
- 前期可以只允許修改 title，不允許修改 value_type。
- unit 可以修改，但歷史資料可能需要注意語意變化。
- 更嚴謹的做法是建立 item_versions，但前期不需要。

---

#### value 型別錯誤

例如 item.value_type 是 number，但使用者傳入 text。

處理方式：
- API 層驗證。
- DB 層可以加 constraint。
- 回傳 400 Bad Request。

---

#### 時區問題

recorded_at 應儲存 UTC。

前端顯示時根據使用者時區轉換。

```txt
DB: UTC timestamp
UI: Asia/Taipei local time
```

---

## 6. Final Recommendation

前期建議架構：
```txt
Next.js PWA
+ Vercel
+ Neon Postgres
+ Drizzle ORM
+ Auth.js / Clerk / Supabase Auth
```

前期不需要：
```txt
Redis
Message Queue
DynamoDB
Firebase
Object Storage
Search Engine
Microservices
```

這個系統的第一版重點應該是：
1. 讓使用者能快速建立自訂項目。
2. 讓使用者能低摩擦地記錄每日數據與異狀。
3. 讓使用者能透過報表發現生活紀錄與異狀之間的關聯。

核心設計判斷：
```txt
這不是單純的待辦事項 App。
這是一個個人時間序列資料分析系統。
因此資料庫應優先選 PostgreSQL。
```