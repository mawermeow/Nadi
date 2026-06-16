import { randomUUID } from 'node:crypto';

import type { SessionUser } from '@/lib/auth/session';
import { AppError } from '@/lib/validation/errors';

import {
  findDeviceAccountLinkByDeviceId,
  touchDeviceAccountLink,
  upsertDeviceAccountLink,
  upsertUser,
} from './repository';

export async function ensureSessionUserRecord(user: SessionUser) {
  await upsertUser({
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  });
}

export async function linkDeviceToSessionUser(input: {
  user: SessionUser;
  deviceId: string;
  localItemCount: number;
  localRecordCount: number;
  pendingOperationCount: number;
  forceRelink?: boolean;
}) {
  await ensureSessionUserRecord(input.user);

  const existingLink = await findDeviceAccountLinkByDeviceId(input.deviceId);

  if (
    existingLink &&
    existingLink.userId !== input.user.id &&
    !input.forceRelink
  ) {
    throw new AppError(
      '這台裝置目前已連結到另一個帳號。若要改綁，請明確確認後再操作。',
      409,
      'DEVICE_ALREADY_LINKED',
    );
  }

  const now = new Date();

  const link = await upsertDeviceAccountLink({
    id: existingLink?.id ?? randomUUID(),
    userId: input.user.id,
    deviceId: input.deviceId,
    linkedAt: existingLink?.linkedAt ?? now,
    lastSeenAt: now,
    lastMergedAt:
      input.localItemCount > 0 ||
      input.localRecordCount > 0 ||
      input.pendingOperationCount > 0
        ? existingLink?.lastMergedAt ?? null
        : now,
  });

  return {
    link,
    requiresLocalMerge:
      input.localItemCount > 0 ||
      input.localRecordCount > 0 ||
      input.pendingOperationCount > 0,
  };
}

export async function recordDeviceSeenForUser(input: {
  user: SessionUser;
  deviceId: string;
  markMerged?: boolean;
}) {
  await ensureSessionUserRecord(input.user);

  const now = new Date();
  const existingLink = await findDeviceAccountLinkByDeviceId(input.deviceId);

  if (!existingLink || existingLink.userId !== input.user.id) {
    await upsertDeviceAccountLink({
      id: existingLink?.id ?? randomUUID(),
      userId: input.user.id,
      deviceId: input.deviceId,
      linkedAt: existingLink?.linkedAt ?? now,
      lastSeenAt: now,
      lastMergedAt: input.markMerged ? now : existingLink?.lastMergedAt ?? null,
    });
    return;
  }

  await touchDeviceAccountLink({
    userId: input.user.id,
    deviceId: input.deviceId,
    lastSeenAt: now,
    lastMergedAt: input.markMerged ? now : existingLink.lastMergedAt,
  });
}
