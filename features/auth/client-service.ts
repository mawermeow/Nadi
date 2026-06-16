'use client';

import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { getOrCreateDeviceId } from '@/features/sync/device';
import {
  clearLinkedAccount,
  getLinkedAccount,
  setLinkedAccount,
} from '@/features/sync/meta';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';

export type LocalAccountMergeSummary = {
  deviceId: string;
  localItemCount: number;
  localRecordCount: number;
  pendingOperationCount: number;
  linkedAccountUserId: string | null;
};

export async function getLocalAccountMergeSummary(): Promise<LocalAccountMergeSummary> {
  const [deviceId, items, records, operations, linkedAccount] = await Promise.all([
    getOrCreateDeviceId(),
    itemLocalRepository.getAll({ includeDeleted: true }),
    recordLocalRepository.getAll({ includeDeleted: true }),
    syncOperationRepository.getAll(),
    getLinkedAccount(),
  ]);

  return {
    deviceId,
    localItemCount: items.filter((item) => item.deletedAt === null).length,
    localRecordCount: records.filter((record) => record.deletedAt === null).length,
    pendingOperationCount: operations.filter(
      (operation) => operation.status === 'pending' || operation.status === 'failed',
    ).length,
    linkedAccountUserId: linkedAccount?.userId ?? null,
  };
}

export async function linkDeviceToAuthenticatedAccount(input: {
  userId: string;
  email: string;
  forceRelink?: boolean;
}) {
  const summary = await getLocalAccountMergeSummary();
  const response = await fetch('/v1/account/device-link', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: summary.deviceId,
      localItemCount: summary.localItemCount,
      localRecordCount: summary.localRecordCount,
      pendingOperationCount: summary.pendingOperationCount,
      forceRelink: input.forceRelink,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? '裝置連結失敗');
  }

  await setLinkedAccount({
    userId: input.userId,
    email: input.email,
    linkedAt: data.deviceLink.linkedAt,
  });

  return data as {
    deviceLink: {
      userId: string;
      deviceId: string;
      linkedAt: string;
      lastSeenAt: string;
      lastMergedAt: string | null;
    };
    requiresLocalMerge: boolean;
  };
}

export async function unlinkLocalAccount() {
  await clearLinkedAccount();
}
