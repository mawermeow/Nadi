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
  getLinkedAccount: vi.fn(),
  getLastPulledAt: vi.fn(),
  setLastPulledAt: vi.fn(),
  setLastSyncedAt: vi.fn(),
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

describe('client sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSyncState();
    vi.mocked(getOrCreateDeviceId).mockResolvedValue('device-local');
    vi.mocked(isNavigatorOnline).mockReturnValue(true);
    vi.mocked(getLastPulledAt).mockResolvedValue(null);
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
      serverTime: '2026-06-16T06:00:00.000Z',
    });

    await runSync();

    expect(setLastSyncedAt).toHaveBeenCalledWith('2026-06-16T06:00:00.000Z');
    expect(getSyncState().status).toBe('idle');
  });
});
