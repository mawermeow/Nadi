import { syncMetaRepository } from '@/features/sync/local-meta-repository';
import type { LocalSyncMeta, LocalSyncMetaValue } from '@/lib/local-db/types';

export const DEVICE_META_ID = 'device-id';
export const LAST_PULL_META_ID = 'sync-last-pulled-at';
export const LAST_SYNC_META_ID = 'sync-last-synced-at';
export const SERVER_TIME_META_ID = 'sync-server-time';

type SyncMetaEntry = {
  id: string;
  key: string;
};

function createMetaRecord(
  entry: SyncMetaEntry,
  value: LocalSyncMetaValue,
  current: LocalSyncMeta | null,
): LocalSyncMeta {
  const now = new Date().toISOString();

  return {
    id: entry.id,
    key: entry.key,
    value,
    syncStatus: 'synced',
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
    version: (current?.version ?? 0) + 1,
    lastSyncedAt: now,
    deviceId:
      typeof current?.deviceId === 'string' && current.deviceId.length > 0
        ? current.deviceId
        : null,
  };
}

export async function getSyncMetaValue<T extends LocalSyncMetaValue>(id: string) {
  const meta = await syncMetaRepository.getById(id);
  return (meta?.value as T | undefined) ?? null;
}

export async function setSyncMetaValue(
  entry: SyncMetaEntry,
  value: LocalSyncMetaValue,
) {
  const current = await syncMetaRepository.getById(entry.id);
  const record = createMetaRecord(entry, value, current ?? null);
  await syncMetaRepository.upsert(record);
  return record;
}

export async function setLastPulledAt(value: string) {
  return setSyncMetaValue(
    { id: LAST_PULL_META_ID, key: 'lastPulledAt' },
    value,
  );
}

export async function getLastPulledAt() {
  const value = await getSyncMetaValue<string>(LAST_PULL_META_ID);
  return typeof value === 'string' ? value : null;
}

export async function setLastSyncedAt(value: string) {
  return setSyncMetaValue(
    { id: LAST_SYNC_META_ID, key: 'lastSyncedAt' },
    value,
  );
}

export async function getLastSyncedAt() {
  const value = await getSyncMetaValue<string>(LAST_SYNC_META_ID);
  return typeof value === 'string' ? value : null;
}

export async function setServerTime(value: string) {
  return setSyncMetaValue(
    { id: SERVER_TIME_META_ID, key: 'serverTime' },
    value,
  );
}

export async function getServerTime() {
  const value = await getSyncMetaValue<string>(SERVER_TIME_META_ID);
  return typeof value === 'string' ? value : null;
}
