import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startSyncNetworkMonitor } from '@/features/sync/network';
import { getSyncState, resetSyncState } from '@/features/sync/state';

describe('sync network monitor', () => {
  const listeners = new Map<string, EventListener>();
  let originalWindow: typeof globalThis.window | undefined;
  let originalNavigator: typeof globalThis.navigator | undefined;

  beforeEach(() => {
    resetSyncState();
    listeners.clear();
    originalWindow = globalThis.window;
    originalNavigator = globalThis.navigator;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        addEventListener: vi.fn((event: string, listener: EventListener) => {
          listeners.set(event, listener);
        }),
        removeEventListener: vi.fn((event: string) => {
          listeners.delete(event);
        }),
      },
    });

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        onLine: true,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('triggers runSync when online event fires', async () => {
    const runSync = vi.fn().mockResolvedValue(undefined);
    const stop = startSyncNetworkMonitor(runSync);

    const listener = listeners.get('online');
    expect(listener).toBeTypeOf('function');

    listener?.(new Event('online'));
    await Promise.resolve();

    expect(runSync).toHaveBeenCalledTimes(1);
    stop();
  });

  it('switches state to offline when offline event fires', () => {
    const runSync = vi.fn().mockResolvedValue(undefined);
    const stop = startSyncNetworkMonitor(runSync);

    const listener = listeners.get('offline');
    expect(listener).toBeTypeOf('function');

    listener?.(new Event('offline'));

    expect(getSyncState().status).toBe('offline');
    stop();
  });
});
