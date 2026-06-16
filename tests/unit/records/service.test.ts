import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/service', () => ({
  ensureSessionUserRecord: vi.fn(),
}));

vi.mock('@/features/items/repository', () => ({
  findItemByIdForUser: vi.fn(),
}));

vi.mock('@/features/records/repository', () => ({
  createRecordRecord: vi.fn(),
  findRecordById: vi.fn(),
  findRecordByIdForUser: vi.fn(),
  listRecordsByUserId: vi.fn(),
  softDeleteRecordByIdForUser: vi.fn(),
  updateRecordByIdForUser: vi.fn(),
}));

import { findItemByIdForUser } from '@/features/items/repository';
import {
  createRecordRecord,
  findRecordById,
  findRecordByIdForUser,
  listRecordsByUserId,
  softDeleteRecordByIdForUser,
  updateRecordByIdForUser,
} from '@/features/records/repository';
import {
  createRecordForUser,
  deleteRecordForUser,
  listRecordsForUser,
  updateRecordForUser,
} from '@/features/records/service';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'local@nadi.dev',
};

const syncFields = {
  syncStatus: 'synced' as const,
  version: 1,
  deletedAt: null,
  lastSyncedAt: null,
  deviceId: null,
};

describe('record service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a numeric record for a valid item', async () => {
    vi.mocked(findRecordById).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof findRecordById>>,
    );
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(createRecordRecord).mockResolvedValue({
      id: 'record-1',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T10:30:00.000Z'),
      note: '午睡後補記',
      ...syncFields,
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T10:31:00.000Z'),
    });
    vi.mocked(listRecordsByUserId).mockResolvedValue([
      {
        id: 'record-1',
        itemId: 'item-1',
        itemTitle: '睡眠',
        itemType: 'metric',
        itemArchived: false,
        valueType: 'number',
        valueNumber: 6.5,
        valueBoolean: null,
        valueText: null,
        unit: '小時',
        recordedAt: new Date('2026-06-15T10:30:00.000Z'),
        note: '午睡後補記',
        version: 1,
        createdAt: new Date('2026-06-15T10:31:00.000Z'),
      },
    ]);

    const result = await createRecordForUser(user, {
      itemId: '11111111-1111-4111-8111-111111111111',
      value: 6.5,
      recordedAt: '2026-06-15T10:30:00.000Z',
      note: '午睡後補記',
    });

    expect(createRecordRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        valueNumber: 6.5,
      }),
    );
    expect(result.value).toBe(6.5);
  });

  it('accepts a client-generated record id', async () => {
    vi.mocked(findRecordById).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof findRecordById>>,
    );
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(createRecordRecord).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111118',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T10:30:00.000Z'),
      note: null,
      ...syncFields,
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T10:31:00.000Z'),
    });
    vi.mocked(listRecordsByUserId).mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111118',
        itemId: 'item-1',
        itemTitle: '睡眠',
        itemType: 'metric',
        itemArchived: false,
        valueType: 'number',
        valueNumber: 6.5,
        valueBoolean: null,
        valueText: null,
        unit: '小時',
        recordedAt: new Date('2026-06-15T10:30:00.000Z'),
        note: null,
        version: 1,
        createdAt: new Date('2026-06-15T10:31:00.000Z'),
      },
    ]);

    await createRecordForUser(user, {
      id: '11111111-1111-4111-8111-111111111118',
      itemId: '11111111-1111-4111-8111-111111111111',
      value: 6.5,
      recordedAt: '2026-06-15T10:30:00.000Z',
    });

    expect(createRecordRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111118',
      }),
    );
  });

  it('rejects duplicate client-generated record id', async () => {
    vi.mocked(findRecordById).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111118',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date(),
      note: null,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createRecordForUser(user, {
        id: '11111111-1111-4111-8111-111111111118',
        itemId: '11111111-1111-4111-8111-111111111111',
        value: 6.5,
        recordedAt: '2026-06-15T10:30:00.000Z',
      }),
    ).rejects.toThrow('這個 id 已存在');
  });

  it('rejects creating a record on an archived item', async () => {
    vi.mocked(findRecordById).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof findRecordById>>,
    );
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '舊項目',
      type: 'metric',
      unit: null,
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: true,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createRecordForUser(user, {
        itemId: '11111111-1111-4111-8111-111111111111',
        value: 3,
        recordedAt: '2026-06-15T10:30:00.000Z',
      }),
    ).rejects.toThrow('已封存項目不能建立新紀錄');
  });

  it('lists records with date range filters', async () => {
    vi.mocked(listRecordsByUserId).mockResolvedValue([]);

    await listRecordsForUser(user, {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-15T23:59:59.999Z',
    });

    expect(listRecordsByUserId).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        limit: 100,
      }),
    );
  });

  it('soft deletes only an existing user-owned record', async () => {
    vi.mocked(findRecordByIdForUser).mockResolvedValue({
      id: 'record-1',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T10:30:00.000Z'),
      note: null,
      ...syncFields,
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T10:31:00.000Z'),
    });
    vi.mocked(softDeleteRecordByIdForUser).mockResolvedValue({
      id: 'record-1',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T10:30:00.000Z'),
      note: null,
      ...syncFields,
      version: 2,
      deletedAt: new Date(),
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T10:31:00.000Z'),
    });

    await deleteRecordForUser(
      user,
      '11111111-1111-4111-8111-111111111112',
    );

    expect(softDeleteRecordByIdForUser).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111112',
      user.id,
      expect.objectContaining({
        version: 2,
        deletedAt: expect.any(Date),
      }),
    );
  });

  it('updates an existing record', async () => {
    vi.mocked(findRecordByIdForUser).mockResolvedValue({
      id: 'record-1',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T10:30:00.000Z'),
      note: '原始備註',
      ...syncFields,
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T10:31:00.000Z'),
    });
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(updateRecordByIdForUser).mockResolvedValue({
      id: 'record-1',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 7,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T11:00:00.000Z'),
      note: '更新後備註',
      ...syncFields,
      version: 2,
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T11:01:00.000Z'),
    });
    vi.mocked(listRecordsByUserId).mockResolvedValue([
      {
        id: 'record-1',
        itemId: 'item-1',
        itemTitle: '睡眠',
        itemType: 'metric',
        itemArchived: false,
        valueType: 'number',
        valueNumber: 7,
        valueBoolean: null,
        valueText: null,
        unit: '小時',
        recordedAt: new Date('2026-06-15T11:00:00.000Z'),
        note: '更新後備註',
        version: 2,
        createdAt: new Date('2026-06-15T10:31:00.000Z'),
      },
    ]);

    const result = await updateRecordForUser(
      user,
      '11111111-1111-4111-8111-111111111112',
      {
        value: 7,
        recordedAt: '2026-06-15T11:00:00.000Z',
        note: '更新後備註',
        version: 1,
      },
    );

    expect(updateRecordByIdForUser).toHaveBeenCalledWith(
      expect.any(String),
      user.id,
      expect.objectContaining({
        version: 2,
      }),
    );
    expect(result.value).toBe(7);
    expect(result.version).toBe(2);
  });

  it('rejects record update when version mismatches', async () => {
    vi.mocked(findRecordByIdForUser).mockResolvedValue({
      id: 'record-1',
      userId: user.id,
      itemId: 'item-1',
      valueNumber: 6.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: new Date('2026-06-15T10:30:00.000Z'),
      note: '原始備註',
      ...syncFields,
      version: 3,
      createdAt: new Date('2026-06-15T10:31:00.000Z'),
      updatedAt: new Date('2026-06-15T10:31:00.000Z'),
    });

    await expect(
      updateRecordForUser(user, '11111111-1111-4111-8111-111111111112', {
        note: '更新後備註',
        version: 1,
      }),
    ).rejects.toThrow('紀錄版本不一致，請重新整理後再試一次');
  });
});
