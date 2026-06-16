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

## Phase 7 — PWA Local-first Foundation

目標：
讓 Nadi 具備更接近 iPhone App 的使用體驗，並為離線使用打下基礎。

範圍：
- PWA manifest
- App icons
- Mobile App-like layout
- IndexedDB local store
- Local-first data flow
- Device ID persistence
- Offline readable cache
- Sync operation queue foundation
- Online / offline state detection

重要原則：
- PostgreSQL 仍是雲端主資料庫。
- IndexedDB 作為前端本機資料層。
- 不使用 localStorage 作為主要資料庫。
- 不依賴 iOS background task。
- 離線寫入需透過 operation queue 管理。

---

## Phase 8 — Offline Sync Hardening

目標：
降低重新連網後的同步錯誤，讓 iPhone / iPad 多裝置使用更安全。

範圍：
- Sync push / pull API
- Pending operation retry
- Version-based conflict detection
- Soft delete / tombstone flow
- Sync status UI
- Failed / conflict state display
- Pull merge safety
- Duplicate operation protection

重要原則：
- Conflict 先偵測與標示，不自動覆蓋。
- Delete 採 soft delete，避免跨裝置同步時資料遺失。
- Push retry 必須避免重複建立資料。
- Pull merge 不可覆蓋本機 pending changes。

---

## Phase 9 — Account System & Cloud Identity

目標：
建立正式的使用者帳號系統，讓資料可以安全同步到雲端，並支援多裝置登入。

範圍：
- Email/password registration
- Login / logout flow
- Session management
- Device-to-account linking
- Account-based data ownership
- Protected API routes
- Sync identity verification
- Anonymous local-first mode migration
- Basic account settings UI

重要原則：
- Local-first architecture 不應因登入而失效。
- 未登入使用者仍可本機使用 Nadi。
- 登入後需支援將 local data merge 到 cloud account。
- 不自動覆蓋不同裝置的 pending changes。
- 所有 cloud records 必須具有明確 user ownership。
- Auth 不應影響離線使用能力。

---

## Phase 10 — Multi-device Sync Stabilization

目標：
改善多裝置同步穩定性，降低 iPhone、iPad、Web 間的資料不一致問題。

範圍：
- Cross-device sync consistency
- Device session management
- Sync checkpoint optimization
- Incremental pull optimization
- Conflict resolution assistance
- Sync recovery flow
- Sync diagnostics logging
- Background sync optimization

重要原則：
- Sync reliability 優先於即時性。
- 不追求即時 collaborative editing。
- 所有 sync conflict 必須可追溯。
- 使用者應能理解目前 sync 狀態。
- 不可因 sync failure 導致本機資料遺失。

---

## Phase 11 — Data Export & Personal Ownership

目標：
強化使用者對自身資料的掌控權，提供資料匯出與備份能力。

範圍：
- CSV export
- JSON export
- Full backup export
- Import validation
- Encrypted backup option
- Export history
- Personal data management UI

重要原則：
- 使用者應能完整取回自己的資料。
- Export format 應盡量保持可讀性。
- 匯出資料不應包含其他使用者資訊。
- Import 不可破壞既有資料。
- Backup flow 應優先保護資料完整性。

---

## Phase 12 — AI-assisted Insights

目標：
透過 LLM 與統計分析，協助使用者更容易觀察自己的生活模式與身體訊號。

範圍：
- AI-generated summaries
- Pattern explanation
- Timeline insight generation
- Natural language report explanation
- Weekly reflection summaries
- Insight feedback system
- AI safety guardrails

重要原則：
- AI insights 是 observation tool，不是 diagnosis tool。
- 不提供醫療診斷。
- 不提供治療建議。
- 不把 correlation 描述成 causation。
- AI 回答必須保守且可追溯。
- 使用者應能區分：
    - raw data
    - statistical analysis
    - AI interpretation

---

## Future Ideas

未來可能功能：
- AI-assisted insights
- CSV / JSON export
- Photo attachment
- Habit templates
- Calendar heatmap
- Reminder system
- Health data import
- Native iOS wrapper
- SQLite adapter for Capacitor
- HealthKit integration