const CACHE_NAME = 'weather-station-v1';
const urlsToCache = [
  '/',
  '/static/index.html',
  '/static/styles.css',
  '/static/app.js',
  '/static/geofence.js',
  '/static/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    // For API calls, don't use cache, fetch directly
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
