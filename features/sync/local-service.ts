import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { getOrCreateDeviceId } from '@/features/sync/device';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import type { LocalItem, LocalRecord } from '@/lib/local-db/types';

type CreateLocalItemInput = {
  id?: string;
  title: string;
  type: 'metric' | 'symptom';
  unit?: string | null;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin?: number | null;
  scaleMax?: number | null;
};

type UpdateLocalItemInput = {
  id: string;
  title?: string;
  unit?: string | null;
  archived?: boolean;
  scaleMin?: number | null;
  scaleMax?: number | null;
};

type CreateLocalRecordInput = {
  id?: string;
  itemId: string;
  value: number | boolean | string;
  recordedAt: string;
  note?: string | null;
};

type UpdateLocalRecordInput = {
  id: string;
  itemId?: string;
  value?: number | boolean | string;
  recordedAt?: string;
  note?: string | null;
};

function validateLocalItemScale(
  valueType: LocalItem['valueType'],
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

function mapLocalRecordValue(
  item: LocalItem,
  value: number | boolean | string,
) {
  switch (item.valueType) {
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error('此項目需要數字值');
      }

      return {
        valueNumber: value,
        valueBoolean: null,
        valueText: null,
      };
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error('此項目需要是 / 否值');
      }

      return {
        valueNumber: null,
        valueBoolean: value,
        valueText: null,
      };
    case 'scale':
      if (
        typeof value !== 'number' ||
        Number.isNaN(value) ||
        !Number.isInteger(value)
      ) {
        throw new Error('量表紀錄必須是整數');
      }

      if (
        item.scaleMin === null ||
        item.scaleMax === null ||
        value < item.scaleMin ||
        value > item.scaleMax
      ) {
        throw new Error(
          `量表紀錄需介於 ${item.scaleMin ?? 0} 到 ${item.scaleMax ?? 0} 之間`,
        );
      }

      return {
        valueNumber: value,
        valueBoolean: null,
        valueText: null,
      };
    case 'text':
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('此項目需要文字內容');
      }

      return {
        valueNumber: null,
        valueBoolean: null,
        valueText: value.trim(),
      };
  }
}

async function createPendingOperation(input: {
  deviceId: string;
  entityType: 'item' | 'record';
  operationType: 'create' | 'update' | 'delete';
  entityId: string;
  baseVersion: number | null;
  payload: unknown;
  timestamp: string;
}) {
  const operationId = crypto.randomUUID();

  await syncOperationRepository.upsert({
    id: operationId,
    operationId,
    entityType: input.entityType,
    operationType: input.operationType,
    entityId: input.entityId,
    baseVersion: input.baseVersion,
    payload: input.payload,
    status: 'pending',
    syncStatus: 'pending',
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    deletedAt: null,
    version: 1,
    lastSyncedAt: null,
    deviceId: input.deviceId,
    retryCount: 0,
    lastError: null,
  });
}

async function removeRelatedPendingOperations(input: {
  entityType: 'item' | 'record';
  entityId: string;
}) {
  const operations = await syncOperationRepository.getAll();
  const relatedOperations = operations
    .filter(
      (operation) =>
        operation.entityType === input.entityType &&
        operation.entityId === input.entityId &&
        operation.status !== 'synced',
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const operation of relatedOperations) {
    await syncOperationRepository.delete(operation.id);
  }

  return relatedOperations;
}

async function getItemRecordHistoryCount(itemId: string) {
  const records = await recordLocalRepository.getAll({ includeDeleted: true });
  return records.filter((record) => record.itemId === itemId).length;
}

export async function createLocalItem(input: CreateLocalItemInput) {
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const scaleMin = input.scaleMin ?? null;
  const scaleMax = input.scaleMax ?? null;

  validateLocalItemScale(input.valueType, scaleMin, scaleMax);

  const item: LocalItem = {
    id,
    title: input.title,
    type: input.type,
    unit: input.unit ?? null,
    valueType: input.valueType,
    scaleMin,
    scaleMax,
    archived: false,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    lastSyncedAt: null,
    deviceId,
  };

  await itemLocalRepository.upsert(item);
  await createPendingOperation({
    deviceId,
    entityType: 'item',
    operationType: 'create',
    entityId: id,
    baseVersion: null,
    payload: {
      title: item.title,
      type: item.type,
      unit: item.unit,
      valueType: item.valueType,
      scaleMin: item.scaleMin,
      scaleMax: item.scaleMax,
    },
    timestamp: now,
  });

  return item;
}

export async function updateLocalItem(input: UpdateLocalItemInput) {
  const existingItem = await itemLocalRepository.getById(input.id);

  if (!existingItem || existingItem.deletedAt !== null) {
    throw new Error('找不到這個本機項目');
  }

  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const nextScaleMin =
    input.scaleMin === undefined ? existingItem.scaleMin : input.scaleMin;
  const nextScaleMax =
    input.scaleMax === undefined ? existingItem.scaleMax : input.scaleMax;

  validateLocalItemScale(existingItem.valueType, nextScaleMin, nextScaleMax);

  const nextItem: LocalItem = {
    ...existingItem,
    title: input.title ?? existingItem.title,
    unit: input.unit === undefined ? existingItem.unit : input.unit,
    archived: input.archived ?? existingItem.archived,
    scaleMin: nextScaleMin,
    scaleMax: nextScaleMax,
    syncStatus: 'pending',
    updatedAt: now,
    version: existingItem.version + 1,
    deviceId,
  };

  await itemLocalRepository.upsert(nextItem);
  await createPendingOperation({
    deviceId,
    entityType: 'item',
    operationType: 'update',
    entityId: nextItem.id,
    baseVersion: existingItem.version,
    payload: {
      title: input.title,
      unit: input.unit,
      archived: input.archived,
      scaleMin: input.scaleMin,
      scaleMax: input.scaleMax,
    },
    timestamp: now,
  });

  return nextItem;
}

