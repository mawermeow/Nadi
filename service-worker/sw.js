import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const appShellHandler = createHandlerBoundToURL('/offline-shell');

registerRoute(
  new NavigationRoute(async ({ event, request, url }) => {
    try {
      return await fetch(event.request);
    } catch {
      return appShellHandler({ event, request, url });
    }
  }),
);

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['font', 'image', 'manifest', 'script', 'style', 'worker'].includes(
      request.destination,
    ),
  new CacheFirst({
    cacheName: 'nadi-static-runtime-v1',
  }),
);
