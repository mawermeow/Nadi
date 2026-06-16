import type { Item, Record } from '@/db/schema';
import { ensureSessionUserRecord } from '@/features/auth/service';
import { findItemByIdForUser } from '@/features/items/repository';
import type { SessionUser } from '@/lib/auth/session';

import type {
  SyncAcceptedOperation,
  SyncConflict,
  SyncItemEntity,
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
  findSyncRecordById,
  findSyncRecordByIdForUser,
  listSyncItemsByUserId,
  listSyncRecordsByUserId,
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

  const serverTime = new Date();
  const accepted: SyncAcceptedOperation[] = [];
  const rejected: SyncRejectedOperation[] = [];
  const conflicts: SyncConflict[] = [];

  for (const operation of input.operations) {
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
      } else {
        rejected.push(result.rejected);
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
      } else if (result.type === 'conflict') {
        conflicts.push(result.conflict);
      } else {
        rejected.push(result.rejected);
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
      } else if (result.type === 'conflict') {
        conflicts.push(result.conflict);
      } else {
        rejected.push(result.rejected);
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
      } else {
        rejected.push(result.rejected);
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
      } else if (result.type === 'conflict') {
        conflicts.push(result.conflict);
      } else {
        rejected.push(result.rejected);
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
    } else if (result.type === 'conflict') {
      conflicts.push(result.conflict);
    } else {
      rejected.push(result.rejected);
    }
  }

  return {
    accepted,
    rejected,
    conflicts,
    serverTime: serverTime.toISOString(),
  };
}

export async function pullSyncChangesForUser(
  user: SessionUser,
  input: SyncPullRequestInput,
): Promise<SyncPullResponse> {
  await ensureSessionUserRecord(user);

  const lastPulledAt = input.lastPulledAt ? new Date(input.lastPulledAt) : undefined;
  const serverTime = new Date();
  const [items, records] = await Promise.all([
    listSyncItemsByUserId(user.id, lastPulledAt),
    listSyncRecordsByUserId(user.id, lastPulledAt),
  ]);

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
    serverTime: serverTime.toISOString(),
  };
}
