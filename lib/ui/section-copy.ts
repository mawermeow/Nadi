export const sectionCopy = {
  appHeadline: '觀察自己',
  appTagline: '記錄、回顧、理解自己的生活訊號。',

  dashboard: {
    hero: '觀察自己的日常訊號',
    recentRecords: '僅顯示最近幾筆紀錄，方便快速回顧。',
  },

  create: {
    page: '選擇項目並填寫數值，即可留下當下的狀態。',
    recordForm: '先選擇項目，再填寫對應數值；若為簡要補記，備註可留空。',
    itemForm: '若缺少可選項目，可在此新增；建議從最常記錄的項目開始。',
  },

  records: {
    page: '回顧與整理你過去留下的紀錄。',
    list: '依類型、項目或日期篩選，並編輯或刪除單筆紀錄。',
  },

  reports: {
    page: '將已記錄的訊號整理為摘要與關聯觀察，協助回顧與理解。',
    summary:
      '選定時間區間，檢視趨勢與出現次數；結果僅供自我觀察，不構成醫療建議。',
    correlation:
      '檢視症狀出現前後，可能與之相伴的日常紀錄；結果僅供參考，不代表因果關係或醫療結論。',
    localModeSummary: '登入並連結帳號後，可檢視雲端資料的摘要報表。',
    localModeCorrelation: '登入並連結帳號後，可檢視雲端資料的關聯報表。',
  },

  settings: {
    page: '管理追蹤項目、帳號與資料同步。',
    account:
      '未登入時亦可記錄；登入後可將資料備份至雲端，並於其他裝置接續使用。',
    sync: '檢視本機紀錄的備份狀態，以及尚待處理的同步項目。',
    activeItems:
      '管理目前追蹤中的項目；封存後將不再顯示於新增畫面，既有紀錄仍會保留。',
    archivedItems: '已暫停追蹤的項目集中於此，相關歷史紀錄仍可查閱。',
  },

  items: {
    createItem: '定義需要觀察的日常訊號，建立後可隨時調整。',
    activeItems: '目前啟用中、可用於記錄的項目。',
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
  return `待同步 ${pendingCount} 筆 · 同步失敗 ${failedCount} 筆 · 待處理衝突 ${conflictCount} 筆`;
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
    `同步失敗 ${failedCount} 筆`,
    `待處理衝突 ${conflictCount} 筆`,
  ];

  if (lastError) {
    parts.push(lastError);
  }

  return parts.join(' · ');
}
