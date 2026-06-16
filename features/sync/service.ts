import { randomUUID } from 'node:crypto';

import type {
  Item,
  Record,
  SyncDeviceSession as DbSyncDeviceSession,
  SyncOperationReceipt,
} from '@/db/schema';
import {
  ensureSessionUserRecord,
  recordDeviceSeenForUser,
} from '@/features/auth/service';
import { findItemByIdForUser } from '@/features/items/repository';
import type { SessionUser } from '@/lib/auth/session';

import type {
  SyncAcceptedOperation,
  SyncConflict,
  SyncDeviceSession,
  SyncDiagnostics,
  SyncItemEntity,
  SyncPullCheckpoint,
  SyncPullResponse,
  SyncPushResponse,
  SyncRecordEntity,
  SyncRejectedOperation,
  SyncTombstone,
} from './types';
import type {
  SyncItemCreatePayload,
  SyncItemUpdatePayload,
  SyncOperationInput,
  SyncPullCheckpointInput,
  SyncPullRequestInput,
  SyncPushRequestInput,
  SyncRecordCreatePayload,
  SyncRecordUpdatePayload,
} from './schema';
import {
  createSyncItemRecord,
  createSyncRecordRecord,
  findSyncItemById,
  findSyncItemByIdForUser,
  findSyncDeviceSessionByUserAndDeviceId,
  findSyncOperationReceiptByUserAndOperationId,
  findSyncRecordById,
  findSyncRecordByIdForUser,
  listSyncItemChangesByUserId,
  listSyncRecordChangesByUserId,
  upsertSyncDeviceSession,
  upsertSyncOperationReceipt,
  updateSyncItemRecord,
  updateSyncRecordRecord,
} from './repository';

function mapSyncItemEntity(item: Item): SyncItemEntity {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    unit: item.unit,
    valueType: item.valueType,
    scaleMin: item.scaleMin,
    scaleMax: item.scaleMax,
    archived: item.archived,
    version: item.version,
    deletedAt: item.deletedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
    deviceId: item.deviceId,
  };
}

function mapSyncRecordEntity(record: Record): SyncRecordEntity {
  return {
    id: record.id,
    itemId: record.itemId,
    valueNumber: record.valueNumber,
    valueText: record.valueText,
    valueBoolean: record.valueBoolean,
    recordedAt: record.recordedAt.toISOString(),
    note: record.note,
    version: record.version,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    deviceId: record.deviceId,
  };
}

function mapItemTombstone(item: Item): SyncTombstone {
  return {
    entityType: 'item',
    entityId: item.id,
    deletedAt: item.deletedAt?.toISOString() ?? item.updatedAt.toISOString(),
    version: item.version,
    updatedAt: item.updatedAt.toISOString(),
  };
}

