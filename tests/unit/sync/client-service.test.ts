import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/items/local-repository', () => ({
  itemLocalRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    markConflict: vi.fn(),
    markFailed: vi.fn(),
    markSynced: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/features/records/local-repository', () => ({
  recordLocalRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    markConflict: vi.fn(),
    markFailed: vi.fn(),
    markSynced: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/features/sync/client', () => ({
  SyncClientError: class SyncClientError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode?: number,
      public readonly isNetworkError = false,
    ) {
      super(message);
      this.name = 'SyncClientError';
    }
  },
  pullSyncChanges: vi.fn(),
  pushSyncOperations: vi.fn(),
}));

vi.mock('@/features/sync/device', () => ({
  getOrCreateDeviceId: vi.fn(),
}));

vi.mock('@/features/sync/meta', () => ({
  appendSyncDiagnosticEvent: vi.fn(),
  clearPullCheckpoint: vi.fn(),
  getLinkedAccount: vi.fn(),
  getLastPulledAt: vi.fn(),
  getPullCheckpoint: vi.fn(),
  getSyncDiagnosticsEvents: vi.fn(),
  getStoredDeviceSession: vi.fn(),
  setPullCheckpoint: vi.fn(),
  setLastPulledAt: vi.fn(),
  setLastSyncedAt: vi.fn(),
  setStoredDeviceSession: vi.fn(),
}));

vi.mock('@/lib/auth/auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/features/sync/network', () => ({
  isNavigatorOnline: vi.fn(),
  startSyncNetworkMonitor: vi.fn((handler: () => void | Promise<void>) => {
    void handler;
    return () => undefined;
  }),
}));

vi.mock('@/features/sync/local-operation-repository', () => ({
  syncOperationRepository: {
    getAll: vi.fn(),
    listFailed: vi.fn(),
    markConflict: vi.fn(),
    markFailed: vi.fn(),
    markSynced: vi.fn(),
    requeue: vi.fn(),
  },
}));

import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { pullSyncChanges, pushSyncOperations, SyncClientError } from '@/features/sync/client';
import {
  pullRemoteChanges,
  pushPendingOperations,
  retryFailedOperations,
  runSync,
} from '@/features/sync/client-service';
import { getOrCreateDeviceId } from '@/features/sync/device';
import {
  getLastPulledAt,
  getLinkedAccount,
  getPullCheckpoint,
  getSyncDiagnosticsEvents,
  getStoredDeviceSession,
  setLastPulledAt,
  setLastSyncedAt,
} from '@/features/sync/meta';
import { isNavigatorOnline } from '@/features/sync/network';
import { getSyncState, resetSyncState } from '@/features/sync/state';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import { authClient } from '@/lib/auth/auth-client';

const pendingOperation = {
  id: 'op-1',
  operationId: 'op-1',
  entityType: 'record' as const,
  operationType: 'update' as const,
  entityId: '11111111-1111-4111-8111-111111111118',
  baseVersion: 2,
  payload: {
    value: 7,
  },
  status: 'pending' as const,
  syncStatus: 'pending' as const,
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T01:00:00.000Z',
  deletedAt: null,
  version: 1,
  lastSyncedAt: null,
  deviceId: 'device-local',
  retryCount: 0,
  lastError: null,
};

const pendingItemCreateOperation = {
  id: 'op-item-create',
  operationId: 'op-item-create',
  entityType: 'item' as const,
  operationType: 'create' as const,
  entityId: '11111111-1111-4111-8111-111111111111',
  baseVersion: null,
  payload: {
    title: '睡眠',
    type: 'metric',
    valueType: 'number',
    unit: '小時',
  },
  status: 'pending' as const,
  syncStatus: 'pending' as const,
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
  deletedAt: null,
  version: 1,
  lastSyncedAt: null,
  deviceId: 'device-local',
  retryCount: 0,
  lastError: null,
};

