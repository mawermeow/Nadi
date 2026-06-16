export type SyncLifecycleStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'conflict';

export type SyncState = {
  status: SyncLifecycleStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastError: string | null;
};

type SyncStateListener = (state: SyncState) => void;

let syncState: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  lastError: null,
};

const listeners = new Set<SyncStateListener>();

function emitSyncState() {
  for (const listener of listeners) {
    listener(syncState);
  }
}

export function getSyncState() {
  return syncState;
}

export function subscribeSyncState(listener: SyncStateListener) {
  listeners.add(listener);
  listener(syncState);

  return () => {
    listeners.delete(listener);
  };
}

export function setSyncState(nextState: Partial<SyncState>) {
  syncState = {
    ...syncState,
    ...nextState,
  };
  emitSyncState();
  return syncState;
}

export function resetSyncState() {
  syncState = {
    status: 'idle',
    lastSyncAt: null,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastError: null,
  };
  emitSyncState();
}