function mapRecordTombstone(record: Record): SyncTombstone {
  return {
    entityType: 'record',
    entityId: record.id,
    deletedAt: record.deletedAt?.toISOString() ?? record.updatedAt.toISOString(),
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapSyncDeviceSessionEntity(
  session: DbSyncDeviceSession,
): SyncDeviceSession {
  return {
    deviceId: session.deviceId,
    lastSeenAt: session.lastSeenAt.toISOString(),
    lastSyncStartedAt: session.lastSyncStartedAt?.toISOString() ?? null,
    lastSyncCompletedAt: session.lastSyncCompletedAt?.toISOString() ?? null,
    lastPushAt: session.lastPushAt?.toISOString() ?? null,
    lastPullAt: session.lastPullAt?.toISOString() ?? null,
    lastCheckpointAt: session.lastCheckpointAt?.toISOString() ?? null,
    lastCheckpointCursor: session.lastCheckpointCursor,
    lastSyncStatus: session.lastSyncStatus,
    lastErrorCode: session.lastErrorCode,
    lastErrorAt: session.lastErrorAt?.toISOString() ?? null,
  };
}

function createDiagnosticsSummary(
  input?: Partial<SyncDiagnostics>,
): SyncDiagnostics {
  return {
    duplicateOperationCount: input?.duplicateOperationCount ?? 0,
    acceptedOperationCount: input?.acceptedOperationCount ?? 0,
    rejectedOperationCount: input?.rejectedOperationCount ?? 0,
    conflictOperationCount: input?.conflictOperationCount ?? 0,
    pulledItemCount: input?.pulledItemCount ?? 0,
    pulledRecordCount: input?.pulledRecordCount ?? 0,
    pulledTombstoneCount: input?.pulledTombstoneCount ?? 0,
  };
}

type SyncCursorToken = {
  updatedAt: string;
  entityType: 'item' | 'record';
  entityId: string;
};

type CombinedSyncChange = {
  entityType: 'item' | 'record';
  entity: Item | Record;
};

function createCursorToken(change: CombinedSyncChange): string {
  const updatedAt = change.entity.updatedAt.toISOString();
  return JSON.stringify({
    updatedAt,
    entityType: change.entityType,
    entityId: change.entity.id,
  } satisfies SyncCursorToken);
}

function parseCursorToken(cursor: string): SyncCursorToken | null {
  try {
    const parsed = JSON.parse(cursor) as SyncCursorToken;

    if (
      typeof parsed.updatedAt !== 'string' ||
      (parsed.entityType !== 'item' && parsed.entityType !== 'record') ||
      typeof parsed.entityId !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function compareSyncChanges(left: CombinedSyncChange, right: CombinedSyncChange) {
  const updatedAtCompare =
    left.entity.updatedAt.getTime() - right.entity.updatedAt.getTime();

  if (updatedAtCompare !== 0) {
    return updatedAtCompare;
  }

  if (left.entityType !== right.entityType) {
    return left.entityType.localeCompare(right.entityType);
  }

  return left.entity.id.localeCompare(right.entity.id);
}

function isAfterCursor(
  change: CombinedSyncChange,
  cursor: SyncCursorToken | null,
) {
  if (!cursor) {
    return true;
  }

  const updatedAtCompare =
    change.entity.updatedAt.getTime() - new Date(cursor.updatedAt).getTime();

  if (updatedAtCompare !== 0) {
    return updatedAtCompare > 0;
  }

  if (change.entityType !== cursor.entityType) {
    return change.entityType.localeCompare(cursor.entityType) > 0;
  }

  return change.entity.id.localeCompare(cursor.entityId) > 0;
}

function createAcceptedOperation(
  operation: SyncOperationInput,
  version: number,
  updatedAt: Date,
): SyncAcceptedOperation {
  return {
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    version,
    updatedAt: updatedAt.toISOString(),
  };
}

function createRejectedOperation(
  operation: SyncOperationInput,
  reason: string,
  message: string,
): SyncRejectedOperation {
  return {
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    reason,
    message,
  };
}

function createConflict(
  operation: SyncOperationInput,
  currentVersion: number,
  serverEntity: SyncItemEntity | SyncRecordEntity,
): SyncConflict {
  return {
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    baseVersion: operation.baseVersion ?? 0,
    currentVersion,
    serverEntity,
  };
}

async function saveAcceptedReceipt(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  accepted: SyncAcceptedOperation,
) {
  await upsertSyncOperationReceipt({
    id: randomUUID(),
    userId: user.id,
    deviceId,
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    outcome: 'accepted',
    baseVersion: operation.baseVersion ?? null,
    resultingVersion: accepted.version,
    currentVersion: null,
    reasonCode: null,
    message: null,
    clientCreatedAt: new Date(operation.clientCreatedAt),
    clientUpdatedAt: new Date(operation.clientUpdatedAt),
    entityUpdatedAt: new Date(accepted.updatedAt),
    serverRecordedAt: new Date(),
  });
}

async function saveRejectedReceipt(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  rejected: SyncRejectedOperation,
) {
  await upsertSyncOperationReceipt({
    id: randomUUID(),
    userId: user.id,
    deviceId,
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    outcome: 'rejected',
    baseVersion: operation.baseVersion ?? null,
    resultingVersion: null,
    currentVersion: null,
    reasonCode: rejected.reason,
    message: rejected.message,
    clientCreatedAt: new Date(operation.clientCreatedAt),
    clientUpdatedAt: new Date(operation.clientUpdatedAt),
    entityUpdatedAt: null,
    serverRecordedAt: new Date(),
  });
}

async function saveConflictReceipt(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  conflict: SyncConflict,
) {
  await upsertSyncOperationReceipt({
    id: randomUUID(),
    userId: user.id,
    deviceId,
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    outcome: 'conflict',
    baseVersion: operation.baseVersion ?? null,
    resultingVersion: null,
    currentVersion: conflict.currentVersion,
    reasonCode: 'VERSION_CONFLICT',
    message: `baseVersion ${conflict.baseVersion} 與 currentVersion ${conflict.currentVersion} 不一致`,
    clientCreatedAt: new Date(operation.clientCreatedAt),
    clientUpdatedAt: new Date(operation.clientUpdatedAt),
    entityUpdatedAt: new Date(conflict.serverEntity.updatedAt),
    serverRecordedAt: new Date(),
  });
}

async function resolveDuplicateReceipt(
  user: SessionUser,
  receipt: SyncOperationReceipt,
): Promise<
  | { type: 'accepted'; accepted: SyncAcceptedOperation }
  | { type: 'rejected'; rejected: SyncRejectedOperation }
  | { type: 'conflict'; conflict: SyncConflict }
  | null
> {
  if (receipt.outcome === 'accepted') {
    return {
      type: 'accepted',
      accepted: {
        operationId: receipt.operationId,
        entityType: receipt.entityType as SyncOperationInput['entityType'],
        operationType: receipt.operationType as SyncOperationInput['operationType'],
        entityId: receipt.entityId,
        version: receipt.resultingVersion ?? 1,
        updatedAt:
          receipt.entityUpdatedAt?.toISOString() ??
          receipt.serverRecordedAt.toISOString(),
      },
    };
  }

  if (receipt.outcome === 'rejected') {
    return {
      type: 'rejected',
      rejected: {
        operationId: receipt.operationId,
        entityType: receipt.entityType as SyncOperationInput['entityType'],
        operationType: receipt.operationType as SyncOperationInput['operationType'],
        entityId: receipt.entityId,
        reason: receipt.reasonCode ?? 'SYNC_REJECTED',
        message: receipt.message ?? '這筆同步操作已被拒絕',
      },
    };
  }

  if (receipt.entityType === 'item') {
    const item = await findSyncItemByIdForUser(receipt.entityId, user.id);

    if (!item) {
      return null;
    }

    return {
      type: 'conflict',
      conflict: {
        operationId: receipt.operationId,
        entityType: 'item',
        operationType: receipt.operationType as SyncOperationInput['operationType'],
        entityId: receipt.entityId,
        baseVersion: receipt.baseVersion ?? 0,
        currentVersion: item.version,
        serverEntity: mapSyncItemEntity(item),
      },
    };
  }

  const record = await findSyncRecordByIdForUser(receipt.entityId, user.id);

  if (!record) {
    return null;
  }

  return {
    type: 'conflict',
    conflict: {
      operationId: receipt.operationId,
      entityType: 'record',
      operationType: receipt.operationType as SyncOperationInput['operationType'],
      entityId: receipt.entityId,
      baseVersion: receipt.baseVersion ?? 0,
      currentVersion: record.version,
      serverEntity: mapSyncRecordEntity(record),
    },
  };
}

async function upsertDeviceSessionState(input: {
  user: SessionUser;
  deviceId: string;
  serverTime: Date;
  status: SyncDeviceSession['lastSyncStatus'];
  startedAt?: Date | null;
  completedAt?: Date | null;
  pushAt?: Date | null;
  pullAt?: Date | null;
  checkpointAt?: Date | null;
  checkpointCursor?: string | null;
  errorCode?: string | null;
}) {
  const existingSession = await findSyncDeviceSessionByUserAndDeviceId(
    input.user.id,
    input.deviceId,
  );

  return upsertSyncDeviceSession({
    id: existingSession?.id ?? randomUUID(),
    userId: input.user.id,
    deviceId: input.deviceId,
    lastSeenAt: input.serverTime,
    lastSyncStartedAt:
      input.startedAt ?? existingSession?.lastSyncStartedAt ?? null,
    lastSyncCompletedAt:
      input.completedAt ?? existingSession?.lastSyncCompletedAt ?? null,
    lastPushAt: input.pushAt ?? existingSession?.lastPushAt ?? null,
    lastPullAt: input.pullAt ?? existingSession?.lastPullAt ?? null,
    lastCheckpointAt:
      input.checkpointAt ?? existingSession?.lastCheckpointAt ?? null,
    lastCheckpointCursor:
      input.checkpointCursor ?? existingSession?.lastCheckpointCursor ?? null,
    lastSyncStatus: input.status,
    lastErrorCode: input.errorCode ?? null,
    lastErrorAt: input.errorCode ? input.serverTime : null,
    createdAt: existingSession?.createdAt ?? input.serverTime,
    updatedAt: input.serverTime,
  });
}

function assertScaleConfig(
  valueType: Item['valueType'],
  scaleMin: number | null,
  scaleMax: number | null,
) {
  if (valueType !== 'scale') {
    if (scaleMin !== null || scaleMax !== null) {
      throw new Error('只有量表型項目可以設定最小值與最大值');
    }

    return;
  }

  if (scaleMin === null || scaleMax === null) {
    throw new Error('量表型項目必須同時設定最小值與最大值');
  }

  if (scaleMin >= scaleMax) {
    throw new Error('量表最大值必須大於最小值');
  }
}

function validateRecordValue(
  item: Item | null | undefined,
  value: number | boolean | string,
) {
  if (!item) {
    throw new Error('找不到對應的項目');
  }

  if (item.deletedAt) {
    throw new Error('已刪除項目不能建立或更新紀錄');
  }

  if (item.archived) {
    throw new Error('已封存項目不能建立或更新紀錄');
  }

  switch (item.valueType) {
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error('此項目需要數字值');
      }
      return { valueNumber: value, valueBoolean: null, valueText: null };
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error('此項目需要是 / 否值');
      }
      return { valueNumber: null, valueBoolean: value, valueText: null };
    case 'scale': {
      if (
        typeof value !== 'number' ||
        Number.isNaN(value) ||
        !Number.isInteger(value)
      ) {
        throw new Error('量表紀錄必須是整數');
      }

      const min = item.scaleMin ?? 0;
      const max = item.scaleMax ?? 0;

      if (value < min || value > max) {
        throw new Error(`量表紀錄需介於 ${min} 到 ${max} 之間`);
      }

      return { valueNumber: value, valueBoolean: null, valueText: null };
    }
    case 'text':
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('此項目需要文字內容');
      }
      return { valueNumber: null, valueBoolean: null, valueText: value.trim() };
  }
}

async function handlePushItemCreate(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  payload: SyncItemCreatePayload,
  serverTime: Date,
) {
  const existingItem = await findSyncItemById(operation.entityId);

  if (existingItem) {
    if (existingItem.userId === user.id && existingItem.deletedAt === null) {
      return {
        type: 'accepted' as const,
        accepted: createAcceptedOperation(
          operation,
          existingItem.version,
          existingItem.updatedAt,
        ),
      };
    }

    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_ALREADY_EXISTS',
        '這個 item 已存在',
      ),
    };
  }

  const createdAt = new Date(operation.clientCreatedAt);
  const updatedAt = new Date(operation.clientUpdatedAt);

  const item = await createSyncItemRecord({
    id: operation.entityId,
    userId: user.id,
    title: payload.title,
    type: payload.type,
    unit: payload.unit ?? null,
    valueType: payload.valueType,
    scaleMin: payload.scaleMin ?? null,
    scaleMax: payload.scaleMax ?? null,
    archived: false,
    syncStatus: 'synced',
    version: 1,
    deletedAt: null,
    lastSyncedAt: serverTime,
    deviceId,
    createdAt,
    updatedAt,
  });

  return {
    type: 'accepted' as const,
    accepted: createAcceptedOperation(operation, item.version, item.updatedAt),
  };
}

