/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

// Live Janus API / SSE on other localhost ports must never be served from cache.
registerRoute(
  ({ url }) =>
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
    url.origin !== self.location.origin,
  new NetworkOnly()
)

registerRoute(
  ({ request, url }) => request.destination === 'image' || url.pathname.endsWith('.svg'),
  new CacheFirst({
    cacheName: 'janus-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 })
    ]
  })
)

registerRoute(
  ({ url }) =>
    url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com'),
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
)

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['script', 'style', 'font', 'worker'].includes(request.destination),
  new CacheFirst({
    cacheName: 'janus-static',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 })
    ]
  })
)

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.skipWaiting()
