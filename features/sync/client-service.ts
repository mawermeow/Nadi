import { authClient } from '@/lib/auth/auth-client';
import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import {
  pullSyncChanges as pullSyncChangesRequest,
  pushSyncOperations as pushSyncOperationsRequest,
  SyncClientError,
} from '@/features/sync/client';
import { getOrCreateDeviceId } from '@/features/sync/device';
import {
  appendSyncDiagnosticEvent,
  clearPullCheckpoint,
  getLastPulledAt,
  getLinkedAccount,
  getPullCheckpoint,
  getSyncDiagnosticsEvents,
  getStoredDeviceSession,
  setPullCheckpoint,
  setLastPulledAt,
  setLastSyncedAt,
  setStoredDeviceSession,
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

async function refreshSyncTelemetry() {
  const [deviceSession, diagnosticsEvents] = await Promise.all([
    getStoredDeviceSession(),
    getSyncDiagnosticsEvents(),
  ]);
  const lastDiagnostic = diagnosticsEvents[0] ?? null;

  setSyncState({
    deviceSession: deviceSession
      ? {
          deviceId: deviceSession.deviceId,
          lastSeenAt: deviceSession.lastSeenAt,
          lastSyncCompletedAt: deviceSession.lastSyncCompletedAt,
          lastCheckpointAt: deviceSession.lastCheckpointAt,
          lastSyncStatus: deviceSession.lastSyncStatus,
          lastErrorCode: deviceSession.lastErrorCode,
        }
      : null,
    diagnostics: lastDiagnostic
      ? {
          lastEventAt: lastDiagnostic.createdAt,
          lastEventType: lastDiagnostic.type,
          lastMessage: lastDiagnostic.message,
        }
      : null,
  });
}

export async function hydrateSyncTelemetryState() {
  await Promise.all([refreshSyncCounts(), refreshSyncTelemetry()]);
}

async function storeResponseTelemetry(
  response: Pick<SyncPullResponse, 'deviceSession' | 'diagnostics' | 'serverTime'>,
  input: {
    type: 'push' | 'pull' | 'conflict' | 'failure';
    message: string;
    metadata: Record<string, unknown>;
  },
) {
  await Promise.all([
    setStoredDeviceSession(response.deviceSession),
    appendSyncDiagnosticEvent({
      id: crypto.randomUUID(),
      type: input.type,
      createdAt: response.serverTime,
      message: input.message,
      metadata: input.metadata,
    }),
  ]);
  await refreshSyncTelemetry();
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

    if (!local || local.syncStatus !== 'synced') {
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

  if (!local || local.syncStatus !== 'synced') {
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
  await storeResponseTelemetry(response, {
    type:
      response.conflicts.length > 0
        ? 'conflict'
        : response.rejected.length > 0
          ? 'failure'
          : 'push',
    message:
      response.conflicts.length > 0
        ? `發現 ${response.conflicts.length} 筆同步衝突，已保留本機待處理變更。`
        : response.rejected.length > 0
          ? `有 ${response.rejected.length} 筆同步操作失敗，已保留本機資料。`
          : `已推送 ${response.accepted.length} 筆操作。`,
    metadata: {
      duplicateOperationCount: response.diagnostics.duplicateOperationCount,
      acceptedOperationCount: response.diagnostics.acceptedOperationCount,
      rejectedOperationCount: response.diagnostics.rejectedOperationCount,
      conflictOperationCount: response.diagnostics.conflictOperationCount,
    },
  });

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
  const [lastPulledAt, existingCheckpoint] = await Promise.all([
    getLastPulledAt(),
    getPullCheckpoint(),
  ]);
  let response: SyncPullResponse | null = null;
  let nextCheckpoint = existingCheckpoint;
  let pageCount = 0;
  const totals = {
    pulledItemCount: 0,
    pulledRecordCount: 0,
    pulledTombstoneCount: 0,
  };

  do {
    response = await pullSyncChangesRequest({
      deviceId,
      lastPulledAt:
        nextCheckpoint?.since ?? lastPulledAt ?? undefined,
      checkpoint: nextCheckpoint
        ? {
            until: nextCheckpoint.until,
            cursor: nextCheckpoint.nextCursor ?? undefined,
            limit: nextCheckpoint.limit,
          }
        : {
            limit: 100,
          },
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

    nextCheckpoint = response.checkpoint;
    pageCount += 1;
    totals.pulledItemCount += response.diagnostics.pulledItemCount;
    totals.pulledRecordCount += response.diagnostics.pulledRecordCount;
    totals.pulledTombstoneCount += response.diagnostics.pulledTombstoneCount;

    if (response.checkpoint.hasMore) {
      await setPullCheckpoint(response.checkpoint);
    } else {
      await Promise.all([
        clearPullCheckpoint(),
        setLastPulledAt(response.checkpoint.until),
      ]);
    }

    if (pageCount > 20) {
      throw new Error('同步分頁超過安全上限，已停止以避免重複拉取。');
    }
  } while (response.checkpoint.hasMore);

  if (!response) {
    return null;
  }

  await setLastSyncedAt(response.serverTime);
  await refreshSyncCounts();
  await storeResponseTelemetry(response, {
    type: 'pull',
    message: response.checkpoint.hasMore
      ? '已拉取部分遠端變更，仍有後續分頁待完成。'
      : `已拉取 ${totals.pulledItemCount + totals.pulledRecordCount + totals.pulledTombstoneCount} 筆遠端變更。`,
    metadata: {
      pulledItemCount: totals.pulledItemCount,
      pulledRecordCount: totals.pulledRecordCount,
      pulledTombstoneCount: totals.pulledTombstoneCount,
      checkpointUntil: response.checkpoint.until,
      pageCount,
    },
  });

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

      await appendSyncDiagnosticEvent({
        id: crypto.randomUUID(),
        type: 'failure',
        createdAt: new Date().toISOString(),
        message: getSyncErrorMessage(error),
        metadata: {
          code: error instanceof SyncClientError ? error.code : 'SYNC_RUNTIME_ERROR',
        },
      });
      await refreshSyncTelemetry();
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