async function handlePushItemUpdate(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  payload: SyncItemUpdatePayload,
  serverTime: Date,
) {
  const existingItem = await findSyncItemByIdForUser(operation.entityId, user.id);

  if (!existingItem) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_NOT_FOUND',
        '找不到這個 item',
      ),
    };
  }

  if (existingItem.deletedAt) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_DELETED',
        '這個 item 已刪除',
      ),
    };
  }

  if (operation.baseVersion !== existingItem.version) {
    return {
      type: 'conflict' as const,
      conflict: createConflict(
        operation,
        existingItem.version,
        mapSyncItemEntity(existingItem),
      ),
    };
  }

  const nextScaleMin =
    payload.scaleMin === undefined ? existingItem.scaleMin : payload.scaleMin;
  const nextScaleMax =
    payload.scaleMax === undefined ? existingItem.scaleMax : payload.scaleMax;

  try {
    assertScaleConfig(existingItem.valueType, nextScaleMin ?? null, nextScaleMax ?? null);
  } catch (error) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'PAYLOAD_INVALID',
        error instanceof Error ? error.message : '項目 payload 無效',
      ),
    };
  }

  const item = await updateSyncItemRecord(existingItem.id, user.id, {
    title: payload.title ?? existingItem.title,
    unit: payload.unit === undefined ? existingItem.unit : payload.unit,
    archived: payload.archived ?? existingItem.archived,
    scaleMin: nextScaleMin,
    scaleMax: nextScaleMax,
    version: existingItem.version + 1,
    updatedAt: new Date(operation.clientUpdatedAt),
    lastSyncedAt: serverTime,
    deviceId,
    syncStatus: 'synced',
  });

  return {
    type: 'accepted' as const,
    accepted: createAcceptedOperation(operation, item?.version ?? 0, item?.updatedAt ?? serverTime),
  };
}

