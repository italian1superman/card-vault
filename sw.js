/* Card Vault service worker — GitHub Pages */
const CACHE = 'card-vault-v47-ds-compact';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './visuals.js',
  './data/diamond-stars-r327-meta.json',
  './data/logos.json',
  './vault/seed-meta.json',
  './assets/teams/ARI.svg',
  './assets/teams/ATL.svg',
  './assets/teams/BAL.svg',
  './assets/teams/BOS.svg',
  './assets/teams/CHC.svg',
  './assets/teams/CIN.svg',
  './assets/teams/CLE.svg',
  './assets/teams/COL.svg',
  './assets/teams/CWS.svg',
  './assets/teams/DET.svg',
  './assets/teams/HOU.svg',
  './assets/teams/KC.svg',
  './assets/teams/LAA.svg',
  './assets/teams/LAD.svg',
  './assets/teams/MIA.svg',
  './assets/teams/MIL.svg',
  './assets/teams/MIN.svg',
  './assets/teams/NYM.svg',
  './assets/teams/NYY.svg',
  './assets/teams/OAK.svg',
  './assets/teams/PHI.svg',
  './assets/teams/PIT.svg',
  './assets/teams/SD.svg',
  './assets/teams/SEA.svg',
  './assets/teams/SF.svg',
  './assets/teams/STL.svg',
  './assets/teams/TB.svg',
  './assets/teams/TEX.svg',
  './assets/teams/TOR.svg',
  './assets/teams/WSH.svg',
  './assets/brands/bowman.svg',
  './assets/brands/fleer.svg',
  './assets/brands/mlb.svg',
  './assets/brands/panini.svg',
  './assets/brands/topps.svg',
  './assets/brands/upperdeck.svg'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  /* Large seed JSON: network-first so collection updates ship without stale cache */
  if (path.includes('/vault/jay-collection-seed.json') || path.includes('/vault/jayk527-tcdb-import.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const fetchPromise = fetch(req).then((res) => {
        if (
          res &&
          res.ok &&
          (path.endsWith('.html') ||
            path.endsWith('/') ||
            path.includes('manifest') ||
            path.includes('icons') ||
            path.includes('/assets/') ||
            path.includes('/data/') ||
            path.includes('/vault/'))
        ) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || fetchPromise;
    })
  );
});
