import {
  getAllFromStore,
  getByIdFromStore,
  listBySyncStatus,
  updateStoreEntity,
  upsertInStore,
} from '@/lib/local-db/client';
import type { LocalRecord } from '@/lib/local-db/types';

export const recordLocalRepository = {
  async getAll(options?: { includeDeleted?: boolean; userId?: string | null }) {
    const values = await getAllFromStore<LocalRecord>('records');
    const scopedValues =
      options && 'userId' in options
        ? values.filter((value) =>
            options.userId === null ? value.userId == null : value.userId === options.userId,
          )
        : values;

    if (options?.includeDeleted) {
      return scopedValues;
    }

    return scopedValues.filter((value) => value.deletedAt === null);
  },
  getById(id: string) {
    return getByIdFromStore<LocalRecord>('records', id);
  },
  upsert(record: LocalRecord) {
    return upsertInStore('records', record);
  },
  softDelete(id: string, input: { deletedAt: string; version: number }) {
    return updateStoreEntity<LocalRecord>('records', id, (current) => ({
      ...current,
      deletedAt: input.deletedAt,
      updatedAt: input.deletedAt,
      version: input.version,
      syncStatus: 'pending',
    }));
  },
  listPending(userId?: string | null) {
    return listBySyncStatus<LocalRecord>('records', 'pending', userId);
  },
  markSynced(id: string, input: { version?: number; lastSyncedAt: string }) {
    return updateStoreEntity<LocalRecord>('records', id, (current) => ({
      ...current,
      syncStatus: 'synced',
      version: input.version ?? current.version,
      lastSyncedAt: input.lastSyncedAt,
    }));
  },
  markFailed(id: string) {
    return updateStoreEntity<LocalRecord>('records', id, (current) => ({
      ...current,
      syncStatus: 'failed',
    }));
  },
  markConflict(id: string, input?: { lastSyncedAt?: string }) {
    return updateStoreEntity<LocalRecord>('records', id, (current) => ({
      ...current,
      syncStatus: 'conflict',
      lastSyncedAt: input?.lastSyncedAt ?? current.lastSyncedAt,
    }));
  },
};