async function handlePushItemDelete(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  serverTime: Date,
) {
  const existingItem = await findSyncItemByIdForUser(operation.entityId, user.id);

  if (!existingItem) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_NOT_FOUND',
        '找不到這個 item',
      ),
    };
  }

  if (existingItem.deletedAt) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_DELETED',
        '這個 item 已刪除',
      ),
    };
  }

  if (operation.baseVersion !== existingItem.version) {
    return {
      type: 'conflict' as const,
      conflict: createConflict(
        operation,
        existingItem.version,
        mapSyncItemEntity(existingItem),
      ),
    };
  }

  const item = await updateSyncItemRecord(existingItem.id, user.id, {
    deletedAt: new Date(operation.clientUpdatedAt),
    updatedAt: new Date(operation.clientUpdatedAt),
    version: existingItem.version + 1,
    lastSyncedAt: serverTime,
    deviceId,
    syncStatus: 'synced',
  });

  return {
    type: 'accepted' as const,
    accepted: createAcceptedOperation(operation, item?.version ?? 0, item?.updatedAt ?? serverTime),
  };
}

async function handlePushRecordCreate(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  payload: SyncRecordCreatePayload,
  serverTime: Date,
) {
  const existingRecord = await findSyncRecordById(operation.entityId);

  if (existingRecord) {
    if (existingRecord.userId === user.id && existingRecord.deletedAt === null) {
      return {
        type: 'accepted' as const,
        accepted: createAcceptedOperation(
          operation,
          existingRecord.version,
          existingRecord.updatedAt,
        ),
      };
    }

    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_ALREADY_EXISTS',
        '這筆 record 已存在',
      ),
    };
  }

  const item = await findItemByIdForUser(payload.itemId, user.id);
  let valueFields: {
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueText: string | null;
  };

  try {
    valueFields = validateRecordValue(item, payload.value);
  } catch (error) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'PAYLOAD_INVALID',
        error instanceof Error ? error.message : '紀錄 payload 無效',
      ),
    };
  }

  const createdAt = new Date(operation.clientCreatedAt);
  const updatedAt = new Date(operation.clientUpdatedAt);

  const record = await createSyncRecordRecord({
    id: operation.entityId,
    userId: user.id,
    itemId: payload.itemId,
    recordedAt: new Date(payload.recordedAt),
    note: payload.note ?? null,
    ...valueFields,
    syncStatus: 'synced',
    version: 1,
    deletedAt: null,
    lastSyncedAt: serverTime,
    deviceId,
    createdAt,
    updatedAt,
  });

  return {
    type: 'accepted' as const,
    accepted: createAcceptedOperation(operation, record.version, record.updatedAt),
  };
}

