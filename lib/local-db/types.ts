export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';

export type LocalEntityBase = {
  id: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  lastSyncedAt: string | null;
  deviceId: string | null;
};

export type LocalItem = LocalEntityBase & {
  userId?: string | null;
  title: string;
  type: 'metric' | 'symptom';
  unit: string | null;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin: number | null;
  scaleMax: number | null;
  sortOrder: number;
  archived: boolean;
};

export type LocalRecord = LocalEntityBase & {
  userId?: string | null;
  itemId: string;
  valueNumber: number | null;
  valueText: string | null;
  valueBoolean: boolean | null;
  recordedAt: string;
  note: string | null;
};

export type LocalSyncOperation = LocalEntityBase & {
  userId?: string | null;
  operationId: string;
  entityType: 'item' | 'record';
  operationType: 'create' | 'update' | 'delete';
  entityId: string;
  baseVersion: number | null;
  payload: unknown;
  status: SyncStatus;
  retryCount: number;
  lastError: string | null;
  conflictSnapshot?: {
    baseVersion: number;
    currentVersion: number;
    serverEntity: Record<string, unknown>;
  } | null;
  resolutionMeta?: {
    choice: 'keep_local' | 'keep_cloud';
    resolvedAt: string;
    preservedPayload?: unknown;
  } | null;
};

export type LocalSyncMetaValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>;

export type LocalSyncMeta = LocalEntityBase & {
  key: string;
  value: LocalSyncMetaValue;
};

export type LocalStoreName =
  | 'items'
  | 'records'
  | 'syncOperations'
  | 'syncMeta';
