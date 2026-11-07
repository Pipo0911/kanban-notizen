/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Kanban Notizen · Service Worker der Web-App: läuft offline, holt Updates im Hintergrund.
   VERSION wird beim Veröffentlichen (GitHub Pages) automatisch ersetzt. */
const VERSION='dev';
const CACHE='kanban-notizen-'+VERSION;
const FILES=['./','index.html','manifest.webmanifest','css/app.css',
  ...['version','core','model','storage','helpers','tasks','layout','board','views','editor','spaces','reports','settings','palette','links','trash','sync','remind','mobile','main'].map(m=>`js/${m}.js`),
  'vendor/qrcode.js','vendor/jsqr.js','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match('index.html'))))});
self.addEventListener('notificationclick',e=>{e.notification.close();const open=e.notification.data;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs[0];if(c){c.focus();if(open)c.postMessage({open})}else return self.clients.openWindow(open?`./?open=${open.sid}.${open.nid}`:'./')}))});
/* Erinnerung per Push: Inhalt wurde auf dem anderen Gerät für dieses verschlüsselt, der Browser entschlüsselt ihn */
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Kanban Notizen',{body:d.body||'',tag:d.tag||undefined,icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:d.open||null,timestamp:Date.now()}))});
