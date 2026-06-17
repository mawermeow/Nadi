import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import { getLinkedAccount } from '@/features/sync/meta';

export async function getActiveLocalDataUserId() {
  const linkedAccount = await getLinkedAccount();
  return linkedAccount?.userId ?? null;
}

export async function assignLegacyLocalDataToUser(userId: string) {
  const [legacyItems, legacyRecords, legacyOperations] = await Promise.all([
    itemLocalRepository.getAll({ includeDeleted: true, userId: null }),
    recordLocalRepository.getAll({ includeDeleted: true, userId: null }),
    syncOperationRepository.getAll({ userId: null }),
  ]);

  for (const item of legacyItems) {
    await itemLocalRepository.upsert({
      ...item,
      userId,
    });
  }

  for (const record of legacyRecords) {
    await recordLocalRepository.upsert({
      ...record,
      userId,
    });
  }

  for (const operation of legacyOperations) {
    await syncOperationRepository.upsert({
      ...operation,
      userId,
    });
  }
}

export async function reconcileActiveLocalDataOwnership() {
  const activeUserId = await getActiveLocalDataUserId();

  if (!activeUserId) {
    return null;
  }

  await assignLegacyLocalDataToUser(activeUserId);
  return activeUserId;
}
