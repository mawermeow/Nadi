import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/service', () => ({
  ensureSessionUserRecord: vi.fn(),
}));

vi.mock('@/features/items/repository', () => ({
  createItemRecord: vi.fn(),
  findItemByIdForUser: vi.fn(),
  listItemsByUserId: vi.fn(),
  updateItemRecord: vi.fn(),
}));

import {
  createItemForUser,
  listItemsForUser,
  updateItemForUser,
} from '@/features/items/service';
import {
  createItemRecord,
  findItemByIdForUser,
  listItemsByUserId,
  updateItemRecord,
} from '@/features/items/repository';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'local@nadi.dev',
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
});
