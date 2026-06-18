import {
  deleteFromStore,
  getAllFromStore,
  getByIdFromStore,
  listBySyncStatus,
  updateStoreEntity,
  upsertInStore,
} from '@/lib/local-db/client';
import type { LocalSyncOperation } from '@/lib/local-db/types';

export const syncOperationRepository = {
  async getAll(options?: { userId?: string | null }) {
    const values = await getAllFromStore<LocalSyncOperation>('syncOperations');

    if (options && 'userId' in options) {
      return values.filter((value) =>
        options.userId === null ? value.userId == null : value.userId === options.userId,
      );
    }

    return values;
  },
  getById(id: string) {
    return getByIdFromStore<LocalSyncOperation>('syncOperations', id);
  },
  delete(id: string) {
    return deleteFromStore('syncOperations', id);
  },
  upsert(operation: LocalSyncOperation) {
    return upsertInStore('syncOperations', operation);
  },
  softDelete(id: string, input: { deletedAt: string; version: number }) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      deletedAt: input.deletedAt,
      updatedAt: input.deletedAt,
      version: input.version,
      status: 'pending',
      syncStatus: 'pending',
    }));
  },
  listPending(userId?: string | null) {
    return listBySyncStatus<LocalSyncOperation>('syncOperations', 'pending', userId);
  },
  listFailed(userId?: string | null) {
    return listBySyncStatus<LocalSyncOperation>('syncOperations', 'failed', userId);
  },
  listConflicts(userId?: string | null) {
    return listBySyncStatus<LocalSyncOperation>('syncOperations', 'conflict', userId);
  },
  markSynced(id: string, input: { version?: number; lastSyncedAt: string }) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      status: 'synced',
      syncStatus: 'synced',
      version: input.version ?? current.version,
      lastSyncedAt: input.lastSyncedAt,
      lastError: null,
    }));
  },
  markFailed(id: string, input?: { lastError?: string }) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      status: 'failed',
      syncStatus: 'failed',
      updatedAt: new Date().toISOString(),
      retryCount: current.retryCount + 1,
      lastError: input?.lastError ?? current.lastError,
    }));
  },
  markConflict(id: string, input?: { lastError?: string; lastSyncedAt?: string }) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      status: 'conflict',
      syncStatus: 'conflict',
      updatedAt: new Date().toISOString(),
      lastSyncedAt: input?.lastSyncedAt ?? current.lastSyncedAt,
      lastError: input?.lastError ?? current.lastError,
    }));
  },
  setConflictSnapshot(
    id: string,
    input: NonNullable<LocalSyncOperation['conflictSnapshot']>,
  ) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      conflictSnapshot: input,
      updatedAt: new Date().toISOString(),
    }));
  },
  resolveConflict(
    id: string,
    input: NonNullable<LocalSyncOperation['resolutionMeta']>,
  ) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      resolutionMeta: input,
      conflictSnapshot: current.conflictSnapshot ?? null,
      updatedAt: new Date().toISOString(),
    }));
  },
  updateBaseVersion(id: string, baseVersion: number) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      baseVersion,
      updatedAt: new Date().toISOString(),
    }));
  },
  requeue(id: string) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      status: 'pending',
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
      lastError: null,
      conflictSnapshot: current.conflictSnapshot ?? null,
    }));
  },
};
