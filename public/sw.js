const CACHE='reloop-static-v3';const ASSETS=['/offline.html','/css/style.css','/js/app.js','/icons/reloop-192.png','/icons/reloop-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(ASSETS.includes(url.pathname)){e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(req);return cached||fetch(req);}));return;}
 if(req.mode==='navigate'){e.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));}
});