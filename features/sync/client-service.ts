import { authClient } from '@/lib/auth/auth-client';
import { getLinkedAccount } from '@/features/sync/meta';
import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import {
  pullSyncChanges as pullSyncChangesRequest,
  pushSyncOperations as pushSyncOperationsRequest,
  SyncClientError,
} from '@/features/sync/client';
import { getOrCreateDeviceId } from '@/features/sync/device';
import {
  getLastPulledAt,
  setLastPulledAt,
  setLastSyncedAt,
} from '@/features/sync/meta';
import { startSyncNetworkMonitor, isNavigatorOnline } from '@/features/sync/network';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import { setSyncState } from '@/features/sync/state';
import type {
  SyncConflict,
  SyncItemEntity,
  SyncPullResponse,
  SyncRecordEntity,
  SyncRejectedOperation,
  SyncTombstone,
} from '@/features/sync/types';
import type { LocalItem, LocalRecord, LocalSyncOperation } from '@/lib/local-db/types';

function getSyncErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '同步失敗';
}

async function getAuthenticatedSessionUser() {
  const result = await authClient.getSession();
  return result.data?.user ?? null;
}

async function ensureLinkedSyncUser() {
  const sessionUser = await getAuthenticatedSessionUser();

  if (!sessionUser) {
    setSyncState({
      status: 'idle',
      lastError: '目前為本機模式，登入並連結帳號後才會同步到雲端。',
    });
    return null;
  }

  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    setSyncState({
      status: 'idle',
      lastError: '尚未連結這台裝置到帳號，本機資料目前不會自動上傳。',
    });
    return null;
  }

  if (linkedAccount.userId !== sessionUser.id) {
    setSyncState({
      status: 'error',
      lastError: '這台裝置的本機資料目前綁定到另一個帳號，請先重新連結。',
    });
    return null;
  }

  return sessionUser;
}

async function refreshSyncCounts() {
  const operations = await syncOperationRepository.getAll();
  const pendingCount = operations.filter((operation) => operation.status === 'pending').length;
  const failedCount = operations.filter((operation) => operation.status === 'failed').length;
  const conflictCount = operations.filter((operation) => operation.status === 'conflict').length;

  setSyncState({
    pendingCount,
    failedCount,
    conflictCount,
  });

  return {
    pendingCount,
    failedCount,
    conflictCount,
  };
}

async function markEntitySynced(
  entityType: 'item' | 'record',
  entityId: string,
  version: number,
  lastSyncedAt: string,
) {
  if (entityType === 'item') {
    await itemLocalRepository.markSynced(entityId, {
      version,
      lastSyncedAt,
    });
    return;
  }

  await recordLocalRepository.markSynced(entityId, {
    version,
    lastSyncedAt,
  });
}

async function markEntityFailed(entityType: 'item' | 'record', entityId: string) {
  if (entityType === 'item') {
    await itemLocalRepository.markFailed(entityId);
    return;
  }

  await recordLocalRepository.markFailed(entityId);
}

async function markEntityConflict(
  entityType: 'item' | 'record',
  entityId: string,
  lastSyncedAt: string,
) {
  if (entityType === 'item') {
    await itemLocalRepository.markConflict(entityId, { lastSyncedAt });
    return;
  }

  await recordLocalRepository.markConflict(entityId, { lastSyncedAt });
}

async function upsertRemoteItem(item: SyncItemEntity, serverTime: string) {
  const local = await itemLocalRepository.getById(item.id);

  if (local && local.syncStatus !== 'synced') {
    return;
  }

  const nextItem: LocalItem = {
    id: item.id,
    title: item.title,
    type: item.type,
    unit: item.unit,
    valueType: item.valueType,
    scaleMin: item.scaleMin,
    scaleMax: item.scaleMax,
    archived: item.archived,
    syncStatus: 'synced',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
    version: item.version,
    lastSyncedAt: item.lastSyncedAt ?? serverTime,
    deviceId: item.deviceId,
  };

  await itemLocalRepository.upsert(nextItem);
}

async function upsertRemoteRecord(record: SyncRecordEntity, serverTime: string) {
  const local = await recordLocalRepository.getById(record.id);

  if (local && local.syncStatus !== 'synced') {
    return;
  }

  const nextRecord: LocalRecord = {
    id: record.id,
    itemId: record.itemId,
    valueNumber: record.valueNumber,
    valueText: record.valueText,
    valueBoolean: record.valueBoolean,
    recordedAt: record.recordedAt,
    note: record.note,
    syncStatus: 'synced',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    version: record.version,
    lastSyncedAt: record.lastSyncedAt ?? serverTime,
    deviceId: record.deviceId,
  };

  await recordLocalRepository.upsert(nextRecord);
}

async function applyTombstone(tombstone: SyncTombstone, serverTime: string) {
  if (tombstone.entityType === 'item') {
    const local = await itemLocalRepository.getById(tombstone.entityId);

    if (!local) {
      return;
    }

    await itemLocalRepository.upsert({
      ...local,
      deletedAt: tombstone.deletedAt,
      updatedAt: tombstone.updatedAt,
      version: tombstone.version,
      syncStatus: 'synced',
      lastSyncedAt: serverTime,
    });
    return;
  }

  const local = await recordLocalRepository.getById(tombstone.entityId);

  if (!local) {
    return;
  }

  await recordLocalRepository.upsert({
    ...local,
    deletedAt: tombstone.deletedAt,
    updatedAt: tombstone.updatedAt,
    version: tombstone.version,
    syncStatus: 'synced',
    lastSyncedAt: serverTime,
  });
}

