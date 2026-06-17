import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/items/local-repository', () => ({
  itemLocalRepository: {
    getAll: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/features/records/local-repository', () => ({
  recordLocalRepository: {
    getAll: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/features/sync/local-operation-repository', () => ({
  syncOperationRepository: {
    getAll: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/features/sync/meta', () => ({
  getLinkedAccount: vi.fn(),
}));

import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import { getLinkedAccount } from '@/features/sync/meta';
import {
  assignAnonymousLocalDataToUser,
  getActiveLocalDataUserId,
  reconcileActiveLocalDataOwnership,
} from '@/features/sync/local-user-scope';

describe('local user scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns linked user id as active scope', async () => {
    vi.mocked(getLinkedAccount).mockResolvedValue({
      userId: 'user-1',
      email: 'user-1@nadi.dev',
      linkedAt: '2026-06-17T00:00:00.000Z',
    });

    await expect(getActiveLocalDataUserId()).resolves.toBe('user-1');
  });

  it('assigns only anonymous local data to the linked user', async () => {
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([
      {
        id: 'anon-item',
        userId: null,
        title: '咖啡',
        type: 'metric',
        unit: '杯',
        valueType: 'number',
        scaleMin: null,
        scaleMax: null,
        sortOrder: 0,
        archived: false,
        syncStatus: 'synced',
        createdAt: '2026-06-17T00:00:00.000Z',
        updatedAt: '2026-06-17T00:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: '2026-06-17T00:00:00.000Z',
        deviceId: 'device-local',
      },
    ]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([
      {
        id: 'anon-record',
        userId: null,
        itemId: 'anon-item',
        valueNumber: 1,
        valueText: null,
        valueBoolean: null,
        recordedAt: '2026-06-17T08:00:00.000Z',
        note: null,
        syncStatus: 'pending',
        createdAt: '2026-06-17T08:00:00.000Z',
        updatedAt: '2026-06-17T08:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
      },
    ]);
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      {
        id: 'anon-op',
        userId: null,
        operationId: 'anon-op',
        entityType: 'record',
        operationType: 'create',
        entityId: 'anon-record',
        baseVersion: null,
        payload: {
          itemId: 'anon-item',
          value: 1,
        },
        status: 'pending',
        syncStatus: 'pending',
        createdAt: '2026-06-17T08:00:00.000Z',
        updatedAt: '2026-06-17T08:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 0,
        lastError: null,
      },
    ]);

    await assignAnonymousLocalDataToUser('user-1');

    expect(itemLocalRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'anon-item',
        userId: 'user-1',
      }),
    );
    expect(recordLocalRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'anon-record',
        userId: 'user-1',
      }),
    );
    expect(syncOperationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'anon-op',
        userId: 'user-1',
      }),
    );
  });

  it('reconciles only the current linked user scope', async () => {
    vi.mocked(getLinkedAccount).mockResolvedValue({
      userId: 'user-2',
      email: 'user-2@nadi.dev',
      linkedAt: '2026-06-17T00:00:00.000Z',
    });
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([]);

    await expect(reconcileActiveLocalDataOwnership()).resolves.toBe('user-2');
    expect(itemLocalRepository.getAll).toHaveBeenCalledWith({
      includeDeleted: true,
      userId: null,
    });
  });
});
