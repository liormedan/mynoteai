// mynoteai service worker: opens the app without a network.
//
// Page data never passes through here: Firestore keeps its own offline copy
// in IndexedDB. This worker only keeps the app itself — HTML, scripts,
// styles, fonts and icons — so a reload or a cold start works offline.
//
//   /_next/static/* with an immutable Cache-Control: cache first (hashed names)
//   everything else from this origin: network first, the cached copy offline
//   sign-in and sign-out: never cached

const CACHE = "mynoteai-v1";
const NEVER = [/^\/api\//, /^\/login(\/|$)/];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

const immutable = (response) =>
  /immutable/.test(response.headers.get("cache-control") ?? "");

// Hashed build files never change, so a cached copy is always right. The
// dev server's chunks keep their names between edits: those go network first.
async function staticAsset(request) {
  const cached = await caches.match(request);
  if (cached && immutable(cached)) return cached;
  return networkFirst(request);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // A redirect to /login means the session ended; do not keep it.
    if (response.ok && !response.redirected) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // A page never opened before: fall back to the home page shell.
    if (request.mode === "navigate") {
      const home = await caches.match("/");
      if (home) return home;
    }
    throw error;
  }
}
