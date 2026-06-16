import { syncMetaRepository } from '@/features/sync/local-meta-repository';
import type { LocalSyncMeta, LocalSyncMetaValue } from '@/lib/local-db/types';

export const DEVICE_META_ID = 'device-id';
export const SERVER_TIME_META_ID = 'sync-server-time';
export const LINKED_ACCOUNT_META_ID = 'linked-account';

type LinkedAccountMeta = {
  userId: string;
  email: string;
  linkedAt: string;
};

function getLastPullMetaId(userId: string) {
  return `sync-last-pulled-at:${userId}`;
}

function getLastSyncMetaId(userId: string) {
  return `sync-last-synced-at:${userId}`;
}

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
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  return setSyncMetaValue(
    {
      id: getLastPullMetaId(linkedAccount.userId),
      key: `lastPulledAt:${linkedAccount.userId}`,
    },
    value,
  );
}

export async function getLastPulledAt() {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  const value = await getSyncMetaValue<string>(
    getLastPullMetaId(linkedAccount.userId),
  );
  return typeof value === 'string' ? value : null;
}

export async function setLastSyncedAt(value: string) {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  return setSyncMetaValue(
    {
      id: getLastSyncMetaId(linkedAccount.userId),
      key: `lastSyncedAt:${linkedAccount.userId}`,
    },
    value,
  );
}

export async function getLastSyncedAt() {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  const value = await getSyncMetaValue<string>(
    getLastSyncMetaId(linkedAccount.userId),
  );
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

export async function setLinkedAccount(value: LinkedAccountMeta) {
  return setSyncMetaValue(
    { id: LINKED_ACCOUNT_META_ID, key: 'linkedAccount' },
    value,
  );
}

export async function getLinkedAccount() {
  const value = await getSyncMetaValue<LinkedAccountMeta>(LINKED_ACCOUNT_META_ID);

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.userId === 'string' &&
    typeof value.email === 'string' &&
    typeof value.linkedAt === 'string'
  ) {
    return value;
  }

  return null;
}

export async function clearLinkedAccount() {
  return setSyncMetaValue(
    { id: LINKED_ACCOUNT_META_ID, key: 'linkedAccount' },
    null,
  );
}