const pendingRecordCreateOperation = {
  id: 'op-record-create',
  operationId: 'op-record-create',
  entityType: 'record' as const,
  operationType: 'create' as const,
  entityId: '11111111-1111-4111-8111-111111111118',
  baseVersion: null,
  payload: {
    itemId: '11111111-1111-4111-8111-111111111111',
    value: 6.5,
    recordedAt: '2026-06-16T08:00:00.000Z',
    note: '起床後',
  },
  status: 'pending' as const,
  syncStatus: 'pending' as const,
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
  deletedAt: null,
  version: 1,
  lastSyncedAt: null,
  deviceId: 'device-local',
  retryCount: 0,
  lastError: null,
};

describe('client sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSyncState();
    vi.mocked(getOrCreateDeviceId).mockResolvedValue('device-local');
    vi.mocked(isNavigatorOnline).mockReturnValue(true);
    vi.mocked(getLastPulledAt).mockResolvedValue(null);
    vi.mocked(getPullCheckpoint).mockResolvedValue(null);
    vi.mocked(getSyncDiagnosticsEvents).mockResolvedValue([]);
    vi.mocked(getStoredDeviceSession).mockResolvedValue(null);
    vi.mocked(getLinkedAccount).mockResolvedValue({
      userId: 'user-1',
      email: 'local@nadi.dev',
      linkedAt: '2026-06-16T00:00:00.000Z',
    });
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: {
        session: {
          id: 'session-1',
        },
        user: {
          id: 'user-1',
          email: 'local@nadi.dev',
          name: 'Local User',
          emailVerified: true,
        },
      },
      error: null,
    });
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([]);
    vi.mocked(syncOperationRepository.listFailed).mockResolvedValue([]);
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([]);
  });

  it('pushes pending operations and marks them synced on success', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([pendingOperation]);
    vi.mocked(pushSyncOperations).mockResolvedValue({
      accepted: [
        {
          operationId: 'op-1',
          entityType: 'record',
          operationType: 'update',
          entityId: pendingOperation.entityId,
          version: 3,
          updatedAt: '2026-06-16T02:00:00.000Z',
        },
      ],
      rejected: [],
      conflicts: [],
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T02:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T02:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T02:00:00.000Z',
        lastPushAt: '2026-06-16T02:00:00.000Z',
        lastPullAt: null,
        lastCheckpointAt: null,
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 1,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T02:00:00.000Z',
    });

    await pushPendingOperations();

    expect(pushSyncOperations).toHaveBeenCalledWith({
      deviceId: 'device-local',
      operations: [
        expect.objectContaining({
          operationId: 'op-1',
          baseVersion: 2,
        }),
      ],
    });
    expect(syncOperationRepository.markSynced).toHaveBeenCalledWith('op-1', {
      version: 3,
      lastSyncedAt: '2026-06-16T02:00:00.000Z',
    });
    expect(recordLocalRepository.markSynced).toHaveBeenCalledWith(
      pendingOperation.entityId,
      {
        version: 3,
        lastSyncedAt: '2026-06-16T02:00:00.000Z',
      },
    );
  });

  it('pushes item create before dependent record create when timestamps tie', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      pendingRecordCreateOperation,
      pendingItemCreateOperation,
    ]);
    vi.mocked(pushSyncOperations).mockResolvedValue({
      accepted: [],
      rejected: [],
      conflicts: [],
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T02:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T02:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T02:00:00.000Z',
        lastPushAt: '2026-06-16T02:00:00.000Z',
        lastPullAt: null,
        lastCheckpointAt: null,
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T02:00:00.000Z',
    });

    await pushPendingOperations();

    expect(pushSyncOperations).toHaveBeenCalledWith({
      deviceId: 'device-local',
      operations: [
        expect.objectContaining({
          operationId: 'op-item-create',
          entityType: 'item',
          operationType: 'create',
        }),
        expect.objectContaining({
          operationId: 'op-record-create',
          entityType: 'record',
          operationType: 'create',
        }),
      ],
    });
  });

  it('does not push record update before its unsynced record create', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      pendingOperation,
      pendingRecordCreateOperation,
    ]);
    vi.mocked(pushSyncOperations).mockResolvedValue({
      accepted: [],
      rejected: [],
      conflicts: [],
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T02:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T02:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T02:00:00.000Z',
        lastPushAt: '2026-06-16T02:00:00.000Z',
        lastPullAt: null,
        lastCheckpointAt: null,
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T02:00:00.000Z',
    });
    vi.mocked(itemLocalRepository.getById).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      syncStatus: 'synced',
      createdAt: '2026-06-16T00:00:00.000Z',
      updatedAt: '2026-06-16T00:00:00.000Z',
      deletedAt: null,
      version: 1,
      lastSyncedAt: '2026-06-16T00:00:00.000Z',
      deviceId: 'device-local',
    });

    await pushPendingOperations();

    expect(pushSyncOperations).toHaveBeenCalledWith({
      deviceId: 'device-local',
      operations: [
        expect.objectContaining({
          operationId: 'op-record-create',
          operationType: 'create',
        }),
      ],
    });
  });

  it('defers record create when referenced item is not yet synced', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      pendingRecordCreateOperation,
    ]);
    vi.mocked(itemLocalRepository.getById).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      syncStatus: 'pending',
      createdAt: '2026-06-16T00:00:00.000Z',
      updatedAt: '2026-06-16T00:00:00.000Z',
      deletedAt: null,
      version: 1,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });

    const result = await pushPendingOperations();

    expect(pushSyncOperations).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('skips cloud sync in anonymous local mode', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: null,
    });

    await runSync();

    expect(pushSyncOperations).not.toHaveBeenCalled();
    expect(pullSyncChanges).not.toHaveBeenCalled();
    expect(getSyncState().lastError).toContain('本機模式');
  });

  it('marks rejected operations as failed', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([pendingOperation]);
    vi.mocked(pushSyncOperations).mockResolvedValue({
      accepted: [],
      rejected: [
        {
          operationId: 'op-1',
          entityType: 'record',
          operationType: 'update',
          entityId: pendingOperation.entityId,
          reason: 'PAYLOAD_INVALID',
          message: '欄位無效',
        },
      ],
      conflicts: [],
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T02:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T02:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T02:00:00.000Z',
        lastPushAt: '2026-06-16T02:00:00.000Z',
        lastPullAt: null,
        lastCheckpointAt: null,
        lastCheckpointCursor: null,
        lastSyncStatus: 'failed',
        lastErrorCode: 'PAYLOAD_INVALID',
        lastErrorAt: '2026-06-16T02:00:00.000Z',
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 1,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T02:00:00.000Z',
    });

    await pushPendingOperations();

    expect(syncOperationRepository.markFailed).toHaveBeenCalledWith('op-1', {
      lastError: 'PAYLOAD_INVALID: 欄位無效',
    });
    expect(recordLocalRepository.markFailed).toHaveBeenCalledWith(
      pendingOperation.entityId,
    );
  });

  it('marks conflicts without overwriting local entity data', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([pendingOperation]);
    vi.mocked(pushSyncOperations).mockResolvedValue({
      accepted: [],
      rejected: [],
      conflicts: [
        {
          operationId: 'op-1',
          entityType: 'record',
          operationType: 'update',
          entityId: pendingOperation.entityId,
          baseVersion: 2,
          currentVersion: 4,
          serverEntity: {
            id: pendingOperation.entityId,
            itemId: '11111111-1111-4111-8111-111111111111',
            valueNumber: 8,
            valueText: null,
            valueBoolean: null,
            recordedAt: '2026-06-16T01:30:00.000Z',
            note: null,
            version: 4,
            deletedAt: null,
            updatedAt: '2026-06-16T01:30:00.000Z',
            createdAt: '2026-06-16T00:00:00.000Z',
            lastSyncedAt: '2026-06-16T01:30:00.000Z',
            deviceId: 'device-remote',
          },
        },
      ],
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T02:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T02:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T02:00:00.000Z',
        lastPushAt: '2026-06-16T02:00:00.000Z',
        lastPullAt: null,
        lastCheckpointAt: null,
        lastCheckpointCursor: null,
        lastSyncStatus: 'conflict',
        lastErrorCode: 'SYNC_CONFLICT',
        lastErrorAt: '2026-06-16T02:00:00.000Z',
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 1,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T02:00:00.000Z',
    });

    await pushPendingOperations();

    expect(syncOperationRepository.markConflict).toHaveBeenCalledWith('op-1', {
      lastError: 'version conflict (2 -> 4)',
      lastSyncedAt: '2026-06-16T02:00:00.000Z',
    });
    expect(recordLocalRepository.markConflict).toHaveBeenCalledWith(
      pendingOperation.entityId,
      {
        lastSyncedAt: '2026-06-16T02:00:00.000Z',
      },
    );
    expect(recordLocalRepository.upsert).not.toHaveBeenCalled();
  });

  it('pulls remote changes and merges them into local store', async () => {
    vi.mocked(recordLocalRepository.getById).mockResolvedValue(null);
    vi.mocked(itemLocalRepository.getById).mockResolvedValue(null);
    vi.mocked(pullSyncChanges).mockResolvedValue({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: '睡眠',
          type: 'metric',
          unit: '小時',
          valueType: 'number',
          scaleMin: null,
          scaleMax: null,
          archived: false,
          version: 2,
          deletedAt: null,
          updatedAt: '2026-06-16T03:00:00.000Z',
          createdAt: '2026-06-16T00:00:00.000Z',
          lastSyncedAt: '2026-06-16T03:00:00.000Z',
          deviceId: 'device-remote',
        },
      ],
      records: [
        {
          id: pendingOperation.entityId,
          itemId: '11111111-1111-4111-8111-111111111111',
          valueNumber: 6.5,
          valueText: null,
          valueBoolean: null,
          recordedAt: '2026-06-16T01:00:00.000Z',
          note: 'remote',
          version: 2,
          deletedAt: null,
          updatedAt: '2026-06-16T03:00:00.000Z',
          createdAt: '2026-06-16T01:00:00.000Z',
          lastSyncedAt: '2026-06-16T03:00:00.000Z',
          deviceId: 'device-remote',
        },
      ],
      tombstones: [],
      checkpoint: {
        since: null,
        until: '2026-06-16T03:00:00.000Z',
        nextCursor: null,
        hasMore: false,
        limit: 100,
        returnedCount: 2,
      },
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T03:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T03:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T03:00:00.000Z',
        lastPushAt: null,
        lastPullAt: '2026-06-16T03:00:00.000Z',
        lastCheckpointAt: '2026-06-16T03:00:00.000Z',
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 1,
        pulledRecordCount: 1,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T03:00:00.000Z',
    });

    await pullRemoteChanges();

    expect(itemLocalRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        syncStatus: 'synced',
      }),
    );
    expect(recordLocalRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pendingOperation.entityId,
        syncStatus: 'synced',
      }),
    );
    expect(setLastPulledAt).toHaveBeenCalledWith('2026-06-16T03:00:00.000Z');
  });

  it('applies pull tombstones as local soft delete', async () => {
    vi.mocked(itemLocalRepository.getById).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      syncStatus: 'synced',
      createdAt: '2026-06-16T00:00:00.000Z',
      updatedAt: '2026-06-16T00:00:00.000Z',
      deletedAt: null,
      version: 1,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });
    vi.mocked(pullSyncChanges).mockResolvedValue({
      items: [],
      records: [],
      tombstones: [
        {
          entityType: 'item',
          entityId: '11111111-1111-4111-8111-111111111111',
          deletedAt: '2026-06-16T04:00:00.000Z',
          version: 2,
          updatedAt: '2026-06-16T04:00:00.000Z',
        },
      ],
      checkpoint: {
        since: null,
        until: '2026-06-16T04:00:00.000Z',
        nextCursor: null,
        hasMore: false,
        limit: 100,
        returnedCount: 1,
      },
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T04:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T04:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T04:00:00.000Z',
        lastPushAt: null,
        lastPullAt: '2026-06-16T04:00:00.000Z',
        lastCheckpointAt: '2026-06-16T04:00:00.000Z',
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 1,
      },
      serverTime: '2026-06-16T04:00:00.000Z',
    });

    await pullRemoteChanges();

    expect(itemLocalRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: '2026-06-16T04:00:00.000Z',
        version: 2,
      }),
    );
  });

  it('does not send requests while offline', async () => {
    vi.mocked(isNavigatorOnline).mockReturnValue(false);

    await runSync();

    expect(pushSyncOperations).not.toHaveBeenCalled();
    expect(pullSyncChanges).not.toHaveBeenCalled();
    expect(getSyncState().status).toBe('offline');
  });

  it('retries failed operations by requeueing them first', async () => {
    vi.mocked(syncOperationRepository.listFailed).mockResolvedValue([
      {
        ...pendingOperation,
        status: 'failed',
        syncStatus: 'failed',
      },
    ]);
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([pendingOperation]);
    vi.mocked(pushSyncOperations).mockResolvedValue({
      accepted: [],
      rejected: [],
      conflicts: [],
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T05:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T05:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T05:00:00.000Z',
        lastPushAt: '2026-06-16T05:00:00.000Z',
        lastPullAt: null,
        lastCheckpointAt: null,
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T05:00:00.000Z',
    });

    await retryFailedOperations();

    expect(syncOperationRepository.requeue).toHaveBeenCalledWith('op-1');
    expect(pushSyncOperations).toHaveBeenCalled();
  });

  it('records sync error state on network fallback', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([pendingOperation]);
    vi.mocked(pushSyncOperations).mockRejectedValue(
      new SyncClientError('network down', 'NETWORK_ERROR', undefined, true),
    );

    await runSync();

    expect(getSyncState().status).toBe('offline');
    expect(getSyncState().lastError).toBe('network down');
  });

  it('updates last synced time after full run', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([]);
    vi.mocked(pullSyncChanges).mockResolvedValue({
      items: [],
      records: [],
      tombstones: [],
      checkpoint: {
        since: null,
        until: '2026-06-16T06:00:00.000Z',
        nextCursor: null,
        hasMore: false,
        limit: 100,
        returnedCount: 0,
      },
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T06:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T06:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T06:00:00.000Z',
        lastPushAt: null,
        lastPullAt: '2026-06-16T06:00:00.000Z',
        lastCheckpointAt: '2026-06-16T06:00:00.000Z',
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 0,
      },
      serverTime: '2026-06-16T06:00:00.000Z',
    });

    await runSync();

    expect(setLastSyncedAt).toHaveBeenCalledWith('2026-06-16T06:00:00.000Z');
    expect(getSyncState().status).toBe('idle');
  });

  it('does not apply remote tombstone over pending local change', async () => {
    vi.mocked(recordLocalRepository.getById).mockResolvedValue({
      id: pendingOperation.entityId,
      itemId: '11111111-1111-4111-8111-111111111111',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-16T01:00:00.000Z',
      note: 'local pending',
      syncStatus: 'pending',
      createdAt: '2026-06-16T01:00:00.000Z',
      updatedAt: '2026-06-16T01:10:00.000Z',
      deletedAt: null,
      version: 2,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });
    vi.mocked(pullSyncChanges).mockResolvedValue({
      items: [],
      records: [],
      tombstones: [
        {
          entityType: 'record',
          entityId: pendingOperation.entityId,
          deletedAt: '2026-06-16T07:00:00.000Z',
          version: 3,
          updatedAt: '2026-06-16T07:00:00.000Z',
        },
      ],
      checkpoint: {
        since: null,
        until: '2026-06-16T07:00:00.000Z',
        nextCursor: null,
        hasMore: false,
        limit: 100,
        returnedCount: 1,
      },
      deviceSession: {
        deviceId: 'device-local',
        lastSeenAt: '2026-06-16T07:00:00.000Z',
        lastSyncStartedAt: '2026-06-16T07:00:00.000Z',
        lastSyncCompletedAt: '2026-06-16T07:00:00.000Z',
        lastPushAt: null,
        lastPullAt: '2026-06-16T07:00:00.000Z',
        lastCheckpointAt: '2026-06-16T07:00:00.000Z',
        lastCheckpointCursor: null,
        lastSyncStatus: 'synced',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      diagnostics: {
        duplicateOperationCount: 0,
        acceptedOperationCount: 0,
        rejectedOperationCount: 0,
        conflictOperationCount: 0,
        pulledItemCount: 0,
        pulledRecordCount: 0,
        pulledTombstoneCount: 1,
      },
      serverTime: '2026-06-16T07:00:00.000Z',
    });

    await pullRemoteChanges();

    expect(recordLocalRepository.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: '2026-06-16T07:00:00.000Z',
      }),
    );
  });
});
