import {
  getAllFromStore,
  getByIdFromStore,
  listBySyncStatus,
  updateStoreEntity,
  upsertInStore,
} from '@/lib/local-db/client';
import type { LocalSyncMeta } from '@/lib/local-db/types';

export const syncMetaRepository = {
  getAll() {
    return getAllFromStore<LocalSyncMeta>('syncMeta');
  },
  getById(id: string) {
    return getByIdFromStore<LocalSyncMeta>('syncMeta', id);
  },
  upsert(meta: LocalSyncMeta) {
    return upsertInStore('syncMeta', meta);
  },
  softDelete(id: string, input: { deletedAt: string; version: number }) {
    return updateStoreEntity<LocalSyncMeta>('syncMeta', id, (current) => ({
      ...current,
      deletedAt: input.deletedAt,
      updatedAt: input.deletedAt,
      version: input.version,
      syncStatus: 'pending',
    }));
  },
  listPending() {
    return listBySyncStatus<LocalSyncMeta>('syncMeta', 'pending');
  },
  markSynced(id: string, input: { version?: number; lastSyncedAt: string }) {
    return updateStoreEntity<LocalSyncMeta>('syncMeta', id, (current) => ({
      ...current,
      syncStatus: 'synced',
      version: input.version ?? current.version,
      lastSyncedAt: input.lastSyncedAt,
    }));
  },
  markFailed(id: string) {
    return updateStoreEntity<LocalSyncMeta>('syncMeta', id, (current) => ({
      ...current,
      syncStatus: 'failed',
    }));
  },
};
