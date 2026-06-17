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
    delete: vi.fn(),
    getAll: vi.fn(),
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
  deleteLocalRecord,
  updateLocalRecord,
} from '@/features/sync/local-service';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';

describe('local service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateDeviceId).mockResolvedValue('device-local');
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([]);
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

  it('removes related record create/update operations when unsynced record is deleted', async () => {
    vi.mocked(recordLocalRepository.getById).mockResolvedValue({
      id: 'record-1',
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-16T08:00:00.000Z',
      note: '起床後',
      syncStatus: 'failed',
      createdAt: '2026-06-16T08:00:00.000Z',
      updatedAt: '2026-06-16T09:00:00.000Z',
      deletedAt: null,
      version: 2,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      {
        id: 'op-create',
        operationId: 'op-create',
        entityType: 'record',
        operationType: 'create',
        entityId: 'record-1',
        baseVersion: null,
        payload: {},
        status: 'failed',
        syncStatus: 'failed',
        createdAt: '2026-06-16T08:00:00.000Z',
        updatedAt: '2026-06-16T08:30:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 1,
        lastError: 'PAYLOAD_INVALID',
      },
      {
        id: 'op-update',
        operationId: 'op-update',
        entityType: 'record',
        operationType: 'update',
        entityId: 'record-1',
        baseVersion: 1,
        payload: {},
        status: 'failed',
        syncStatus: 'failed',
        createdAt: '2026-06-16T08:31:00.000Z',
        updatedAt: '2026-06-16T09:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 1,
        lastError: 'ENTITY_NOT_FOUND',
      },
    ]);
    vi.mocked(recordLocalRepository.softDelete).mockResolvedValue({
      id: 'record-1',
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-16T08:00:00.000Z',
      note: '起床後',
      syncStatus: 'pending',
      createdAt: '2026-06-16T08:00:00.000Z',
      updatedAt: '2026-06-16T10:00:00.000Z',
      deletedAt: '2026-06-16T10:00:00.000Z',
      version: 3,
      lastSyncedAt: null,
      deviceId: 'device-local',
    });

    await deleteLocalRecord('record-1');

    expect(syncOperationRepository.delete).toHaveBeenCalledWith('op-create');
    expect(syncOperationRepository.delete).toHaveBeenCalledWith('op-update');
    expect(syncOperationRepository.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'record',
        operationType: 'delete',
      }),
    );
  });

  it('collapses pending record updates into one delete operation', async () => {
    vi.mocked(recordLocalRepository.getById).mockResolvedValue({
      id: 'record-1',
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-16T08:00:00.000Z',
      note: '起床後',
      syncStatus: 'pending',
      createdAt: '2026-06-16T08:00:00.000Z',
      updatedAt: '2026-06-16T09:00:00.000Z',
      deletedAt: null,
      version: 4,
      lastSyncedAt: '2026-06-16T08:00:00.000Z',
      deviceId: 'device-local',
    });
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      {
        id: 'op-update-1',
        operationId: 'op-update-1',
        entityType: 'record',
        operationType: 'update',
        entityId: 'record-1',
        baseVersion: 2,
        payload: {},
        status: 'pending',
        syncStatus: 'pending',
        createdAt: '2026-06-16T08:30:00.000Z',
        updatedAt: '2026-06-16T08:30:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 0,
        lastError: null,
      },
      {
        id: 'op-update-2',
        operationId: 'op-update-2',
        entityType: 'record',
        operationType: 'update',
        entityId: 'record-1',
        baseVersion: 3,
        payload: {},
        status: 'pending',
        syncStatus: 'pending',
        createdAt: '2026-06-16T08:40:00.000Z',
        updatedAt: '2026-06-16T08:40:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 0,
        lastError: null,
      },
    ]);
    vi.mocked(recordLocalRepository.softDelete).mockResolvedValue({
      id: 'record-1',
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-16T08:00:00.000Z',
      note: '起床後',
      syncStatus: 'pending',
      createdAt: '2026-06-16T08:00:00.000Z',
      updatedAt: '2026-06-16T10:00:00.000Z',
      deletedAt: '2026-06-16T10:00:00.000Z',
      version: 5,
      lastSyncedAt: '2026-06-16T08:00:00.000Z',
      deviceId: 'device-local',
    });
    vi.mocked(syncOperationRepository.upsert).mockImplementation(async (value) => value);

    await deleteLocalRecord('record-1');

    expect(syncOperationRepository.delete).toHaveBeenCalledWith('op-update-1');
    expect(syncOperationRepository.delete).toHaveBeenCalledWith('op-update-2');
    expect(syncOperationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'record',
        operationType: 'delete',
        baseVersion: 2,
      }),
    );
  });
});
