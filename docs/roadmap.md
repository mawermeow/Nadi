# Nadi Roadmap

## MVP 目標

第一階段重點：
- 建立穩定的個人 life-signal tracking 系統。
- 保持 architecture 簡單。
- 優先確保資料完整性與開發體驗。
- 避免過早優化（Premature Optimization）。

---

## Phase 1 — 基礎架構

目標：
建立可運行的基礎系統。

範圍：
- Next.js App Router
- TypeScript
- Tailwind
- Drizzle ORM
- Neon Postgres
- Migration workflow
- 基本資料夾結構
- Auth foundation
- 共用 validation utilities

暫不實作：
- Reports
- AI insights
- Offline sync
- Photo upload

---

## Phase 2 — Item System

目標：
建立可自訂 tracking items 的能力。

範圍：
- Item schema
- Item CRUD API
- Item 建立 UI
- Item archive flow
- Validation rules

---

## Phase 3 — Record System

目標：
建立每日紀錄能力。

範圍：
- Record schema
- Record CRUD API
- Record 建立 UI
- Timeline view
- Date range query

---

## Phase 4 — Summary Reports

目標：
建立基礎統計報表。

範圍：
- Summary report API
- Daily / weekly / monthly aggregation
- Metric statistics
- Symptom statistics
- Basic charts

---

## Phase 5 — Correlation Reports

目標：
探索 symptoms 與 habits 之間的相對關聯。

範圍：
- Correlation calculation
- Window-based analysis
- Sample size validation
- 保守語氣的 insight wording

重要原則：
- Correlation 不等於 causation。
- 不要產生醫療結論。
- 不要把統計結果描述成診斷。

---

## Phase 6 — UI Polish

目標：
改善 mobile UX 與整體使用體驗。

範圍：
- Mobile optimization
- Empty states
- Better charts
- Better forms
- Loading states
- Error handling

---

## Future Ideas

未來可能功能：
- Offline sync
- AI-assisted insights
- CSV / JSON export
- Photo attachment
- Habit templates
- Calendar heatmap
- Reminder system
- Health data import