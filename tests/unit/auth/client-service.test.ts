import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/items/local-repository', () => ({
  itemLocalRepository: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/features/records/local-repository', () => ({
  recordLocalRepository: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/features/sync/device', () => ({
  getOrCreateDeviceId: vi.fn(),
}));

vi.mock('@/features/sync/meta', () => ({
  clearLinkedAccount: vi.fn(),
  getLinkedAccount: vi.fn(),
  setLinkedAccount: vi.fn(),
}));

vi.mock('@/features/sync/local-operation-repository', () => ({
  syncOperationRepository: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/features/sync/local-user-scope', () => ({
  assignAnonymousLocalDataToUser: vi.fn(),
}));

vi.mock('@/lib/local-db/client', () => ({
  deleteLocalDatabase: vi.fn(),
}));

import { getOrCreateDeviceId } from '@/features/sync/device';
import { getLinkedAccount } from '@/features/sync/meta';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { deleteLocalDatabase } from '@/lib/local-db/client';
import {
  clearLocalDatabaseState,
  getLocalAccountMergeSummary,
} from '@/features/auth/client-service';

describe('auth client service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summarizes only the currently linked local scope', async () => {
    vi.mocked(getLinkedAccount).mockResolvedValue({
      userId: 'user-1',
      email: 'user-1@nadi.dev',
      linkedAt: '2026-06-17T00:00:00.000Z',
    });
    vi.mocked(getOrCreateDeviceId).mockResolvedValue('device-local');
    vi.mocked(itemLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(recordLocalRepository.getAll).mockResolvedValue([]);
    vi.mocked(syncOperationRepository.getAll).mockResolvedValue([]);

    const summary = await getLocalAccountMergeSummary();

    expect(summary.linkedAccountUserId).toBe('user-1');
    expect(itemLocalRepository.getAll).toHaveBeenCalledWith({
      includeDeleted: true,
      userId: 'user-1',
    });
  });

  it('clears the local IndexedDB state', async () => {
    vi.mocked(deleteLocalDatabase).mockResolvedValue(undefined);

    await clearLocalDatabaseState();

    expect(deleteLocalDatabase).toHaveBeenCalledTimes(1);
  });
});
