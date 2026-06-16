import {
  getAllFromStore,
  getByIdFromStore,
  listBySyncStatus,
  updateStoreEntity,
  upsertInStore,
} from '@/lib/local-db/client';
import type { LocalSyncOperation } from '@/lib/local-db/types';

export const syncOperationRepository = {
  getAll() {
    return getAllFromStore<LocalSyncOperation>('syncOperations');
  },
  getById(id: string) {
    return getByIdFromStore<LocalSyncOperation>('syncOperations', id);
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
  listPending() {
    return listBySyncStatus<LocalSyncOperation>('syncOperations', 'pending');
  },
  listFailed() {
    return listBySyncStatus<LocalSyncOperation>('syncOperations', 'failed');
  },
  listConflicts() {
    return listBySyncStatus<LocalSyncOperation>('syncOperations', 'conflict');
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
  requeue(id: string) {
    return updateStoreEntity<LocalSyncOperation>('syncOperations', id, (current) => ({
      ...current,
      status: 'pending',
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
      lastError: null,
    }));
  },
};
