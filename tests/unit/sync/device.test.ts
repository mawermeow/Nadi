import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/sync/local-meta-repository', () => ({
  syncMetaRepository: {
    getById: vi.fn(),
    upsert: vi.fn(),
  },
}));

import { getOrCreateDeviceId } from '@/features/sync/device';
import { syncMetaRepository } from '@/features/sync/local-meta-repository';

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses an existing device id from sync meta', async () => {
    vi.mocked(syncMetaRepository.getById).mockResolvedValue({
      id: 'device-id',
      key: 'deviceId',
      value: 'device-existing',
      syncStatus: 'synced',
      createdAt: '2026-06-16T00:00:00.000Z',
      updatedAt: '2026-06-16T00:00:00.000Z',
      deletedAt: null,
      version: 1,
      lastSyncedAt: null,
      deviceId: 'device-existing',
    });

    const deviceId = await getOrCreateDeviceId();

    expect(deviceId).toBe('device-existing');
  });
});
