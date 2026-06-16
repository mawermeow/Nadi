import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/service', () => ({
  ensureSessionUserRecord: vi.fn(),
}));

vi.mock('@/features/items/repository', () => ({
  createItemRecord: vi.fn(),
  findItemById: vi.fn(),
  findItemByIdForUser: vi.fn(),
  listItemsByUserId: vi.fn(),
  updateItemRecord: vi.fn(),
}));

import {
  createItemRecord,
  findItemById,
  findItemByIdForUser,
  listItemsByUserId,
  updateItemRecord,
} from '@/features/items/repository';
import {
  createItemForUser,
  deleteItemForUser,
  listItemsForUser,
  updateItemForUser,
} from '@/features/items/service';

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

describe('item service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only active items by default', async () => {
    vi.mocked(listItemsByUserId).mockResolvedValue([]);

    await listItemsForUser(user);

    expect(listItemsByUserId).toHaveBeenCalledWith(user.id, undefined);
  });

  it('creates an item for the current user', async () => {
    vi.mocked(findItemById).mockResolvedValue(undefined);
    vi.mocked(createItemRecord).mockResolvedValue({
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

    const result = await createItemForUser(user, {
      title: '睡眠',
      type: 'metric',
      unit: '小時',
      valueType: 'number',
    });

    expect(createItemRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        title: '睡眠',
      }),
    );
    expect(result.title).toBe('睡眠');
  });

  it('accepts a client-generated item id', async () => {
    vi.mocked(findItemById).mockResolvedValue(undefined);
    vi.mocked(createItemRecord).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111119',
      userId: user.id,
      title: '心情',
      type: 'symptom',
      unit: null,
      valueType: 'text',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createItemForUser(user, {
      id: '11111111-1111-4111-8111-111111111119',
      title: '心情',
      type: 'symptom',
      valueType: 'text',
    });

    expect(createItemRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111119',
      }),
    );
  });

  it('rejects duplicate client-generated item id', async () => {
    vi.mocked(findItemById).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111119',
      userId: user.id,
      title: '既有項目',
      type: 'metric',
      unit: null,
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createItemForUser(user, {
        id: '11111111-1111-4111-8111-111111111119',
        title: '新的項目',
        type: 'metric',
        valueType: 'number',
      }),
    ).rejects.toThrow('這個 id 已存在');
  });

  it('rejects invalid scale updates on non-scale items', async () => {
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '喝水',
      type: 'metric',
      unit: '杯',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      updateItemForUser(user, '11111111-1111-4111-8111-111111111112', {
        scaleMin: 1,
        scaleMax: 5,
      }),
    ).rejects.toThrow('只有量表型項目可以設定最小值與最大值');

    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it('increments item version when update succeeds', async () => {
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '喝水',
      type: 'metric',
      unit: '杯',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(updateItemRecord).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '每日喝水',
      type: 'metric',
      unit: '杯',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await updateItemForUser(
      user,
      '11111111-1111-4111-8111-111111111112',
      {
        title: '每日喝水',
        version: 1,
      },
    );

    expect(updateItemRecord).toHaveBeenCalledWith(
      expect.any(String),
      user.id,
      expect.objectContaining({
        title: '每日喝水',
        version: 2,
      }),
    );
    expect(result.version).toBe(2);
  });

  it('rejects item update when version mismatches', async () => {
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '喝水',
      type: 'metric',
      unit: '杯',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      updateItemForUser(user, '11111111-1111-4111-8111-111111111112', {
        title: '每日喝水',
        version: 1,
      }),
    ).rejects.toThrow('項目版本不一致，請重新整理後再試一次');
  });

  it('soft deletes an item by setting deletedAt and bumping version', async () => {
    vi.mocked(findItemByIdForUser).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '喝水',
      type: 'metric',
      unit: '杯',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(updateItemRecord).mockResolvedValue({
      id: 'item-1',
      userId: user.id,
      title: '喝水',
      type: 'metric',
      unit: '杯',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      archived: false,
      ...syncFields,
      version: 2,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await deleteItemForUser(user, '11111111-1111-4111-8111-111111111112');

    expect(updateItemRecord).toHaveBeenCalledWith(
      expect.any(String),
      user.id,
      expect.objectContaining({
        version: 2,
        deletedAt: expect.any(Date),
      }),
    );
  });
});
