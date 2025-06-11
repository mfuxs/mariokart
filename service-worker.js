// Service Worker (Verbessertes Caching & Logging)
const CACHE_NAME = 'mk-elo-cache-v3'; // Cache-Version erhöht!
// Nur essenzielle lokale Dateien cachen, mit './' präzisiert
const urlsToCache = [
  './', // Wichtig für den Startpunkt
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
  // Externe URLs (CDNs) werden bewusst NICHT gecached, um Komplexität zu vermeiden
];

// Installieren: Cache öffnen und Dateien hinzufügen
self.addEventListener('install', event => {
  console.log(`[SW ${CACHE_NAME}] Installiere...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW ${CACHE_NAME}] Cache geöffnet, füge Kern-Assets hinzu:`, urlsToCache);
        // Wichtig: addAll schlägt fehl, wenn auch nur eine URL nicht erreichbar ist!
        return cache.addAll(urlsToCache);
      })
      .then(() => {
          console.log(`[SW ${CACHE_NAME}] Alle Assets erfolgreich gecached.`);
          return self.skipWaiting(); // Aktiviere neuen SW sofort
      })
      .catch(err => console.error(`[SW ${CACHE_NAME}] Caching fehlgeschlagen während Installation:`, err))
  );
});

// Aktivieren: Alte Caches löschen
self.addEventListener('activate', event => {
  console.log(`[SW ${CACHE_NAME}] Aktiviere...`);
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`[SW ${CACHE_NAME}] Lösche alten Cache:`, cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log(`[SW ${CACHE_NAME}] Clients übernommen.`);
        return self.clients.claim(); // Übernehme Kontrolle sofort
    })
  );
});

// Fetch: Anfragen abfangen und aus Cache bedienen (Cache First für gecachte URLs)
self.addEventListener('fetch', event => {
  // Nur GET-Anfragen behandeln
  if (event.request.method !== 'GET') {
    return;
  }

  // Nur Anfragen für Ressourcen im selben Ursprung behandeln
  if (!event.request.url.startsWith(self.location.origin)) {
      // console.log(`[SW ${CACHE_NAME}] Ignoriere externe Anfrage:`, event.request.url);
      return;
  }

  // Cache-first Strategie
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Gebe gecachte Antwort zurück, falls vorhanden
        if (cachedResponse) {
          // console.log(`[SW ${CACHE_NAME}] Bediene aus Cache:`, event.request.url);
          return cachedResponse;
        }

        // Ansonsten: Vom Netzwerk fetchen (für lokale Dateien, die nicht im Cache sind?)
        // console.log(`[SW ${CACHE_NAME}] Nicht im Cache, fetche vom Netzwerk:`, event.request.url);
        return fetch(event.request).then(networkResponse => {
            // Hier nicht mehr dynamisch cachen, um es einfach zu halten.
            return networkResponse;
        }).catch(error => {
            console.error(`[SW ${CACHE_NAME}] Netzwerk-Fetch fehlgeschlagen für ${event.request.url}:`, error);
            // Fehler weitergeben, damit Browser Standardfehler zeigt
            throw error;
        });
      })
  );
});
