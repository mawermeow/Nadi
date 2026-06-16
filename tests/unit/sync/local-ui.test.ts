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
  },
}));

import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import {
  getSyncStatusPresentation,
  hydrateLocalStoreFromServerSnapshot,
  loadLocalItems,
  loadLocalRecords,
  loadSyncOperationIssues,
} from '@/features/sync/local-ui';

describe('local ui helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates empty local stores from server snapshot', async () => {
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(itemLocalRepository.upsert).mockImplementation(async (value) => value);
    vi.mocked(recordLocalRepository.upsert).mockImplementation(async (value) => value);

    await hydrateLocalStoreFromServerSnapshot({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: '睡眠',
          type: 'metric',
          unit: '小時',
          valueType: 'number',
          archived: false,
          version: 1,
          createdAt: '2026-06-16T00:00:00.000Z',
        },
      ],
      records: [
        {
          id: '11111111-1111-4111-8111-111111111118',
          itemId: '11111111-1111-4111-8111-111111111111',
          itemTitle: '睡眠',
          itemType: 'metric',
          valueType: 'number',
          value: 6.5,
          unit: '小時',
          recordedAt: '2026-06-16T08:00:00.000Z',
          itemArchived: false,
          version: 1,
          createdAt: '2026-06-16T08:00:00.000Z',
        },
      ],
    });

    expect(itemLocalRepository.upsert).toHaveBeenCalledTimes(1);
    expect(recordLocalRepository.upsert).toHaveBeenCalledTimes(1);
  });

  it('keeps existing local data on refresh hydration', async () => {
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([
      {
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
      },
    ]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([]);

    await hydrateLocalStoreFromServerSnapshot({
      items: [],
      records: [],
    });

    expect(itemLocalRepository.upsert).not.toHaveBeenCalled();
  });

  it('loads local items for immediate local-first display', async () => {
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([
      {
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
      },
    ]);

    const items = await loadLocalItems();

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('睡眠');
    expect(items[0]?.syncStatus).toBe('pending');
  });

  it('loads local records for immediate local-first display', async () => {
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([
      {
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
      },
    ]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111118',
        itemId: '11111111-1111-4111-8111-111111111111',
        valueNumber: 6.5,
        valueBoolean: null,
        valueText: null,
        recordedAt: '2026-06-16T08:00:00.000Z',
        note: '起床後',
        syncStatus: 'pending',
        createdAt: '2026-06-16T08:00:00.000Z',
        updatedAt: '2026-06-16T08:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
      },
    ]);

    const records = await loadLocalRecords();

    expect(records).toHaveLength(1);
    expect(records[0]?.itemTitle).toBe('睡眠');
    expect(records[0]?.syncStatus).toBe('pending');
  });

  it('returns lightweight sync status labels for ui badges', () => {
    expect(getSyncStatusPresentation('pending')?.label).toBe('等待同步');
    expect(getSyncStatusPresentation('failed')?.label).toBe('同步失敗');
    expect(getSyncStatusPresentation('conflict')?.label).toBe('同步衝突');
    expect(getSyncStatusPresentation('synced')).toBeNull();
  });

  it('loads readable failed and conflict sync issues', async () => {
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([
      {
        id: 'op-1',
        operationId: 'op-1',
        entityType: 'record',
        operationType: 'create',
        entityId: 'record-1',
        baseVersion: null,
        payload: {},
        status: 'failed',
        syncStatus: 'failed',
        createdAt: '2026-06-16T08:00:00.000Z',
        updatedAt: '2026-06-16T09:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 1,
        lastError: 'ENTITY_NOT_FOUND: 找不到對應的項目',
      },
      {
        id: 'op-2',
        operationId: 'op-2',
        entityType: 'item',
        operationType: 'update',
        entityId: 'item-1',
        baseVersion: 1,
        payload: {},
        status: 'conflict',
        syncStatus: 'conflict',
        createdAt: '2026-06-16T08:00:00.000Z',
        updatedAt: '2026-06-16T10:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: null,
        deviceId: 'device-local',
        retryCount: 0,
        lastError: 'version conflict (1 -> 2)',
      },
      {
        id: 'op-3',
        operationId: 'op-3',
        entityType: 'item',
        operationType: 'create',
        entityId: 'item-2',
        baseVersion: null,
        payload: {},
        status: 'synced',
        syncStatus: 'synced',
        createdAt: '2026-06-16T08:00:00.000Z',
        updatedAt: '2026-06-16T11:00:00.000Z',
        deletedAt: null,
        version: 1,
        lastSyncedAt: '2026-06-16T11:00:00.000Z',
        deviceId: 'device-local',
        retryCount: 0,
        lastError: null,
      },
    ]);

    const issues = await loadSyncOperationIssues();

    expect(issues).toHaveLength(2);
    expect(issues[0]?.title).toBe('項目更新');
    expect(issues[0]?.statusLabel).toBe('同步衝突');
    expect(issues[1]?.title).toBe('紀錄新增');
    expect(issues[1]?.lastError).toContain('ENTITY_NOT_FOUND');
  });
});
