// Minimal service worker — enables installability (PWA)
// No caching strategy: the app relies on live WebSocket audio, so offline mode
// would be misleading. This SW exists purely for home-screen install support.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
