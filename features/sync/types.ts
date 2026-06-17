export type SyncEntityType = 'item' | 'record';

export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncSessionStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'failed';

export type SyncOperation = {
  operationId: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  baseVersion?: number;
  payload: unknown;
  clientCreatedAt: string;
  clientUpdatedAt: string;
};

export type SyncPushRequest = {
  deviceId: string;
  operations: SyncOperation[];
};

export type SyncAcceptedOperation = {
  operationId: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  version: number;
  updatedAt: string;
};

export type SyncRejectedOperation = {
  operationId: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  reason: string;
  message: string;
};

export type SyncItemEntity = {
  id: string;
  title: string;
  type: 'metric' | 'symptom';
  unit: string | null;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin: number | null;
  scaleMax: number | null;
  sortOrder: number;
  archived: boolean;
  version: number;
  deletedAt: string | null;
  updatedAt: string;
  createdAt: string;
  lastSyncedAt: string | null;
  deviceId: string | null;
};

export type SyncRecordEntity = {
  id: string;
  itemId: string;
  valueNumber: number | null;
  valueText: string | null;
  valueBoolean: boolean | null;
  recordedAt: string;
  note: string | null;
  version: number;
  deletedAt: string | null;
  updatedAt: string;
  createdAt: string;
  lastSyncedAt: string | null;
  deviceId: string | null;
};

export type SyncConflict = {
  operationId: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  baseVersion: number;
  currentVersion: number;
  serverEntity: SyncItemEntity | SyncRecordEntity;
};

export type SyncDeviceSession = {
  deviceId: string;
  lastSeenAt: string;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastCheckpointAt: string | null;
  lastCheckpointCursor: string | null;
  lastSyncStatus: SyncSessionStatus;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
};

export type SyncDiagnostics = {
  duplicateOperationCount: number;
  acceptedOperationCount: number;
  rejectedOperationCount: number;
  conflictOperationCount: number;
  pulledItemCount: number;
  pulledRecordCount: number;
  pulledTombstoneCount: number;
};

export type SyncPushResponse = {
  accepted: SyncAcceptedOperation[];
  rejected: SyncRejectedOperation[];
  conflicts: SyncConflict[];
  deviceSession: SyncDeviceSession;
  diagnostics: SyncDiagnostics;
  serverTime: string;
};

export type SyncPullCheckpoint = {
  since: string | null;
  until: string;
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  returnedCount: number;
};

export type SyncPullRequest = {
  deviceId: string;
  lastPulledAt?: string;
  checkpoint?: {
    until?: string;
    cursor?: string;
    limit?: number;
  };
};

export type SyncTombstone = {
  entityType: SyncEntityType;
  entityId: string;
  deletedAt: string;
  version: number;
  updatedAt: string;
};

export type SyncPullResponse = {
  items: SyncItemEntity[];
  records: SyncRecordEntity[];
  tombstones: SyncTombstone[];
  checkpoint: SyncPullCheckpoint;
  deviceSession: SyncDeviceSession;
  diagnostics: SyncDiagnostics;
  serverTime: string;
};