async function handlePushRecordUpdate(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  payload: SyncRecordUpdatePayload,
  serverTime: Date,
) {
  const existingRecord = await findSyncRecordByIdForUser(operation.entityId, user.id);

  if (!existingRecord) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_NOT_FOUND',
        '找不到這筆 record',
      ),
    };
  }

  if (existingRecord.deletedAt) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_DELETED',
        '這筆 record 已刪除',
      ),
    };
  }

  if (operation.baseVersion !== existingRecord.version) {
    return {
      type: 'conflict' as const,
      conflict: createConflict(
        operation,
        existingRecord.version,
        mapSyncRecordEntity(existingRecord),
      ),
    };
  }

  const itemId = payload.itemId ?? existingRecord.itemId;
  const item = await findItemByIdForUser(itemId, user.id);
  const nextValue =
    payload.value ??
    (existingRecord.valueNumber ??
      existingRecord.valueBoolean ??
      existingRecord.valueText ??
      '');

  let valueFields: {
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueText: string | null;
  };

  try {
    valueFields = validateRecordValue(item, nextValue);
  } catch (error) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'PAYLOAD_INVALID',
        error instanceof Error ? error.message : '紀錄 payload 無效',
      ),
    };
  }

  const record = await updateSyncRecordRecord(existingRecord.id, user.id, {
    itemId,
    recordedAt: payload.recordedAt
      ? new Date(payload.recordedAt)
      : existingRecord.recordedAt,
    note: payload.note === undefined ? existingRecord.note : payload.note,
    ...valueFields,
    version: existingRecord.version + 1,
    updatedAt: new Date(operation.clientUpdatedAt),
    lastSyncedAt: serverTime,
    deviceId,
    syncStatus: 'synced',
  });

  return {
    type: 'accepted' as const,
    accepted: createAcceptedOperation(operation, record?.version ?? 0, record?.updatedAt ?? serverTime),
  };
}

