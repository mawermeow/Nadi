import { DEVICE_META_ID } from '@/features/sync/meta';
import { syncMetaRepository } from '@/features/sync/local-meta-repository';

export async function getOrCreateDeviceId() {
  const existingMeta = await syncMetaRepository.getById(DEVICE_META_ID);

  if (typeof existingMeta?.value === 'string' && existingMeta.value.length > 0) {
    return existingMeta.value;
  }

  const now = new Date().toISOString();
  const deviceId = crypto.randomUUID();

  await syncMetaRepository.upsert({
    id: DEVICE_META_ID,
    key: 'deviceId',
    value: deviceId,
    syncStatus: 'synced',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    lastSyncedAt: null,
    deviceId,
  });

  return deviceId;
}