export async function deleteLocalItem(id: string) {
  const existingItem = await itemLocalRepository.getById(id);

  if (!existingItem || existingItem.deletedAt !== null) {
    throw new Error('找不到這個本機項目');
  }

  const recordHistoryCount = await getItemRecordHistoryCount(id);

  if (recordHistoryCount > 0) {
    throw new Error('已有歷史紀錄的項目只能封存，不能直接刪除');
  }

  const relatedOperations = await removeRelatedPendingOperations({
    entityType: 'item',
    entityId: id,
  });
  await itemLocalRepository.delete(id);

  const hasUnsyncedCreate = relatedOperations.some(
    (operation) => operation.operationType === 'create',
  );

  if (hasUnsyncedCreate) {
    return existingItem;
  }

  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const deleteBaseVersion =
    relatedOperations.find((operation) => operation.baseVersion !== null)
      ?.baseVersion ?? existingItem.version;

  await createPendingOperation({
    deviceId,
    entityType: 'item',
    operationType: 'delete',
    entityId: id,
    baseVersion: deleteBaseVersion,
    payload: {},
    timestamp: now,
  });

  return existingItem;
}

export async function createLocalRecord(input: CreateLocalRecordInput) {
  const item = await itemLocalRepository.getById(input.itemId);

  if (!item || item.deletedAt !== null) {
    throw new Error('找不到對應的本機項目');
  }

  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const valueFields = mapLocalRecordValue(item, input.value);

  const record: LocalRecord = {
    id,
    itemId: input.itemId,
    recordedAt: input.recordedAt,
    note: input.note ?? null,
    ...valueFields,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    lastSyncedAt: null,
    deviceId,
  };

  await recordLocalRepository.upsert(record);
  await createPendingOperation({
    deviceId,
    entityType: 'record',
    operationType: 'create',
    entityId: id,
    baseVersion: null,
    payload: {
      itemId: record.itemId,
      value: input.value,
      recordedAt: record.recordedAt,
      note: record.note,
    },
    timestamp: now,
  });

  return record;
}

export async function updateLocalRecord(input: UpdateLocalRecordInput) {
  const existingRecord = await recordLocalRepository.getById(input.id);

  if (!existingRecord || existingRecord.deletedAt !== null) {
    throw new Error('找不到這筆本機紀錄');
  }

  const nextItemId = input.itemId ?? existingRecord.itemId;
  const item = await itemLocalRepository.getById(nextItemId);

  if (!item || item.deletedAt !== null) {
    throw new Error('找不到對應的本機項目');
  }

  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const existingValue =
    existingRecord.valueNumber ??
    existingRecord.valueBoolean ??
    existingRecord.valueText ??
    '';
  const nextValue = input.value ?? existingValue;
  const valueFields = mapLocalRecordValue(item, nextValue);

  const nextRecord: LocalRecord = {
    ...existingRecord,
    itemId: nextItemId,
    recordedAt: input.recordedAt ?? existingRecord.recordedAt,
    note: input.note === undefined ? existingRecord.note : input.note,
    ...valueFields,
    syncStatus: 'pending',
    updatedAt: now,
    version: existingRecord.version + 1,
    deviceId,
  };

  await recordLocalRepository.upsert(nextRecord);
  await createPendingOperation({
    deviceId,
    entityType: 'record',
    operationType: 'update',
    entityId: nextRecord.id,
    baseVersion: existingRecord.version,
    payload: {
      itemId: input.itemId,
      value: input.value,
      recordedAt: input.recordedAt,
      note: input.note,
    },
    timestamp: now,
  });

  return nextRecord;
}

export async function deleteLocalRecord(id: string) {
  const existingRecord = await recordLocalRepository.getById(id);

  if (!existingRecord || existingRecord.deletedAt !== null) {
    throw new Error('找不到這筆本機紀錄');
  }

  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const relatedOperations = await removeRelatedPendingOperations({
    entityType: 'record',
    entityId: id,
  });
  const hasUnsyncedCreate = relatedOperations.some(
    (operation) => operation.operationType === 'create',
  );
  const deleteBaseVersion =
    relatedOperations.find((operation) => operation.baseVersion !== null)
      ?.baseVersion ?? existingRecord.version;
  const nextVersion = existingRecord.version + 1;

  const deletedRecord = await recordLocalRepository.softDelete(id, {
    deletedAt: now,
    version: nextVersion,
  });

  if (hasUnsyncedCreate) {
    return deletedRecord;
  }

  await createPendingOperation({
    deviceId,
    entityType: 'record',
    operationType: 'delete',
    entityId: id,
    baseVersion: deleteBaseVersion,
    payload: {},
    timestamp: now,
  });

  return deletedRecord;
}
