// v1.0.1: cache ONLY public static assets. Never cache user or financial HTML/JSON.
const CACHE='reloop-public-static-v1.0.1';
const ASSETS=['/offline.html','/css/style.css','/js/app.js','/js/enhancements.js','/icons/reloop-192.png','/icons/reloop-512.png','/icons/ui.svg','/img/hero.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(name=>name.startsWith('reloop-')&&name!==CACHE).map(name=>caches.delete(name)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match('/offline.html')));
    return;
  }
  if(ASSETS.includes(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const cached=await cache.match(url.pathname);
      return cached||fetch(request);
    }));
  }
});
