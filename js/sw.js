// ============ SERVICE WORKER ДЛЯ PWA ============
// Версия кэша (меняйте при обновлении файлов)
const CACHE_NAME = 'neoncareer-v2.0.0';

// Список файлов для кэширования (офлайн-режим)
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/profile.html',
  '/resumes.html',
  '/my-resumes.html',
  '/create-resume.html',
  '/view-resume.html',
  '/create-vacancy.html',
  '/view-vacancy.html',
  '/employer-responses.html',
  '/employer-stats.html',
  '/chat.html',
  '/notifications.html',
  '/admin.html',
  '/css/style.css',
  '/js/db.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/main.js',
  '/manifest.json',
  '/offline.html'
];

// Установка Service Worker – кэширование файлов
self.addEventListener('install', event => {
  console.log('[SW] Установка Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW] Ошибка кэширования:', err);
      })
  );
  // Принудительная активация нового SW
  self.skipWaiting();
});

// Активация – удаление старых кэшей
self.addEventListener('activate', event => {
  console.log('[SW] Активация Service Worker');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Обработка запросов сразу после активации
  self.clients.claim();
});

// Перехват запросов – стратегия "сначала кэш, потом сеть"
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // Пропускаем запросы к API (если есть) и аналитику
  if (requestUrl.pathname.includes('/api/') || 
      requestUrl.pathname.includes('analytics') ||
      requestUrl.pathname.includes('chrome-extension')) {
    return;
  }
  
  // Для HTML-страниц – сначала сеть, потом кэш (всегда свежие данные)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кэшируем полученную страницу
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Если сеть недоступна, показываем офлайн-страницу
          return caches.match('/offline.html');
        })
    );
    return;
  }
  
  // Для статических ресурсов (CSS, JS, изображения) – сначала кэш, потом сеть
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Найден в кэше – возвращаем
          return cachedResponse;
        }
        // Не найден в кэше – идём в сеть
        return fetch(event.request)
          .then(response => {
            // Кэшируем новый ресурс
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Для изображений – возвращаем заглушку при офлайн-режиме
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
              return caches.match('/icons/image-placeholder.png');
            }
            return new Response('Офлайн-режим: контент недоступен', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Фоновые уведомления (push-уведомления)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'NeonCareer hub';
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'dismiss', title: 'Закрыть' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Если уже есть открытое окно, переключаемся на него
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Синхронизация в фоне (опционально)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-responses') {
    event.waitUntil(syncResponses());
  }
});

async function syncResponses() {
  // Функция для синхронизации отложенных откликов (при восстановлении сети)
  console.log('[SW] Фоновая синхронизация откликов');
  // Здесь можно реализовать отправку неподтверждённых откликов на сервер
}

// Автообновление кэша раз в день
setInterval(() => {
  caches.open(CACHE_NAME).then(cache => {
    urlsToCache.forEach(url => {
      fetch(url).then(response => {
        if (response && response.status === 200) {
          cache.put(url, response);
        }
      }).catch(console.error);
    });
  });
}, 24 * 60 * 60 * 1000); // каждые 24 часа