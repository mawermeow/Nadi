import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/repository', () => ({
  findDeviceAccountLinkByDeviceId: vi.fn(),
  touchDeviceAccountLink: vi.fn(),
  upsertDeviceAccountLink: vi.fn(),
  upsertUser: vi.fn(),
}));

import {
  findDeviceAccountLinkByDeviceId,
  touchDeviceAccountLink,
  upsertDeviceAccountLink,
  upsertUser,
} from '@/features/auth/repository';
import {
  ensureSessionUserRecord,
  linkDeviceToSessionUser,
  recordDeviceSeenForUser,
} from '@/features/auth/service';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'local@nadi.dev',
  name: 'Local User',
  emailVerified: true,
};

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts the authenticated user profile', async () => {
    await ensureSessionUserRecord(user);

    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: true,
      }),
    );
  });

  it('links a device to the current account', async () => {
    vi.mocked(findDeviceAccountLinkByDeviceId).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof findDeviceAccountLinkByDeviceId>>,
    );
    vi.mocked(upsertDeviceAccountLink).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      userId: user.id,
      deviceId: 'device-local',
      linkedAt: new Date('2026-06-16T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-16T00:00:00.000Z'),
      lastMergedAt: null,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
      updatedAt: new Date('2026-06-16T00:00:00.000Z'),
    });

    const result = await linkDeviceToSessionUser({
      user,
      deviceId: 'device-local',
      localItemCount: 3,
      localRecordCount: 9,
      pendingOperationCount: 2,
    });

    expect(result.requiresLocalMerge).toBe(true);
    expect(upsertDeviceAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        deviceId: 'device-local',
      }),
    );
  });

  it('rejects silent relink to another account', async () => {
    vi.mocked(findDeviceAccountLinkByDeviceId).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      deviceId: 'device-local',
      linkedAt: new Date('2026-06-16T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-16T00:00:00.000Z'),
      lastMergedAt: null,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
      updatedAt: new Date('2026-06-16T00:00:00.000Z'),
    });

    await expect(
      linkDeviceToSessionUser({
        user,
        deviceId: 'device-local',
        localItemCount: 0,
        localRecordCount: 0,
        pendingOperationCount: 0,
      }),
    ).rejects.toThrow('這台裝置目前已連結到另一個帳號');
  });

  it('touches the device link after sync activity', async () => {
    vi.mocked(findDeviceAccountLinkByDeviceId).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      userId: user.id,
      deviceId: 'device-local',
      linkedAt: new Date('2026-06-16T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-16T00:00:00.000Z'),
      lastMergedAt: null,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
      updatedAt: new Date('2026-06-16T00:00:00.000Z'),
    });

    await recordDeviceSeenForUser({
      user,
      deviceId: 'device-local',
      markMerged: true,
    });

    expect(touchDeviceAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        deviceId: 'device-local',
      }),
    );
  });
});
