import { setSyncState } from '@/features/sync/state';

type OnlineHandler = () => void | Promise<void>;

let stopListening: (() => void) | null = null;

export function isNavigatorOnline() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function startSyncNetworkMonitor(onOnline: OnlineHandler) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (stopListening) {
    return stopListening;
  }

  const handleOnline = () => {
    setSyncState({
      status: 'idle',
      lastError: null,
    });
    void onOnline();
  };

  const handleOffline = () => {
    setSyncState({
      status: 'offline',
    });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  stopListening = () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    stopListening = null;
  };

  return stopListening;
}
