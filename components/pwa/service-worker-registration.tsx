'use client';

import { useEffect, useState } from 'react';

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    let mounted = true;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      if (!mounted) {
        return;
      }

      if (hadController) {
        setUpdateReady(true);
        return;
      }

      hadController = true;
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;

          if (!installing) {
            return;
          }

          installing.addEventListener('statechange', () => {
            if (
              mounted &&
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setUpdateReady(true);
            }
          });
        });
      } catch (error) {
        console.error('Service worker registration failed.', error);
      }
    }

    void registerServiceWorker();

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );
    };
  }, []);

  if (!updateReady) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-sm rounded-3xl border border-[var(--line)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-sm font-medium text-[var(--foreground)]">
        已下載新版 App。重新整理後會切換到最新版本。
      </p>
      <button
        type="button"
        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
        onClick={() => window.location.reload()}
      >
        立即更新
      </button>
    </div>
  );
}
