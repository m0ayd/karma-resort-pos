// sw.js

const CACHE_NAME = 'karma-resort-cache-v1.5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  
  // Stylesheets
  '/css/style.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/print.css',
  '/css/pages/pos.css',
  '/css/pages/history.css',
  '/css/pages/settings.css',
  '/css/components/buttons.css',
  '/css/components/cards.css',
  '/css/components/forms.css',
  '/css/components/tables.css',
  '/css/components/notifications.css',
  '/css/components/modals.css',

  // Scripts
  '/js/main.js',
  '/js/utils.js',
  '/js/modules/db.js',
  '/js/modules/ui.js',
  '/js/modules/data.js',
  '/js/modules/pos.js',
  '/js/modules/football.js',
  '/js/modules/history.js',
  '/js/modules/settings.js',
  '/js/modules/printing.js',
  '/js/modules/backup.js',
  
  // Icons & Fonts
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap',
];

// 1. تثبيت عامل الخدمة وتخزين الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching assets');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache assets during install:', error);
      })
  );
});

// 2. تفعيل عامل الخدمة وحذف النسخ القديمة من الكاش
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. اعتراض طلبات الشبكة باستخدام استراتيجية Stale-While-Revalidate
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // خاصة بالخطوط، يفضل استخدام Cache-First
  if (event.request.url.startsWith('https://fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // استراتيجية Stale-While-Revalidate لباقي الملفات مع معالجة الخطأ
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          // --- بداية الحل للمشكلة الأولى ---
          // هذا الجزء يعترض أي خطأ ناتج عن فشل الاتصال بالشبكة
          .catch(error => {
            // نطبع تحذيراً في الـ console بدلاً من ترك الخطأ يوقف كل شيء
            console.warn(`[SW] Network request for ${event.request.url} failed. User is likely offline.`);
            // لا نرجع شيئاً لأننا سنعتمد على النسخة المخزنة في الكاش إذا كانت موجودة
          });
          // --- نهاية الحل للمشكلة الأولى ---
          
        // أرجع النسخة المخزنة فوراً (إذا كانت موجودة)، أو انتظر طلب الشبكة
        return cachedResponse || fetchPromise;
      });
    })
  );
});