/* =========================================================
 * sw.js — 极简 Service Worker
 * 只缓存「外壳」：index.html、manifest.json、两个图标
 * 不缓存用户数据（错题/图片都只存在 IndexedDB 与 LocalStorage 里）
 * 不做复杂路由，不做后台同步，不做推送
 * ========================================================= */

const CACHE = 'mra-shell-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* 预缓存失败也不阻塞安装 */ })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // 跨域请求一律交给网络

  // 页面导航：先网络（保证更新），断网时回退到缓存的 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match(req);
        });
      })
    );
    return;
  }

  // 外壳静态资源：缓存优先
  const isShell = ASSETS.some(function (a) {
    return url.pathname.indexOf(a.replace('./', '/')) >= 0;
  });
  if (!isShell) return; // 其他资源不接管

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
