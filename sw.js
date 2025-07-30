const CACHE_NAME = 'commu-v2.4.6';
const APP_VERSION = '2.4.6';

// バージョン更新時に古いキャッシュを削除
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './p2p-utils.js',
  './manifest.json'
];

// Service Worker インストール時
self.addEventListener('install', (event) => {
  console.log('Service Worker installing, version:', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // 新しいService Workerを即座にアクティブ化
        return self.skipWaiting();
      })
  );
});

// Service Worker アクティベート時
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating, version:', APP_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 古いキャッシュを削除
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 即座に全てのクライアントを制御
      return self.clients.claim();
    })
  );
});

// フェッチイベント - ネットワーク優先戦略
self.addEventListener('fetch', (event) => {
  // HTMLファイルは常にネットワークから取得（キャッシュを無効化）
  if (event.request.destination === 'document' || 
      event.request.url.includes('.html') || 
      event.request.url.includes('.js') || 
      event.request.url.includes('.css')) {
    
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      .then((response) => {
        // 成功した場合はキャッシュを更新
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時のみキャッシュから取得
        return caches.match(event.request);
      })
    );
  } else {
    // その他のリソース（画像、フォントなど）は通常のキャッシュ戦略
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});

// バージョン情報をクライアントに送信
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
});