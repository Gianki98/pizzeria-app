// Service Worker per Gestionale Pizzeria
// Versione cache - incrementa quando aggiorni i file
const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `pizzeria-cache-${CACHE_VERSION}`;

// File da mettere in cache per funzionamento offline
const STATIC_CACHE_URLS = [
  "./pizzeria.html",
  "./pizzeria.css", 
  "./pizzeria.js",
  "./api_client.js",
  "./manifest.json",
  "./logo192.png",
  "./logo512.png",
];

// File da non cachare mai (API dinamiche)
const NEVER_CACHE_URLS = ["/api/", "/socket.io/", "/websocket"];

// Installazione del Service Worker
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Installazione in corso...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Service Worker: Cache aperta, scaricamento file...");
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log("✅ Service Worker: Installazione completata");
        // Forza l'attivazione immediata
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("❌ Service Worker: Errore installazione:", error);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker: Attivazione in corso...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Rimuovi cache vecchie
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("🗑️ Service Worker: Rimozione cache vecchia:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        console.log("✅ Service Worker: Attivato e pronto");
        // Prendi controllo di tutte le pagine
        return self.clients.claim();
      })
  );
});

// Intercettazione delle richieste di rete
self.addEventListener("fetch", (event) => {
  const requestURL = new URL(event.request.url);

  // Non cachare mai certe URL (API, WebSocket, ecc.)
  const shouldNeverCache = NEVER_CACHE_URLS.some((url) =>
    requestURL.pathname.startsWith(url)
  );

  if (shouldNeverCache) {
    // Per le API, prova sempre la rete
    event.respondWith(
      fetch(event.request).catch(() => {
        // Se offline, restituisci una risposta di fallback
        return new Response(
          JSON.stringify({
            error: "Offline",
            message: "Connessione non disponibile",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // Strategia Cache First per file statici
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log("📋 Service Worker: Servendo da cache:", event.request.url);
        return cachedResponse;
      }

      // Se non in cache, scarica dalla rete
      console.log(
        "🌐 Service Worker: Scaricando dalla rete:",
        event.request.url
      );
      return fetch(event.request)
        .then((response) => {
          // Se la risposta è valida, aggiungila alla cache
          if (response.status === 200) {
            const responseClone = response.clone();

            // Controlla lo schema dell'URL della richiesta PRIMA di tentare il put
            if (!event.request.url.startsWith("chrome-extension://")) {
              caches.open(CACHE_NAME).then((cache) => {
                // Questa è la riga che causava l'errore (la tua ex riga 116)
                cache.put(event.request, responseClone);
              });
            } else {
              // Opzionale: puoi loggare che hai saltato una risorsa chrome-extension
              // console.log('Skipping caching for chrome-extension URL:', event.request.url);
            }
          }
          return response;
        })
        .catch((error) => {
          console.error("❌ Service Worker: Errore rete:", error);

          // Pagina di fallback per navigazione offline
          if (event.request.destination === "document") {
            return caches.match("/pizzeria.html");
          }

          // Per altre risorse, restituisci errore
          return new Response("Risorsa non disponibile offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});

// Gestione messaggi dal client (app principale)
self.addEventListener("message", (event) => {
  console.log("💬 Service Worker: Messaggio ricevuto:", event.data);

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }

  if (event.data.type === "CLEAR_CACHE") {
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
      .then(() => {
        event.ports[0].postMessage({ success: true });
      });
  }
});

// Gestione notifiche push (per future implementazioni)
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log("🔔 Service Worker: Notifica push ricevuta:", data);

    const options = {
      body: data.body || "Nuovo ordine ricevuto!",
      icon: "/logo192.png",
      badge: "/logo192.png",
      vibrate: [200, 100, 200],
      data: data,
      actions: [
        {
          action: "view",
          title: "Visualizza",
          icon: "/logo192.png",
        },
        {
          action: "close",
          title: "Chiudi",
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Pizzeria", options)
    );
  }
});

// Gestione click su notifiche
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Service Worker: Click su notifica:", event.notification.data);

  event.notification.close();

  if (event.action === "view") {
    event.waitUntil(clients.openWindow("/pizzeria.html"));
  }
});

console.log("🎯 Service Worker: Registrato e in ascolto...");
