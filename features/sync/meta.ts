import { syncMetaRepository } from '@/features/sync/local-meta-repository';
import type { LocalSyncMeta, LocalSyncMetaValue } from '@/lib/local-db/types';

export const DEVICE_META_ID = 'device-id';
export const SERVER_TIME_META_ID = 'sync-server-time';
export const LINKED_ACCOUNT_META_ID = 'linked-account';
export const SYNC_PULL_CHECKPOINT_META_PREFIX = 'sync-pull-checkpoint';
export const SYNC_DEVICE_SESSION_META_PREFIX = 'sync-device-session';
export const SYNC_DIAGNOSTICS_META_PREFIX = 'sync-diagnostics';

type LinkedAccountMeta = {
  userId: string;
  email: string;
  linkedAt: string;
};

type StoredPullCheckpoint = {
  since: string | null;
  until: string;
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  returnedCount: number;
};

type StoredDeviceSession = {
  deviceId: string;
  lastSeenAt: string;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastCheckpointAt: string | null;
  lastCheckpointCursor: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'synced' | 'conflict' | 'failed';
  lastErrorCode: string | null;
  lastErrorAt: string | null;
};

type StoredSyncDiagnosticEvent = {
  id: string;
  type: 'push' | 'pull' | 'conflict' | 'failure';
  createdAt: string;
  message: string;
  metadata: Record<string, unknown>;
};

function getLastPullMetaId(userId: string) {
  return `sync-last-pulled-at:${userId}`;
}

function getLastSyncMetaId(userId: string) {
  return `sync-last-synced-at:${userId}`;
}

function getPullCheckpointMetaId(userId: string) {
  return `${SYNC_PULL_CHECKPOINT_META_PREFIX}:${userId}`;
}

function getDeviceSessionMetaId(userId: string) {
  return `${SYNC_DEVICE_SESSION_META_PREFIX}:${userId}`;
}

function getSyncDiagnosticsMetaId(userId: string) {
  return `${SYNC_DIAGNOSTICS_META_PREFIX}:${userId}`;
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

export async function setPullCheckpoint(value: StoredPullCheckpoint) {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  return setSyncMetaValue(
    {
      id: getPullCheckpointMetaId(linkedAccount.userId),
      key: `pullCheckpoint:${linkedAccount.userId}`,
    },
    value,
  );
}

export async function getPullCheckpoint() {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  const value = await getSyncMetaValue<StoredPullCheckpoint>(
    getPullCheckpointMetaId(linkedAccount.userId),
  );

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.until === 'string' &&
    typeof value.hasMore === 'boolean' &&
    typeof value.limit === 'number' &&
    typeof value.returnedCount === 'number'
  ) {
    return {
      since: typeof value.since === 'string' ? value.since : null,
      until: value.until,
      nextCursor:
        typeof value.nextCursor === 'string' ? value.nextCursor : null,
      hasMore: value.hasMore,
      limit: value.limit,
      returnedCount: value.returnedCount,
    };
  }

  return null;
}

export async function clearPullCheckpoint() {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  return setSyncMetaValue(
    {
      id: getPullCheckpointMetaId(linkedAccount.userId),
      key: `pullCheckpoint:${linkedAccount.userId}`,
    },
    null,
  );
}

export async function setStoredDeviceSession(value: StoredDeviceSession) {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  return setSyncMetaValue(
    {
      id: getDeviceSessionMetaId(linkedAccount.userId),
      key: `deviceSession:${linkedAccount.userId}`,
    },
    value,
  );
}

export async function getStoredDeviceSession() {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  const value = await getSyncMetaValue<StoredDeviceSession>(
    getDeviceSessionMetaId(linkedAccount.userId),
  );

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.deviceId === 'string' &&
    typeof value.lastSeenAt === 'string' &&
    typeof value.lastSyncStatus === 'string'
  ) {
    return value;
  }

  return null;
}

export async function appendSyncDiagnosticEvent(
  event: StoredSyncDiagnosticEvent,
) {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return null;
  }

  const metaId = getSyncDiagnosticsMetaId(linkedAccount.userId);
  const current =
    (await getSyncMetaValue<{ events?: StoredSyncDiagnosticEvent[] }>(metaId)) ??
    {};
  const existingEvents = Array.isArray(current.events) ? current.events : [];

  return setSyncMetaValue(
    {
      id: metaId,
      key: `diagnostics:${linkedAccount.userId}`,
    },
    {
      events: [event, ...existingEvents].slice(0, 20),
    },
  );
}

export async function getSyncDiagnosticsEvents() {
  const linkedAccount = await getLinkedAccount();

  if (!linkedAccount) {
    return [];
  }

  const metaId = getSyncDiagnosticsMetaId(linkedAccount.userId);
  const value = await getSyncMetaValue<{ events?: StoredSyncDiagnosticEvent[] }>(
    metaId,
  );

  return Array.isArray(value?.events) ? value.events : [];
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
