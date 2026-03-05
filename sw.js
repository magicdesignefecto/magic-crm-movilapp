// =====================================================
// Magic CRM Pro — Service Worker (PWA)
// Estrategia: Network First para API, Cache First para assets
// =====================================================

const CACHE_NAME = 'magic-crm-v2';

// Assets estáticos que forman la "shell" de la app
const SHELL_ASSETS = [
    './',
    './index.html',
    './css/reset.css',
    './css/variables.css',
    './css/layout.css',
    './css/components.css',
    './css/pages.css',
    './css/mobile.css',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './manifest.json'
];

// ---- INSTALL: Pre-cachear la shell de la app ----
self.addEventListener('install', (event) => {
    console.log('🔧 SW: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 SW: Cacheando shell de la app');
                return cache.addAll(SHELL_ASSETS);
            })
            .then(() => self.skipWaiting()) // Activar inmediatamente
    );
});

// ---- ACTIVATE: Limpiar caches antiguos ----
self.addEventListener('activate', (event) => {
    console.log('✅ SW: Activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('🗑️ SW: Eliminando cache antiguo:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim()) // Tomar control de todos los tabs
    );
});

// ---- FETCH: Estrategia inteligente ----
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ⚡ Firebase / APIs externas → SIEMPRE ir a la red (Network Only)
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase.googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com')
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 🎨 CDN externos (FontAwesome, Google Fonts, SweetAlert) → Cache First
    if (
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdn.jsdelivr.net')
    ) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // 📄 Assets locales (HTML, CSS, JS, imágenes) → Network First con fallback a cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Guardar copia en cache para uso offline
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Sin red → servir desde cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Si es una navegación, devolver la shell (index.html)
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503, statusText: 'Sin conexión' });
                });
            })
    );
});
