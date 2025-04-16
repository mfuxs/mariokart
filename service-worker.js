// Service Worker für einfaches Caching (Offline-Fähigkeit)

const CACHE_NAME = 'mk-elo-cache-v1';
// Wichtige Dateien, die immer gecached werden sollen
const urlsToCache = [
  '/', // Die Startseite (index.html)
  '/index.html',
  '/manifest.json',
  // Optional: CDN-Skripte cachen (kann Bandbreite sparen, aber Vorsicht bei Updates)
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://cdn.tailwindcss.com'
  // Füge hier Pfade zu deinen Icons hinzu, wenn du sie gecached haben willst
  // z.B. '/icons/icon-192x192.png', '/icons/icon-512x512.png'
];

// Installation: Cache öffnen und Dateien hinzufügen
self.addEventListener('install', event => {
  console.log('[Service Worker] Installiere...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache geöffnet, füge Kern-Assets hinzu:', urlsToCache);
        // Wichtig: fetch für CDN-Ressourcen braucht ggf. spezielle Behandlung
        // Hier ein einfacher Ansatz, der bei CORS-Problemen fehlschlagen kann
        const cachePromises = urlsToCache.map(urlToCache => {
            // Erstelle einen Request ohne CORS-Einschränkungen für externe Ressourcen
            const request = new Request(urlToCache, { mode: 'no-cors' });
            return fetch(request).then(response => {
                if (!response.ok && response.status !== 0) { // Status 0 bei opaque responses
                    console.warn(`[Service Worker] Konnte ${urlToCache} nicht fetchen, Status: ${response.status}`);
                    // Nicht cachen, wenn Fehler
                    return Promise.resolve(); // Fortfahren ohne Fehler
                }
                // Nur cachen, wenn erfolgreich gefetched
                 console.log(`[Service Worker] Cache ${urlToCache}`);
                return cache.put(urlToCache, response);
            }).catch(err => {
                 console.warn(`[Service Worker] Fetch-Fehler für ${urlToCache}: ${err}`);
                 // Fortfahren ohne Fehler
                 return Promise.resolve();
            });
        });
         // Füge lokale Ressourcen hinzu (ohne no-cors)
         cachePromises.push(cache.addAll(['/', '/index.html', '/manifest.json']));

        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting()) // Aktiviere neuen SW sofort
  );
});

// Aktivierung: Alte Caches löschen (optional, aber empfohlen)
self.addEventListener('activate', event => {
  console.log('[Service Worker] Aktiviere...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Lösche alten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Übernehme Kontrolle sofort
  );
});

// Fetch: Anfragen abfangen und aus Cache bedienen (Cache First für gecachte URLs)
self.addEventListener('fetch', event => {
  // Prüfe, ob die angefragte URL im Cache sein sollte
  const requestUrl = new URL(event.request.url);
  // Prüfe, ob die URL in urlsToCache ist ODER ob es die Start-URL ist
  const shouldCache = urlsToCache.includes(requestUrl.pathname) || urlsToCache.includes(requestUrl.href) || requestUrl.pathname === '/';

  if (shouldCache) {
      // Cache First Strategie
      event.respondWith(
          caches.match(event.request)
              .then(response => {
                  if (response) {
                      // console.log('[Service Worker] Bediene aus Cache:', event.request.url);
                      return response; // Aus Cache bedienen
                  }
                  // console.log('[Service Worker] Nicht im Cache, fetche vom Netzwerk:', event.request.url);
                  // Wichtig: Original-Request klonen, da er nur einmal gelesen werden kann
                  const fetchRequest = event.request.clone();
                  return fetch(fetchRequest).then(
                      networkResponse => {
                          // Prüfen ob gültige Antwort vom Netzwerk kam
                          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                              // Nur gültige 'basic' (gleiche Origin) Antworten cachen, um Fehler zu vermeiden
                              // CDN-Ressourcen werden bei 'install' gecached (mit no-cors)
                              return networkResponse;
                          }

                          // Antwort klonen, da sie nur einmal gelesen werden kann
                          const responseToCache = networkResponse.clone();

                          caches.open(CACHE_NAME)
                              .then(cache => {
                                  // console.log('[Service Worker] Cache Netzwerk-Antwort für:', event.request.url);
                                  cache.put(event.request, responseToCache);
                              });

                          return networkResponse; // Netzwerk-Antwort zurückgeben
                      }
                  ).catch(error => {
                      console.error('[Service Worker] Fetch fehlgeschlagen:', error);
                      // Optional: Fallback auf eine Offline-Seite, falls gecached
                      // return caches.match('/offline.html');
                  });
              })
      );
  } else {
      // Wenn nicht im Cache vorgesehen, einfach normal fetchen
      // console.log('[Service Worker] Ignoriere Request (nicht im Cache vorgesehen):', event.request.url);
      event.respondWith(fetch(event.request));
  }
});
