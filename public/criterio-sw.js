// Service worker mínimo de Criterio: existe para que el navegador
// ofrezca instalar la app. No guarda nada en caché (los datos son
// privados y deben venir siempre del servidor).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
