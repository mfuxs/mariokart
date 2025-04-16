// Service Worker (Vereinfachtes Caching)
const CACHE_NAME = 'mk-elo-cache-v2'; // Cache-Version erhöhen bei Änderungen!
// Nur essenzielle lokale Dateien cachen
const urlsToCache = [
  './', // Alias für index.html im selben Verzeichnis
  'index.html',
  'manifest.json',
  'icons/icon-192x192.png', // Beispiel-Icon Pfade
  'icons/icon-512x512.png'
];

// Installieren: Cache öffnen und Dateien hinzufügen
self.addEventListener('install', event => {
  console.log('[SW] Installiere v2...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache geöffnet, füge Kern-Assets hinzu:', urlsToCache);
        return cache.addAll(urlsToCache); // Fügt alle lokalen Dateien hinzu
      })
      .then(() => self.skipWaiting()) // Aktiviere neuen SW sofort
      .catch(err => console.error('[SW] Caching fehlgeschlagen während Installation:', err))
  );
});

// Aktivieren: Alte Caches löschen
self.addEventListener('activate', event => {
  console.log('[SW] Aktiviere v2...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Lösche alten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Übernehme Kontrolle sofort
  );
});

// Fetch: Anfragen abfangen und aus Cache bedienen (Cache First für gecachte URLs)
self.addEventListener('fetch', event => {
  // Nur GET-Anfragen behandeln
  if (event.request.method !== 'GET') {
    return;
  }

  // Nur Anfragen für Ressourcen im selben Ursprung (keine CDNs etc.) abfangen
  if (!event.request.url.startsWith(self.location.origin)) {
      // console.log('[SW] Ignoriere externe Anfrage:', event.request.url);
      return;
  }

  // Cache-first Strategie
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Gebe gecachte Antwort zurück, falls vorhanden
        if (cachedResponse) {
          // console.log('[SW] Bediene aus Cache:', event.request.url);
          return cachedResponse;
        }

        // Ansonsten: Vom Netzwerk fetchen
        // console.log('[SW] Fetche vom Netzwerk:', event.request.url);
        return fetch(event.request).then(networkResponse => {
            // WICHTIG: Hier NICHT dynamisch cachen, um Fehler zu vermeiden.
            // Nur die bei 'install' definierten URLs sind im Cache.
            return networkResponse;
        }).catch(error => {
            console.error('[SW] Netzwerk-Fetch fehlgeschlagen:', error);
            // Optional: Fallback auf eine Offline-Seite/Ressource
            // return caches.match('/offline.html');
        });
      })
  );
});
