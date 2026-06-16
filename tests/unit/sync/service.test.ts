import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/service', () => ({
  ensureSessionUserRecord: vi.fn(),
  recordDeviceSeenForUser: vi.fn(),
}));

vi.mock('@/features/items/repository', () => ({
  findItemByIdForUser: vi.fn(),
}));

vi.mock('@/features/sync/repository', () => ({
  createSyncItemRecord: vi.fn(),
  createSyncRecordRecord: vi.fn(),
  findSyncItemById: vi.fn(),
  findSyncItemByIdForUser: vi.fn(),
  findSyncRecordById: vi.fn(),
  findSyncRecordByIdForUser: vi.fn(),
  listSyncItemsByUserId: vi.fn(),
  listSyncRecordsByUserId: vi.fn(),
  updateSyncItemRecord: vi.fn(),
  updateSyncRecordRecord: vi.fn(),
}));

import { findItemByIdForUser } from '@/features/items/repository';
import {
  createSyncItemRecord,
  findSyncItemById,
  findSyncItemByIdForUser,
  findSyncRecordById,
  findSyncRecordByIdForUser,
  listSyncItemsByUserId,
  listSyncRecordsByUserId,
  updateSyncRecordRecord,
} from '@/features/sync/repository';
import { pullSyncChangesForUser, pushSyncOperationsForUser } from '@/features/sync/service';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'local@nadi.dev',
  name: 'Local User',
  emailVerified: true,
};

const baseItem = {
  id: 'item-1',
  userId: user.id,
  title: '睡眠',
  type: 'metric' as const,
  unit: '小時',
  valueType: 'number' as const,
  scaleMin: null,
  scaleMax: null,
  archived: false,
  syncStatus: 'synced' as const,
  version: 1,
  deletedAt: null,
  lastSyncedAt: new Date('2026-06-16T00:00:00.000Z'),
  deviceId: 'device-a',
  createdAt: new Date('2026-06-16T00:00:00.000Z'),
  updatedAt: new Date('2026-06-16T00:00:00.000Z'),
};

const baseRecord = {
  id: 'record-1',
  userId: user.id,
  itemId: 'item-1',
  valueNumber: 6.5,
  valueText: null,
  valueBoolean: null,
  recordedAt: new Date('2026-06-16T00:00:00.000Z'),
  note: '晚餐後',
  syncStatus: 'synced' as const,
  version: 1,
  deletedAt: null,
  lastSyncedAt: new Date('2026-06-16T00:00:00.000Z'),
  deviceId: 'device-a',
  createdAt: new Date('2026-06-16T00:00:00.000Z'),
  updatedAt: new Date('2026-06-16T00:00:00.000Z'),
};