async function handlePushRecordDelete(
  user: SessionUser,
  deviceId: string,
  operation: SyncOperationInput,
  serverTime: Date,
) {
  const existingRecord = await findSyncRecordByIdForUser(operation.entityId, user.id);

  if (!existingRecord) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_NOT_FOUND',
        '找不到這筆 record',
      ),
    };
  }

  if (existingRecord.deletedAt) {
    return {
      type: 'rejected' as const,
      rejected: createRejectedOperation(
        operation,
        'ENTITY_DELETED',
        '這筆 record 已刪除',
      ),
    };
  }

  if (operation.baseVersion !== existingRecord.version) {
    return {
      type: 'conflict' as const,
      conflict: createConflict(
        operation,
        existingRecord.version,
        mapSyncRecordEntity(existingRecord),
      ),
    };
  }

  const record = await updateSyncRecordRecord(existingRecord.id, user.id, {
    deletedAt: new Date(operation.clientUpdatedAt),
    updatedAt: new Date(operation.clientUpdatedAt),
    version: existingRecord.version + 1,
    lastSyncedAt: serverTime,
    deviceId,
    syncStatus: 'synced',
  });

  return {
    type: 'accepted' as const,
    accepted: createAcceptedOperation(operation, record?.version ?? 0, record?.updatedAt ?? serverTime),
  };
}

