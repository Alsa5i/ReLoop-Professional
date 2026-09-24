// Dependency-free installability, cache-boundary and recovery-contract tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const src=file=>fs.readFileSync(path.join(root,file),'utf8');
let n=0;
const check=(truth,message)=>{assert.ok(truth,message);n++;};
const manifest=JSON.parse(src('public/manifest.webmanifest'));
check(manifest.id==='/'&&manifest.scope==='/'&&manifest.display==='standalone','standalone install scope');
check(manifest.start_url.startsWith('/'),'same-origin start URL');
check(manifest.name.includes('ReLoop')&&manifest.icons.length>=2,'brand/icons');
for(const icon of manifest.icons){const f=path.join(root,'public',icon.src);check(fs.existsSync(f),icon.src+' exists');const data=fs.readFileSync(f);check(data.subarray(1,4).toString()==='PNG',icon.src+' PNG');const [w,h]=[data.readUInt32BE(16),data.readUInt32BE(20)];check(`${w}x${h}`===icon.sizes,icon.src+' correct dimensions');}
check(src('views/public/install.ejs').includes('data-install-pwa'),'visible install UI target');
check(src('views/public/install.ejs').includes('Add to Home Screen'),'iOS install instructions');
check(src('views/partials/public-nav.ejs').includes('href="/install"'),'public install link');
check(src('views/partials/app-sidebar.ejs').includes('Install on phone'),'app install link');
check(src('views/partials/head.ejs').includes('apple-touch-icon'),'iOS home-screen icon');
check(src('public/js/app.js').includes("beforeinstallprompt")&&src('public/js/app.js').includes("appinstalled"),'native install flow');
check(src('public/offline.html').includes('No changes were queued.'),'honest offline message');
check(src('src/routes/public.js').includes("router.get('/install'"),'install route');
const listeners={},matched=[];let opens=[];
const cache={addAll:async keys=>{matched.push(...keys);},match:async key=>matched.includes(key)?{cached:key}:null};
const caches={open:async name=>{opens.push(name);return cache;},match:async name=>name==='/offline.html'?{offline:true}:null,keys:async()=>[],delete:async()=>true};
const sandbox={self:{location:{origin:'https://reloop.test'},addEventListener:(name,cb)=>listeners[name]=cb,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches,URL,fetch:async req=>({network:req.url})};
vm.runInNewContext(src('public/sw.js'),sandbox,{filename:'public/sw.js'});
check(typeof listeners.install==='function'&&typeof listeners.fetch==='function','SW listeners');
function request(url,mode='same-origin',method='GET'){
 let promise=null;listeners.fetch({request:{url,method,mode},respondWith:p=>{promise=p}});return promise;
}
(async()=>{
 await new Promise(r=>listeners.install({waitUntil:p=>p.then(r)}));
 check(matched.includes('/offline.html')&&matched.includes('/manifest.webmanifest'),'offline shell cached');
 for(const fragment of ['/customer','/owner','/pickup','/payment','/proof','/login','/register','/account'])check(!matched.some(x=>x.includes(fragment)),'no private cache entry: '+fragment);
 const secret=request('https://reloop.test/proof/123');check(secret===null,'private proof bypasses SW cache');
 const dynamic=await request('https://reloop.test/customer','navigate');check(dynamic.network==='https://reloop.test/customer','private navigation uses network');
 const asset=await request('https://reloop.test/icons/reloop-192.png');check(asset.cached==='/icons/reloop-192.png','public icon cached');
 check(request('https://elsewhere.test/else','navigate')===null,'cross-origin bypassed');
 check(request('https://reloop.test/customer','navigate','POST')===null,'POST bypassed');
 const reset=src('src/routes/password-reset.js');
 for(const pattern of [/randomBytes\(32\)/,/sha256/,/expires_at>\?/,/used_at IS NULL/,/DELETE FROM app_sessions WHERE user_id=\?/,/status='active'/,/role<>'owner'/])check(pattern.test(reset),'reset hardening '+pattern);
 check(src('src/db.js').includes('password_reset_tokens'),'recovery table');
 check(src('src/routes/auth.js').includes('resetDone'),'sign-in recovery feedback');
 console.log('PASS version 1.0.1 PWA/password recovery contracts:',n);
})().catch(err=>{console.error(err);process.exitCode=1});