async function handleRejectedOperations(
  rejected: SyncRejectedOperation[],
) {
  for (const operation of rejected) {
    await syncOperationRepository.markFailed(operation.operationId, {
      lastError: `${operation.reason}: ${operation.message}`,
    });
    await markEntityFailed(operation.entityType, operation.entityId);
  }
}

async function handleConflicts(conflicts: SyncConflict[], serverTime: string) {
  for (const conflict of conflicts) {
    await syncOperationRepository.markConflict(conflict.operationId, {
      lastError: `version conflict (${conflict.baseVersion} -> ${conflict.currentVersion})`,
      lastSyncedAt: serverTime,
    });
    await markEntityConflict(conflict.entityType, conflict.entityId, serverTime);
  }
}

function toSyncOperationInput(operation: LocalSyncOperation) {
  return {
    operationId: operation.operationId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    entityId: operation.entityId,
    baseVersion: operation.baseVersion ?? undefined,
    payload: operation.payload,
    clientCreatedAt: operation.createdAt,
    clientUpdatedAt: operation.updatedAt,
  };
}

let runningSyncPromise: Promise<void> | null = null;

export async function pushPendingOperations() {
  if (!isNavigatorOnline()) {
    setSyncState({
      status: 'offline',
    });
    return null;
  }

  if (!(await ensureLinkedSyncUser())) {
    return null;
  }

  const deviceId = await getOrCreateDeviceId();
  const allOperations = await syncOperationRepository.getAll();
  const operationsToPush = allOperations.filter(
    (operation) => operation.status === 'pending' || operation.status === 'failed',
  );

  setSyncState({
    pendingCount: operationsToPush.filter((operation) => operation.status === 'pending').length,
    failedCount: operationsToPush.filter((operation) => operation.status === 'failed').length,
  });

  if (operationsToPush.length === 0) {
    return null;
  }

  const response = await pushSyncOperationsRequest({
    deviceId,
    operations: operationsToPush.map(toSyncOperationInput),
  });

  for (const accepted of response.accepted) {
    await syncOperationRepository.markSynced(accepted.operationId, {
      version: accepted.version,
      lastSyncedAt: response.serverTime,
    });
    await markEntitySynced(
      accepted.entityType,
      accepted.entityId,
      accepted.version,
      response.serverTime,
    );
  }

  await handleRejectedOperations(response.rejected);
  await handleConflicts(response.conflicts, response.serverTime);
  await setLastSyncedAt(response.serverTime);
  await refreshSyncCounts();

  return response;
}

export async function pullRemoteChanges() {
  if (!isNavigatorOnline()) {
    setSyncState({
      status: 'offline',
    });
    return null;
  }

  if (!(await ensureLinkedSyncUser())) {
    return null;
  }

  const deviceId = await getOrCreateDeviceId();
  const lastPulledAt = await getLastPulledAt();
  const response: SyncPullResponse = await pullSyncChangesRequest({
    deviceId,
    lastPulledAt: lastPulledAt ?? undefined,
  });

  for (const item of response.items) {
    await upsertRemoteItem(item, response.serverTime);
  }

  for (const record of response.records) {
    await upsertRemoteRecord(record, response.serverTime);
  }

  for (const tombstone of response.tombstones) {
    await applyTombstone(tombstone, response.serverTime);
  }

  await setLastPulledAt(response.serverTime);
  await setLastSyncedAt(response.serverTime);
  await refreshSyncCounts();

  return response;
}

export async function retryFailedOperations() {
  const failedOperations = await syncOperationRepository.listFailed();

  for (const operation of failedOperations) {
    await syncOperationRepository.requeue(operation.id);
  }

  return pushPendingOperations();
}

export async function runSync() {
  if (runningSyncPromise) {
    return runningSyncPromise;
  }

  runningSyncPromise = (async () => {
    if (!isNavigatorOnline()) {
      setSyncState({
        status: 'offline',
      });
      return;
    }

    if (!(await ensureLinkedSyncUser())) {
      return;
    }

    setSyncState({
      status: 'syncing',
      lastError: null,
    });

    try {
      await pushPendingOperations();
      const pullResponse = await pullRemoteChanges();
      const counts = await refreshSyncCounts();

      setSyncState({
        status: counts.conflictCount > 0 ? 'conflict' : 'idle',
        lastSyncAt: pullResponse?.serverTime ?? new Date().toISOString(),
        lastError: null,
      });
    } catch (error) {
      if (error instanceof SyncClientError && error.isNetworkError) {
        setSyncState({
          status: 'offline',
          lastError: error.message,
        });
        return;
      }

      setSyncState({
        status: 'error',
        lastError: getSyncErrorMessage(error),
      });
      throw error;
    }
  })();

  try {
    await runningSyncPromise;
  } finally {
    runningSyncPromise = null;
  }
}

export function startForegroundSync() {
  return startSyncNetworkMonitor(() => runSync());
}