export async function pushSyncOperationsForUser(
  user: SessionUser,
  input: SyncPushRequestInput,
): Promise<SyncPushResponse> {
  await ensureSessionUserRecord(user);
  await recordDeviceSeenForUser({
    user,
    deviceId: input.deviceId,
  });

  const serverTime = new Date();
  await upsertDeviceSessionState({
    user,
    deviceId: input.deviceId,
    serverTime,
    status: 'syncing',
    startedAt: serverTime,
    pushAt: serverTime,
  });

  const accepted: SyncAcceptedOperation[] = [];
  const rejected: SyncRejectedOperation[] = [];
  const conflicts: SyncConflict[] = [];
  let duplicateOperationCount = 0;

  for (const operation of input.operations) {
    const existingReceipt = await findSyncOperationReceiptByUserAndOperationId(
      user.id,
      operation.operationId,
    );

    if (existingReceipt) {
      duplicateOperationCount += 1;
      const duplicateResult = await resolveDuplicateReceipt(user, existingReceipt);

      if (duplicateResult?.type === 'accepted') {
        accepted.push(duplicateResult.accepted);
      } else if (duplicateResult?.type === 'conflict') {
        conflicts.push(duplicateResult.conflict);
      } else if (duplicateResult?.type === 'rejected') {
        rejected.push(duplicateResult.rejected);
      }

      continue;
    }

    if (operation.entityType === 'item' && operation.operationType === 'create') {
      const result = await handlePushItemCreate(
        user,
        input.deviceId,
        operation,
        operation.payload as SyncItemCreatePayload,
        serverTime,
      );

      if (result.type === 'accepted') {
        accepted.push(result.accepted);
        await saveAcceptedReceipt(user, input.deviceId, operation, result.accepted);
      } else {
        rejected.push(result.rejected);
        await saveRejectedReceipt(user, input.deviceId, operation, result.rejected);
      }
      continue;
    }

    if (operation.entityType === 'item' && operation.operationType === 'update') {
      const result = await handlePushItemUpdate(
        user,
        input.deviceId,
        operation,
        operation.payload as SyncItemUpdatePayload,
        serverTime,
      );

      if (result.type === 'accepted') {
        accepted.push(result.accepted);
        await saveAcceptedReceipt(user, input.deviceId, operation, result.accepted);
      } else if (result.type === 'conflict') {
        conflicts.push(result.conflict);
        await saveConflictReceipt(user, input.deviceId, operation, result.conflict);
      } else {
        rejected.push(result.rejected);
        await saveRejectedReceipt(user, input.deviceId, operation, result.rejected);
      }
      continue;
    }

    if (operation.entityType === 'item' && operation.operationType === 'delete') {
      const result = await handlePushItemDelete(
        user,
        input.deviceId,
        operation,
        serverTime,
      );

      if (result.type === 'accepted') {
        accepted.push(result.accepted);
        await saveAcceptedReceipt(user, input.deviceId, operation, result.accepted);
      } else if (result.type === 'conflict') {
        conflicts.push(result.conflict);
        await saveConflictReceipt(user, input.deviceId, operation, result.conflict);
      } else {
        rejected.push(result.rejected);
        await saveRejectedReceipt(user, input.deviceId, operation, result.rejected);
      }
      continue;
    }

    if (operation.entityType === 'record' && operation.operationType === 'create') {
      const result = await handlePushRecordCreate(
        user,
        input.deviceId,
        operation,
        operation.payload as SyncRecordCreatePayload,
        serverTime,
      );

      if (result.type === 'accepted') {
        accepted.push(result.accepted);
        await saveAcceptedReceipt(user, input.deviceId, operation, result.accepted);
      } else {
        rejected.push(result.rejected);
        await saveRejectedReceipt(user, input.deviceId, operation, result.rejected);
      }
      continue;
    }

    if (operation.entityType === 'record' && operation.operationType === 'update') {
      const result = await handlePushRecordUpdate(
        user,
        input.deviceId,
        operation,
        operation.payload as SyncRecordUpdatePayload,
        serverTime,
      );

      if (result.type === 'accepted') {
        accepted.push(result.accepted);
        await saveAcceptedReceipt(user, input.deviceId, operation, result.accepted);
      } else if (result.type === 'conflict') {
        conflicts.push(result.conflict);
        await saveConflictReceipt(user, input.deviceId, operation, result.conflict);
      } else {
        rejected.push(result.rejected);
        await saveRejectedReceipt(user, input.deviceId, operation, result.rejected);
      }
      continue;
    }

    const result = await handlePushRecordDelete(
      user,
      input.deviceId,
      operation,
      serverTime,
    );

    if (result.type === 'accepted') {
      accepted.push(result.accepted);
      await saveAcceptedReceipt(user, input.deviceId, operation, result.accepted);
    } else if (result.type === 'conflict') {
      conflicts.push(result.conflict);
      await saveConflictReceipt(user, input.deviceId, operation, result.conflict);
    } else {
      rejected.push(result.rejected);
      await saveRejectedReceipt(user, input.deviceId, operation, result.rejected);
    }
  }

  const session = await upsertDeviceSessionState({
    user,
    deviceId: input.deviceId,
    serverTime,
    status:
      conflicts.length > 0
        ? 'conflict'
        : rejected.length > 0
          ? 'failed'
          : 'synced',
    startedAt: serverTime,
    completedAt: serverTime,
    pushAt: serverTime,
    errorCode:
      conflicts.length > 0
        ? 'SYNC_CONFLICT'
        : rejected.length > 0
          ? rejected[0]?.reason ?? 'SYNC_REJECTED'
          : null,
  });

  return {
    accepted,
    rejected,
    conflicts,
    deviceSession: mapSyncDeviceSessionEntity(session),
    diagnostics: createDiagnosticsSummary({
      duplicateOperationCount,
      acceptedOperationCount: accepted.length,
      rejectedOperationCount: rejected.length,
      conflictOperationCount: conflicts.length,
    }),
    serverTime: serverTime.toISOString(),
  };
}