describe('sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes create item operation', async () => {
    vi.mocked(findSyncItemById).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof findSyncItemById>>,
    );
    vi.mocked(createSyncItemRecord).mockResolvedValue(baseItem);

    const result = await pushSyncOperationsForUser(user, {
      deviceId: 'device-a',
      operations: [
        {
          operationId: 'op-1',
          entityType: 'item',
          operationType: 'create',
          entityId: '11111111-1111-4111-8111-111111111119',
          payload: {
            title: '睡眠',
            type: 'metric',
            valueType: 'number',
            unit: '小時',
          },
          clientCreatedAt: '2026-06-16T00:00:00.000Z',
          clientUpdatedAt: '2026-06-16T00:00:00.000Z',
        },
      ],
    });

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('pushes update with matching version', async () => {
    vi.mocked(findSyncRecordByIdForUser).mockResolvedValue(baseRecord);
    vi.mocked(findItemByIdForUser).mockResolvedValue(baseItem);
    vi.mocked(updateSyncRecordRecord).mockResolvedValue({
      ...baseRecord,
      version: 2,
      valueNumber: 7,
      updatedAt: new Date('2026-06-16T01:00:00.000Z'),
    });

    const result = await pushSyncOperationsForUser(user, {
      deviceId: 'device-a',
      operations: [
        {
          operationId: 'op-2',
          entityType: 'record',
          operationType: 'update',
          entityId: '11111111-1111-4111-8111-111111111118',
          baseVersion: 1,
          payload: {
            value: 7,
            recordedAt: '2026-06-16T01:00:00.000Z',
          },
          clientCreatedAt: '2026-06-16T00:00:00.000Z',
          clientUpdatedAt: '2026-06-16T01:00:00.000Z',
        },
      ],
    });

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.version).toBe(2);
  });

  it('detects update version conflict', async () => {
    vi.mocked(findSyncRecordByIdForUser).mockResolvedValue({
      ...baseRecord,
      version: 3,
    });

    const result = await pushSyncOperationsForUser(user, {
      deviceId: 'device-a',
      operations: [
        {
          operationId: 'op-3',
          entityType: 'record',
          operationType: 'update',
          entityId: '11111111-1111-4111-8111-111111111118',
          baseVersion: 1,
          payload: {
            note: '補記',
          },
          clientCreatedAt: '2026-06-16T00:00:00.000Z',
          clientUpdatedAt: '2026-06-16T01:00:00.000Z',
        },
      ],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.currentVersion).toBe(3);
  });

  it('pushes soft delete operation', async () => {
    vi.mocked(findSyncRecordByIdForUser).mockResolvedValue(baseRecord);
    vi.mocked(updateSyncRecordRecord).mockResolvedValue({
      ...baseRecord,
      version: 2,
      deletedAt: new Date('2026-06-16T02:00:00.000Z'),
      updatedAt: new Date('2026-06-16T02:00:00.000Z'),
    });

    const result = await pushSyncOperationsForUser(user, {
      deviceId: 'device-a',
      operations: [
        {
          operationId: 'op-4',
          entityType: 'record',
          operationType: 'delete',
          entityId: '11111111-1111-4111-8111-111111111118',
          baseVersion: 1,
          payload: {},
          clientCreatedAt: '2026-06-16T00:00:00.000Z',
          clientUpdatedAt: '2026-06-16T02:00:00.000Z',
        },
      ],
    });

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.version).toBe(2);
  });

  it('pulls initial data', async () => {
    vi.mocked(listSyncItemsByUserId).mockResolvedValue([baseItem]);
    vi.mocked(listSyncRecordsByUserId).mockResolvedValue([baseRecord]);

    const result = await pullSyncChangesForUser(user, {
      deviceId: 'device-a',
    });

    expect(result.items).toHaveLength(1);
    expect(result.records).toHaveLength(1);
    expect(result.tombstones).toHaveLength(0);
  });

  it('pulls incremental changes', async () => {
    vi.mocked(listSyncItemsByUserId).mockResolvedValue([
      {
        ...baseItem,
        updatedAt: new Date('2026-06-16T03:00:00.000Z'),
      },
    ]);
    vi.mocked(listSyncRecordsByUserId).mockResolvedValue([]);

    const result = await pullSyncChangesForUser(user, {
      deviceId: 'device-a',
      lastPulledAt: '2026-06-16T02:00:00.000Z',
    });

    expect(result.items).toHaveLength(1);
    expect(result.records).toHaveLength(0);
  });

  it('returns tombstones on pull', async () => {
    vi.mocked(listSyncItemsByUserId).mockResolvedValue([
      {
        ...baseItem,
        deletedAt: new Date('2026-06-16T03:00:00.000Z'),
        updatedAt: new Date('2026-06-16T03:00:00.000Z'),
      },
    ]);
    vi.mocked(listSyncRecordsByUserId).mockResolvedValue([]);

    const result = await pullSyncChangesForUser(user, {
      deviceId: 'device-a',
      lastPulledAt: '2026-06-16T02:00:00.000Z',
    });

    expect(result.items).toHaveLength(0);
    expect(result.tombstones).toHaveLength(1);
    expect(result.tombstones[0]?.entityType).toBe('item');
  });
});
