import type { ItemResponse } from '@/features/items/api';
import { itemLocalRepository } from '@/features/items/local-repository';
import type { RecordResponse } from '@/features/records/api';
import { recordLocalRepository } from '@/features/records/local-repository';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import type {
  LocalItem,
  LocalRecord,
  LocalSyncOperation,
  SyncStatus,
} from '@/lib/local-db/types';

type LocalRecordQuery = {
  itemId?: string;
  itemType?: 'metric' | 'symptom';
  from?: string;
  to?: string;
  limit?: number;
};

export type SyncStatusPresentation = {
  label: string;
  className: string;
};

export type SyncOperationIssue = {
  operationId: string;
  entityType: 'item' | 'record';
  operationType: 'create' | 'update' | 'delete';
  entityId: string;
  status: 'failed' | 'conflict';
  statusLabel: string;
  title: string;
  updatedAt: string;
  lastError: string | null;
};

export function getSyncStatusPresentation(
  syncStatus: SyncStatus | undefined,
): SyncStatusPresentation | null {
  switch (syncStatus) {
    case 'pending':
      return {
        label: '等待同步',
        className: 'bg-amber-100 text-amber-800',
      };
    case 'failed':
      return {
        label: '同步失敗',
        className: 'bg-rose-100 text-rose-800',
      };
    case 'conflict':
      return {
        label: '同步衝突',
        className: 'bg-violet-100 text-violet-800',
      };
    default:
      return null;
  }
}

export function mapLocalItemToItemResponse(item: LocalItem): ItemResponse {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    unit: item.unit ?? undefined,
    valueType: item.valueType,
    scaleMin: item.scaleMin ?? undefined,
    scaleMax: item.scaleMax ?? undefined,
    archived: item.archived,
    syncStatus: item.syncStatus,
    version: item.version,
    createdAt: item.createdAt,
  };
}

function getSyncOperationStatusLabel(status: LocalSyncOperation['status']) {
  return status === 'conflict' ? '同步衝突' : '同步失敗';
}

function getSyncOperationTitle(operation: LocalSyncOperation) {
  const entityLabel = operation.entityType === 'item' ? '項目' : '紀錄';
  const operationLabel =
    operation.operationType === 'create'
      ? '新增'
      : operation.operationType === 'update'
        ? '更新'
        : '刪除';

  return `${entityLabel}${operationLabel}`;
}

function mapSyncOperationIssue(
  operation: LocalSyncOperation,
): SyncOperationIssue | null {
  if (operation.status !== 'failed' && operation.status !== 'conflict') {
    return null;
  }

  return {
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    status: operation.status,
    statusLabel: getSyncOperationStatusLabel(operation.status),
    title: getSyncOperationTitle(operation),
    updatedAt: operation.updatedAt,
    lastError: operation.lastError,
  };
}

function mapLocalRecordValue(record: LocalRecord, valueType: LocalItem['valueType']) {
  switch (valueType) {
    case 'number':
    case 'scale':
      return record.valueNumber ?? 0;
    case 'boolean':
      return record.valueBoolean ?? false;
    case 'text':
      return record.valueText ?? '';
  }
}

export function mapLocalRecordToRecordResponse(
  record: LocalRecord,
  item: LocalItem,
): RecordResponse {
  return {
    id: record.id,
    itemId: record.itemId,
    itemTitle: item.title,
    itemType: item.type,
    valueType: item.valueType,
    value: mapLocalRecordValue(record, item.valueType),
    unit: item.unit ?? undefined,
    recordedAt: record.recordedAt,
    note: record.note ?? undefined,
    itemArchived: item.archived,
    syncStatus: record.syncStatus,
    version: record.version,
    createdAt: record.createdAt,
  };
}

function toLocalItemFromResponse(item: ItemResponse): LocalItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    unit: item.unit ?? null,
    valueType: item.valueType,
    scaleMin: item.scaleMin ?? null,
    scaleMax: item.scaleMax ?? null,
    archived: item.archived,
    syncStatus: item.syncStatus ?? 'synced',
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    deletedAt: null,
    version: item.version,
    lastSyncedAt: item.createdAt,
    deviceId: null,
  };
}

function inferLocalRecordValueFields(record: RecordResponse) {
  switch (record.valueType) {
    case 'number':
    case 'scale':
      return {
        valueNumber: typeof record.value === 'number' ? record.value : null,
        valueBoolean: null,
        valueText: null,
      };
    case 'boolean':
      return {
        valueNumber: null,
        valueBoolean: typeof record.value === 'boolean' ? record.value : false,
        valueText: null,
      };
    case 'text':
      return {
        valueNumber: null,
        valueBoolean: null,
        valueText: typeof record.value === 'string' ? record.value : '',
      };
  }
}

function toLocalRecordFromResponse(record: RecordResponse): LocalRecord {
  return {
    id: record.id,
    itemId: record.itemId,
    ...inferLocalRecordValueFields(record),
    recordedAt: record.recordedAt,
    note: record.note ?? null,
    syncStatus: record.syncStatus ?? 'synced',
    createdAt: record.createdAt,
    updatedAt: record.recordedAt,
    deletedAt: null,
    version: record.version,
    lastSyncedAt: record.createdAt,
    deviceId: null,
  };
}

export async function hydrateLocalStoreFromServerSnapshot(input: {
  items: ItemResponse[];
  records: RecordResponse[];
}) {
  const [existingItems, existingRecords] = await Promise.all([
    itemLocalRepository.getAll({ includeDeleted: true }),
    recordLocalRepository.getAll({ includeDeleted: true }),
  ]);

  if (existingItems.length === 0) {
    for (const item of input.items) {
      await itemLocalRepository.upsert(toLocalItemFromResponse(item));
    }
  }

  if (existingRecords.length === 0) {
    for (const record of input.records) {
      await recordLocalRepository.upsert(toLocalRecordFromResponse(record));
    }
  }
}

export async function loadLocalItems() {
  const items = await itemLocalRepository.getAll({ includeDeleted: true });
  return items
    .filter((item) => item.deletedAt === null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(mapLocalItemToItemResponse);
}

export async function loadLocalRecords(query: LocalRecordQuery = {}) {
  const [items, records] = await Promise.all([
    itemLocalRepository.getAll({ includeDeleted: true }),
    recordLocalRepository.getAll({ includeDeleted: true }),
  ]);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const filteredRecords = records
    .filter((record) => {
      if (record.deletedAt !== null) {
        return false;
      }

      const item = itemMap.get(record.itemId);

      if (!item || item.deletedAt !== null) {
        return false;
      }

      if (query.itemId && record.itemId !== query.itemId) {
        return false;
      }

      if (query.itemType && item.type !== query.itemType) {
        return false;
      }

      if (query.from && record.recordedAt < query.from) {
        return false;
      }

      if (query.to && record.recordedAt > query.to) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const recordedAtCompare = right.recordedAt.localeCompare(left.recordedAt);

      if (recordedAtCompare !== 0) {
        return recordedAtCompare;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });

  const limitedRecords =
    typeof query.limit === 'number'
      ? filteredRecords.slice(0, query.limit)
      : filteredRecords;

  return limitedRecords.map((record) =>
    mapLocalRecordToRecordResponse(record, itemMap.get(record.itemId)!),
  );
}

export async function loadSyncOperationIssues(limit = 8) {
  const operations = await syncOperationRepository.getAll();

  return operations
    .map(mapSyncOperationIssue)
    .filter((value): value is SyncOperationIssue => value !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}
