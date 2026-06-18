export type ExportFormat = 'csv' | 'json' | 'full_backup';

export type ExportHistoryResponse = {
  id: string;
  exportFormat: ExportFormat;
  fileName: string;
  schemaVersion: number;
  itemCount: number;
  recordCount: number;
  reportSnapshotCount: number;
  deviceCount: number;
  maskedUserReference: string;
  createdAt: string;
};

export type OwnershipSummaryResponse = {
  local: {
    deviceId: string;
    itemCount: number;
    recordCount: number;
    syncedCount: number;
    localOnlyCount: number;
    pendingCount: number;
    failedCount: number;
    conflictCount: number;
  };
  cloud: {
    itemCount: number;
    recordCount: number;
    reportSnapshotCount: number;
    exportHistoryCount: number;
    lastExportAt: string | null;
  };
  sync: {
    lastSyncAt: string | null;
    lastSyncStatus: 'idle' | 'syncing' | 'synced' | 'conflict' | 'failed' | 'offline';
    lastSyncMessage: string | null;
  };
  devices: Array<{
    deviceId: string;
    linkedAt: string | null;
    lastSeenAt: string | null;
    lastMergedAt: string | null;
    lastSyncCompletedAt: string | null;
    lastSyncStatus: 'idle' | 'syncing' | 'synced' | 'conflict' | 'failed' | 'unknown';
    lastErrorCode: string | null;
    isCurrentDevice: boolean;
  }>;
};

export type OwnershipCloudSummaryResponse = {
  cloud: OwnershipSummaryResponse['cloud'];
  devices: Array<Omit<OwnershipSummaryResponse['devices'][number], 'isCurrentDevice'>>;
};

export type ImportPreviewResponse = {
  format: 'json' | 'full_backup';
  schemaVersion: number;
  summary: {
    itemCount: number;
    recordCount: number;
    reportSnapshotCount: number;
    deviceCount: number;
  };
  duplicates: {
    items: number;
    records: number;
    reportSnapshots: number;
  };
  conflicts: Array<{
    kind: 'schema_mismatch' | 'duplicate_item' | 'duplicate_record' | 'duplicate_report_snapshot';
    message: string;
  }>;
  canApply: boolean;
  requiresConfirmation: boolean;
};

export type BackupRecoveryResponse = {
  restored: {
    items: number;
    records: number;
    reportSnapshots: number;
  };
};