export async function pullSyncChangesForUser(
  user: SessionUser,
  input: SyncPullRequestInput,
): Promise<SyncPullResponse> {
  await ensureSessionUserRecord(user);
  await recordDeviceSeenForUser({
    user,
    deviceId: input.deviceId,
    markMerged: true,
  });

  const serverTime = new Date();
  await upsertDeviceSessionState({
    user,
    deviceId: input.deviceId,
    serverTime,
    status: 'syncing',
    startedAt: serverTime,
    pullAt: serverTime,
  });

  const since =
    input.lastPulledAt !== undefined ? new Date(input.lastPulledAt) : undefined;
  const until = input.checkpoint?.until
    ? new Date(input.checkpoint.until)
    : serverTime;
  const limit = input.checkpoint?.limit ?? 100;
  const cursor = input.checkpoint?.cursor
    ? parseCursorToken(input.checkpoint.cursor)
    : null;

  const [itemChanges, recordChanges] = await Promise.all([
    listSyncItemChangesByUserId(user.id, {
      since,
      until,
    }),
    listSyncRecordChangesByUserId(user.id, {
      since,
      until,
    }),
  ]);

  const combinedChanges: CombinedSyncChange[] = [
    ...itemChanges.map((item) => ({ entityType: 'item' as const, entity: item })),
    ...recordChanges.map((record) => ({
      entityType: 'record' as const,
      entity: record,
    })),
  ]
    .sort(compareSyncChanges)
    .filter((change) => isAfterCursor(change, cursor));

  const pageChanges = combinedChanges.slice(0, limit);
  const hasMore = combinedChanges.length > pageChanges.length;
  const nextCursor =
    hasMore && pageChanges.length > 0
      ? createCursorToken(pageChanges[pageChanges.length - 1]!)
      : null;

  const items = pageChanges
    .filter((change): change is { entityType: 'item'; entity: Item } => change.entityType === 'item')
    .map((change) => change.entity);
  const records = pageChanges
    .filter(
      (change): change is { entityType: 'record'; entity: Record } =>
        change.entityType === 'record',
    )
    .map((change) => change.entity);

  const checkpoint: SyncPullCheckpoint = {
    since: input.lastPulledAt ?? null,
    until: until.toISOString(),
    nextCursor,
    hasMore,
    limit,
    returnedCount: pageChanges.length,
  };

  const session = await upsertDeviceSessionState({
    user,
    deviceId: input.deviceId,
    serverTime,
    status: hasMore ? 'syncing' : 'synced',
    startedAt: serverTime,
    completedAt: hasMore ? null : serverTime,
    pullAt: serverTime,
    checkpointAt: until,
    checkpointCursor: nextCursor,
  });

  return {
    items: items.filter((item) => item.deletedAt === null).map(mapSyncItemEntity),
    records: records
      .filter((record) => record.deletedAt === null)
      .map(mapSyncRecordEntity),
    tombstones: [
      ...items.filter((item) => item.deletedAt !== null).map(mapItemTombstone),
      ...records
        .filter((record) => record.deletedAt !== null)
        .map(mapRecordTombstone),
    ],
    checkpoint,
    deviceSession: mapSyncDeviceSessionEntity(session),
    diagnostics: createDiagnosticsSummary({
      pulledItemCount: items.filter((item) => item.deletedAt === null).length,
      pulledRecordCount: records.filter((record) => record.deletedAt === null).length,
      pulledTombstoneCount:
        items.filter((item) => item.deletedAt !== null).length +
        records.filter((record) => record.deletedAt !== null).length,
    }),
    serverTime: serverTime.toISOString(),
  };
}
