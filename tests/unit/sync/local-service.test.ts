import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/items/local-repository', () => ({
  itemLocalRepository: {
    getById: vi.fn(),
    upsert: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock('@/features/records/local-repository', () => ({
  recordLocalRepository: {
    getById: vi.fn(),
    upsert: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock('@/features/sync/device', () => ({
  getOrCreateDeviceId: vi.fn(),
}));

vi.mock('@/features/sync/local-operation-repository', () => ({
  syncOperationRepository: {
    upsert: vi.fn(),
  },
}));

import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { getOrCreateDeviceId } from '@/features/sync/device';
import {
  createLocalItem,
  createLocalRecord,
  deleteLocalItem,
  updateLocalRecord,
} from '@/features/sync/local-service';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';

describe('local service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateDeviceId).mockResolvedValue('device-local');
  });

  it('creates a local item and pending sync operation', async () => {
    vi.mocked(itemLocalRepository.upsert).mockImplementation(async (value) => value);
    vi.mocked(syncOperationRepository.upsert).mockImplementation(async (value) => value);

    const item = await createLocalItem({
      title: '睡眠',
      type: 'metric',
      valueType: 'number',
      unit: '小時',
    });

    expect(item.syncStatus).toBe('pending');
    expect(item.version).toBe(1);
    expect(itemLocalRepository.upsert).toHaveBeenCalled();
    expect(syncOperationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'item',
        operationType: 'create',
        status: 'pending',
      }),
    );
  });

  it('creates a local record and pending sync operation', async () => {
    vi.mocked(itemLocalRepository.getById).mockResolvedValue({
      id: 'item-1',
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
    vi.mocked(recordLocalRepository.upsert).mockImplementation(async (value) => value);
    vi.mocked(syncOperationRepository.upsert).mockImplementation(async (value) => value);

    const record = await createLocalRecord({
      itemId: 'item-1',
      value: 6.5,
      recordedAt: '2026-06-16T08:00:00.000Z',
      note: '起床後',
    });

    expect(record.syncStatus).toBe('pending');
    expect(record.valueNumber).toBe(6.5);
    expect(syncOperationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'record',
        operationType: 'create',
      }),
    );
  });

  it('updates a local record and uses baseVersion from previous row', async () => {
    vi.mocked(recordLocalRepository.getById).mockResolvedValue({
      id: 'record-1',
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-16T08:00:00.000Z',
      note: '起床後',
      syncStatus: 'synced',
      createdAt: '2026-06-16T08:00:00.000Z',
      updatedAt: '2026-06-16T08:00:00.000Z',
      deletedAt: null,
      version: 2,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });
    vi.mocked(itemLocalRepository.getById).mockResolvedValue({
      id: 'item-1',
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
    vi.mocked(recordLocalRepository.upsert).mockImplementation(async (value) => value);
    vi.mocked(syncOperationRepository.upsert).mockImplementation(async (value) => value);

    const record = await updateLocalRecord({
      id: 'record-1',
      value: 7,
      note: '補記',
    });

    expect(record.version).toBe(3);
    expect(syncOperationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        baseVersion: 2,
        operationType: 'update',
      }),
    );
  });

  it('soft deletes a local item and creates delete operation', async () => {
    vi.mocked(itemLocalRepository.getById).mockResolvedValue({
      id: 'item-1',
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
      version: 4,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });
    vi.mocked(itemLocalRepository.softDelete).mockResolvedValue({
      id: 'item-1',
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      syncStatus: 'pending',
      createdAt: '2026-06-16T00:00:00.000Z',
      updatedAt: '2026-06-16T09:00:00.000Z',
      deletedAt: '2026-06-16T09:00:00.000Z',
      version: 5,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });
    vi.mocked(syncOperationRepository.upsert).mockImplementation(async (value) => value);

    const item = await deleteLocalItem('item-1');

    expect(item?.deletedAt).not.toBeNull();
    expect(syncOperationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        baseVersion: 4,
        operationType: 'delete',
      }),
    );
  });
});
