/// <reference lib="webworker" />
/// <reference types="vite/client" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "bimoed-v1";
const RUNTIME_CACHE = "bimoed-runtime";
const IMAGE_CACHE = "bimoed-images";

// Files to cache on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install event - cache essential files
self.addEventListener("install", (event: ExtendableEvent) => {
  console.log("[ServiceWorker] Install event");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener("activate", (event: ExtendableEvent) => {
  console.log("[ServiceWorker] Activate event");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && !cacheName.startsWith("bimoed-")) {
            console.log("[ServiceWorker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first with fallback to cache
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log("[ServiceWorker] Using cached API:", request.url);
              return cached;
            }
            // Return offline page or empty response
            return new Response(
              JSON.stringify({ error: "offline", cached: false }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          });
        })
    );
  }
  // Image requests - cache first, network fallback
  else if (request.destination === "image") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          return (
            cached ||
            fetch(request).then((response) => {
              // Cache successful image responses
              if (response.status === 200) {
                const clonedResponse = response.clone();
                cache.put(request, clonedResponse);
              }
              return response;
            })
          );
        });
      })
    );
  }
  // Static assets - cache first, network fallback
  else if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((response) => {
            if (response.status === 200) {
              const clonedResponse = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clonedResponse);
              });
            }
            return response;
          })
        );
      })
    );
  }
  // Navigation - network first with HTML fallback
  else if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/index.html");
        return cached || new Response("Offline");
      })
    );
  }
  // Default - network first
  else {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response("Offline", { status: 404 });
      })
    );
  }
});

// Handle messages from clients
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  console.log("[ServiceWorker] Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  }
});

// Background sync - sync data when back online
self.addEventListener("sync", (event: any) => {
  console.log("[ServiceWorker] Background sync event:", event.tag);

  if (event.tag === "sync-flood-reports") {
    event.waitUntil(syncFloodReports());
  } else if (event.tag === "sync-sos-alerts") {
    event.waitUntil(syncSOSAlerts());
  }
});

async function syncFloodReports() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();

    for (const request of requests) {
      if (request.url.includes("/api/v1/reports")) {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
      }
    }

    console.log("[ServiceWorker] Flood reports synced");
  } catch (error) {
    console.error("[ServiceWorker] Sync error:", error);
  }
}

async function syncSOSAlerts() {
  try {
    // Attempt to resend any pending SOS alerts
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();

    for (const request of requests) {
      if (request.url.includes("/api/v1/sos")) {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
      }
    }

    console.log("[ServiceWorker] SOS alerts synced");
  } catch (error) {
    console.error("[ServiceWorker] SOS sync error:", error);
  }
}

// Push notifications
self.addEventListener("push", (event: PushEvent) => {
  console.log("[ServiceWorker] Push received");

  const data = event.data?.json() || {};
  const options: any = {
    body: data.body || "BIMOED Alert",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: data.tag || "bimoed-notification",
    vibrate: data.vibrate ? [200, 100, 200] : undefined,
    sound: data.sound ? "/notification-sound.mp3" : undefined,
    priority: data.priority || "high",
    actions: [
      {
        action: "open",
        title: "Open",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "BIMOED Flood Alert", options)
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  console.log("[ServiceWorker] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return (client as WindowClient).focus();
        }
      }
      // Open new window if none found
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })
  );
});

export {};
