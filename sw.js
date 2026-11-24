// Babybuch PWA · Offline-Speicher der App-Dateien (Service Worker)
// Die App läuft danach auch ohne Internet. Daten liegen NICHT hier, sondern in IndexedDB.
// Neue Version ausliefern: CACHE-Namen erhöhen (gleich wie js/kern/version.js).

const CACHE = "babybuch-0.4.1";
const DATEIEN = [
  "./", "index.html", "manifest.webmanifest", "css/pwa.css", "css/seiten.css", "datenschutz.html", "hilfe.html",
  "js/lokal/weiche.js", "js/lokal/server.js", "js/lokal/hilfen.js", "js/lokal/tabellen.js",
  "js/lokal/api/stillen.js", "js/lokal/api/wachstum.js", "js/lokal/api/gesundheit.js", "js/lokal/api/heft.js",
  "js/lokal/api/einstellungen.js", "js/lokal/api/sonstiges.js",
  "js/kern/speicher.js", "js/kern/zusammenfuehren.js", "js/kern/backupdatei.js", "js/kern/abgleich.js",
  "js/kern/kinder.js", "js/kern/version.js",
  "js/pwa/kinder-backup.js", "js/pwa/kalender.js", "js/pwa/beispiel.js", "js/ui/bausteine.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(namen => Promise.all(namen.filter(n => n.startsWith("babybuch-") && n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Erst aus dem Speicher (schnell, offline), im Hintergrund auffrischen. api/… beantwortet die Seite selbst (lokaler Pi).
self.addEventListener("fetch", e => {
  const anfrage = e.request, url = new URL(anfrage.url);
  if (anfrage.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const gespeichert = await c.match(anfrage, { ignoreSearch: true });
    const frisch = fetch(anfrage).then(antwort => { if (antwort.ok) c.put(anfrage, antwort.clone()); return antwort; }).catch(() => null);
    return gespeichert || (await frisch) || (anfrage.mode === "navigate" ? c.match("index.html") : Response.error());
  }));
});
