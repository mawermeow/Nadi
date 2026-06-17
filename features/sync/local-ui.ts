import type { ItemResponse } from '@/features/items/api';
import { itemLocalRepository } from '@/features/items/local-repository';
import type { RecordResponse } from '@/features/records/api';
import { recordLocalRepository } from '@/features/records/local-repository';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import {
  reconcileActiveLocalDataOwnership,
} from '@/features/sync/local-user-scope';
import { getLinkedAccount } from '@/features/sync/meta';
import type {
  LocalItem,
  LocalRecord,
  LocalSyncOperation,
  SyncStatus,
} from '@/lib/local-db/types';

type LocalRecordQuery = {
  itemId?: string;
  itemType?: 'metric' | 'symptom' | 'both';
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
  displayError: string;
  debugDetails: string[];
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
    sortOrder: item.sortOrder,
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

function getReadableSyncError(
  operation: LocalSyncOperation,
  lastError: string | null,
) {
  if (!lastError) {
    return '未提供詳細原因。';
  }

  if (
    operation.entityType === 'record' &&
    operation.operationType === 'create' &&
    lastError.includes('PAYLOAD_INVALID: 找不到對應的項目')
  ) {
    return '這筆紀錄依賴的項目當時尚未同步到雲端，所以紀錄新增被暫時擋下。';
  }

  if (
    operation.entityType === 'record' &&
    operation.operationType === 'update' &&
    lastError.includes('ENTITY_NOT_FOUND: 找不到這筆 record')
  ) {
    return '前一筆紀錄新增尚未成功進入雲端，所以後續更新暫時找不到對應紀錄。';
  }

  if (lastError.includes('ENTITY_ALREADY_EXISTS')) {
    return '雲端已存在相同資料，系統會在下次同步時嘗試自動對齊。';
  }

  if (lastError.includes('ENTITY_DELETED')) {
    return '這筆資料在雲端已標記刪除，需要先確認是否要保留本機版本。';
  }

  if (lastError.includes('ITEM_USER_MISMATCH')) {
    return '這個項目存在於雲端，但不屬於目前登入的帳號，所以這筆紀錄無法寫入。';
  }

  if (lastError.includes('version conflict')) {
    return '本機版本與雲端版本不同，需先確認要保留哪一份變更。';
  }

  return lastError;
}

function buildSyncIssueDebugDetails(
  operation: LocalSyncOperation,
  itemsById: Map<string, LocalItem>,
  linkedAccountUserId: string | null,
) {
  const details: string[] = [];

  details.push(`linkedAccount.userId: ${linkedAccountUserId ?? 'null'}`);

  if (
    operation.entityType === 'record' &&
    (operation.operationType === 'create' || operation.operationType === 'update')
  ) {
    const payload =
      operation.payload && typeof operation.payload === 'object'
        ? (operation.payload as { itemId?: string | null })
        : null;
    const referencedItemId = payload?.itemId ?? null;

    if (referencedItemId) {
      const referencedItem = itemsById.get(referencedItemId) ?? null;
      details.push(`payload.itemId: ${referencedItemId}`);

      if (referencedItem) {
        details.push(`本機 item.title: ${referencedItem.title}`);
        details.push(`本機 item.userId: ${referencedItem.userId ?? 'null'}`);
        details.push(`本機 item.syncStatus: ${referencedItem.syncStatus}`);
        details.push(`本機 item.version: ${referencedItem.version}`);
        details.push(
          `本機 item.deletedAt: ${referencedItem.deletedAt ?? 'null'}`,
        );
      } else {
        details.push('本機 item: 找不到');
      }
    }
  }

  if (operation.lastError) {
    details.push(`rawError: ${operation.lastError}`);
  }

  return details;
}

function mapSyncOperationIssue(
  operation: LocalSyncOperation,
  itemsById: Map<string, LocalItem>,
  linkedAccountUserId: string | null,
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
    displayError: getReadableSyncError(operation, operation.lastError),
    debugDetails: buildSyncIssueDebugDetails(
      operation,
      itemsById,
      linkedAccountUserId,
    ),
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
    userId: null,
    title: item.title,
    type: item.type,
    unit: item.unit ?? null,
    valueType: item.valueType,
    scaleMin: item.scaleMin ?? null,
    scaleMax: item.scaleMax ?? null,
    sortOrder: item.sortOrder,
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
    userId: null,
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
  userId?: string | null;
}) {
  const activeUserId =
    input.userId === undefined
      ? await reconcileActiveLocalDataOwnership()
      : input.userId;
  const [existingItems, existingRecords] = await Promise.all([
    itemLocalRepository.getAll({
      includeDeleted: true,
      userId: activeUserId,
    }),
    recordLocalRepository.getAll({
      includeDeleted: true,
      userId: activeUserId,
    }),
  ]);

  const existingItemIds = new Set(existingItems.map((item) => item.id));

  for (const item of input.items) {
    if (existingItemIds.has(item.id)) {
      continue;
    }

    await itemLocalRepository.upsert({
      ...toLocalItemFromResponse(item),
      userId: activeUserId ?? null,
    });
  }

  const existingRecordIds = new Set(existingRecords.map((record) => record.id));

  for (const record of input.records) {
    if (existingRecordIds.has(record.id)) {
      continue;
    }

    await recordLocalRepository.upsert({
      ...toLocalRecordFromResponse(record),
      userId: activeUserId ?? null,
    });
  }
}

export async function loadLocalItems() {
  const activeUserId = await reconcileActiveLocalDataOwnership();
  const items = await itemLocalRepository.getAll({
    includeDeleted: true,
    userId: activeUserId,
  });
  return items
    .filter((item) => item.deletedAt === null)
    .sort((left, right) => {
      const typeCompare = left.type.localeCompare(right.type);

      if (typeCompare !== 0) {
        return typeCompare;
      }

      const sortOrderCompare = left.sortOrder - right.sortOrder;

      if (sortOrderCompare !== 0) {
        return sortOrderCompare;
      }

      return right.createdAt.localeCompare(left.createdAt);
    })
    .map(mapLocalItemToItemResponse);
}

export async function loadLocalRecords(query: LocalRecordQuery = {}) {
  const activeUserId = await reconcileActiveLocalDataOwnership();
  const [items, records] = await Promise.all([
    itemLocalRepository.getAll({ includeDeleted: true, userId: activeUserId }),
    recordLocalRepository.getAll({ includeDeleted: true, userId: activeUserId }),
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

      if (
        query.itemType &&
        query.itemType !== 'both' &&
        item.type !== query.itemType
      ) {
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
  const activeUserId = await reconcileActiveLocalDataOwnership();
  const [operations, items, linkedAccount] = await Promise.all([
    syncOperationRepository.getAll({ userId: activeUserId }),
    itemLocalRepository.getAll({ includeDeleted: true, userId: activeUserId }),
    getLinkedAccount(),
  ]);
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return operations
    .map((operation) =>
      mapSyncOperationIssue(
        operation,
        itemsById,
        linkedAccount?.userId ?? null,
      ),
    )
    .filter((value): value is SyncOperationIssue => value !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}
