import {
  getAllFromStore,
  getByIdFromStore,
  listBySyncStatus,
  updateStoreEntity,
  upsertInStore,
} from '@/lib/local-db/client';
import type { LocalItem } from '@/lib/local-db/types';

export const itemLocalRepository = {
  async getAll(options?: { includeDeleted?: boolean }) {
    const values = await getAllFromStore<LocalItem>('items');

    if (options?.includeDeleted) {
      return values;
    }

    return values.filter((value) => value.deletedAt === null);
  },
  getById(id: string) {
    return getByIdFromStore<LocalItem>('items', id);
  },
  upsert(item: LocalItem) {
    return upsertInStore('items', item);
  },
  softDelete(id: string, input: { deletedAt: string; version: number }) {
    return updateStoreEntity<LocalItem>('items', id, (current) => ({
      ...current,
      deletedAt: input.deletedAt,
      updatedAt: input.deletedAt,
      version: input.version,
      syncStatus: 'pending',
    }));
  },
  listPending() {
    return listBySyncStatus<LocalItem>('items', 'pending');
  },
  markSynced(id: string, input: { version?: number; lastSyncedAt: string }) {
    return updateStoreEntity<LocalItem>('items', id, (current) => ({
      ...current,
      syncStatus: 'synced',
      version: input.version ?? current.version,
      lastSyncedAt: input.lastSyncedAt,
    }));
  },
  markFailed(id: string) {
    return updateStoreEntity<LocalItem>('items', id, (current) => ({
      ...current,
      syncStatus: 'failed',
    }));
  },
  markConflict(id: string, input?: { lastSyncedAt?: string }) {
    return updateStoreEntity<LocalItem>('items', id, (current) => ({
      ...current,
      syncStatus: 'conflict',
      lastSyncedAt: input?.lastSyncedAt ?? current.lastSyncedAt,
    }));
  },
};
