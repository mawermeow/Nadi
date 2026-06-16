export type SyncEntityType = 'item' | 'record';

export type SyncOperationType = 'create' | 'update' | 'delete';

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

export type SyncPushResponse = {
  accepted: SyncAcceptedOperation[];
  rejected: SyncRejectedOperation[];
  conflicts: SyncConflict[];
  serverTime: string;
};

export type SyncPullRequest = {
  deviceId: string;
  lastPulledAt?: string;
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
  serverTime: string;
};
