export const sectionCopy = {
  appTagline: '以工具型 App 的節奏整理日常訊號，先記錄，再回頭閱讀。',

  dashboard: {
    hero: '快速掌握最近的記錄與狀態，需要細節時再往下列找。',
    recentRecords: '只保留最近幾筆，方便快速回頭確認。',
  },

  create: {
    page: '選項目、填數值，幾步就能把此刻的狀態留下來。',
    recordForm: '先選項目、再填一個值即可。若只是快速補記，備註可以先留空。',
    itemForm: '若還缺少可選項目，可以在這裡補上。先從最常記錄的那一個開始即可。',
  },

  records: {
    page: '在這裡查看、篩選與刪除既有紀錄，不再以整頁捲動來找資料。',
  },

  reports: {
    page: '把已記下的訊號整理成摘要與關聯觀察，幫助你回頭閱讀。',
    summary:
      '選一段時間，看看你記錄了哪些趨勢與次數——僅供自我觀察，不是醫療結論。',
    correlation:
      '觀察症狀出現前後，哪些日常紀錄可能一起出現——僅供參考，不代表因果或醫療結論。',
    localModeSummary: '登入並連結帳號後，才能在這裡查看雲端資料的摘要。',
    localModeCorrelation:
      '登入並連結帳號後，才能在這裡查看雲端資料的關聯觀察。',
  },

  settings: {
    page: '管理追蹤項目、帳號與同步，讓記錄維持在你習慣的節奏。',
    account:
      '不登入也能先記錄；登入後可備份到雲端，並在其他裝置接續使用。',
    sync: '確認這台裝置的紀錄是否已安全備份，以及是否還有待處理的更新。',
    activeItems:
      '管理你正在追蹤的項目；封存後就不會再出現在新增畫面，過去的紀錄仍會保留。',
    archivedItems:
      '暫時不再追蹤的項目會收在這裡，過去的紀錄仍可以回頭查看。',
  },

  items: {
    createItem: '為自己定義想觀察的日常訊號，建立後隨時都能調整。',
    activeItems: '目前正在追蹤、可用來記錄的項目。',
  },
} as const;

export function formatSyncQueueSummary({
  pendingCount,
  failedCount,
  conflictCount,
}: {
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
}) {
  return `待同步 ${pendingCount} 筆 · 失敗 ${failedCount} 筆 · 需處理衝突 ${conflictCount} 筆`;
}

export function formatSyncIssueSummary({
  failedCount,
  conflictCount,
  lastError,
}: {
  failedCount: number;
  conflictCount: number;
  lastError?: string | null;
}) {
  const parts = [
    `失敗 ${failedCount} 筆`,
    `需處理衝突 ${conflictCount} 筆`,
  ];

  if (lastError) {
    parts.push(lastError);
  }

  return parts.join(' · ');
}
