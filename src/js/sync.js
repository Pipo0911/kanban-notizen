/* Kanban Notizen · Abgleich zwischen Geräten (PC ↔ iPhone) über Supabase.
   - Ende-zu-Ende-verschlüsselt: Schlüssel = PBKDF2(Passwort, Salz), jedes Element mit AES-GCM; der Server sieht nur Ciphertext.
   - Zugang über einen geheimen Sync-Code (kein Konto, keine E-Mail).
   - Abgeglichen wird pro Element (Notiz, Space, Kategorien, Einstellungen, Papierkorb, Verlauf). Ändern beide Geräte dieselbe
     Notiz, gewinnt die zuletzt geänderte; die andere Fassung landet im Versionsverlauf. */
'use strict';
const SB_URL='https://rrydcfjetigzesebghrg.supabase.co',SB_KEY='sb_publishable_RRFTyYr6PsVF1dEqzFRgLg_slAWW-6Q';
const SYNCKEY='kanban-notizen-sync-v1',PBKDF2_ITER=310000,DEVICE_SETTINGS=['theme','notify','lastBackup'];
const sy={cfg:null,key:null,busy:false,again:false,timer:0,state:'',err:'',replace:false};

/* ---------- Hilfen: Base64, Hash, Krypto ---------- */
function b64e(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)}
function b64d(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function hsh(s){let a=0x811c9dc5,b=0x01000193^s.length;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519)}return(a>>>0).toString(36)+'.'+(b>>>0).toString(36)+'.'+s.length.toString(36)}
const CAN_GZ=typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined';
async function gz(u8,pack){const s=new Blob([u8]).stream().pipeThrough(pack?new CompressionStream('gzip'):new DecompressionStream('gzip'));return new Uint8Array(await new Response(s).arrayBuffer())}
async function deriveRaw(pw,saltB64){const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:b64d(saltB64),iterations:PBKDF2_ITER,hash:'SHA-256'},base,256))}
const aesKey=raw=>crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
async function enc(obj,key=sy.key){let data=new TextEncoder().encode(JSON.stringify(obj)),z=false;
  if(CAN_GZ&&data.length>600){data=await gz(data,true);z=true}
  const iv=crypto.getRandomValues(new Uint8Array(12)),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data));
  return(z?'z1.':'v1.')+b64e(iv)+'.'+b64e(ct)}
async function dec(s,key=sy.key){const[v,iv,ct]=String(s).split('.');let pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(iv)},key,b64d(ct)));
  if(v==='z1')pt=await gz(pt,false);return JSON.parse(new TextDecoder().decode(pt))}
const CODE_ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){const r=crypto.getRandomValues(new Uint8Array(20));return[...r].map(x=>CODE_ABC[x&31]).join('')}
const normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const fmtCode=c=>c.replace(/(.{4})(?=.)/g,'$1-');

/* ---------- Server ---------- */
async function rpc(fn,args){let r;
  try{r=await fetch(`${SB_URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(args)})}
  catch(e){const x=new Error('Keine Verbindung');x.offline=true;throw x}
  if(!r.ok){let m='';try{m=(await r.json()).message}catch(e){}throw new Error(m||'Server-Fehler '+r.status)}
  return r.json()}

/* ---------- Lokale Einstellungen dieses Geräts ---------- */
function syLoad(){try{sy.cfg=JSON.parse(localStorage.getItem(SYNCKEY)||'null')}catch(e){sy.cfg=null}}
function sySave(){try{sy.cfg?localStorage.setItem(SYNCKEY,JSON.stringify(sy.cfg)):localStorage.removeItem(SYNCKEY)}catch(e){}}
async function syncStart(){syLoad();handlePairLink();if(!sy.cfg)return;
  try{sy.key=await aesKey(b64d(sy.cfg.keyB64))}catch(e){sy.cfg=null;sySave();return}
  syncNow()}

/* ---------- Daten ↔ Elemente ---------- */
const cleanObj=n=>{const o={};for(const k in n)if(k[0]!=='_')o[k]=n[k];return o};
function syncItems(){const m=new Map(),put=(id,kind,v)=>m.set(id,{kind,v,h:hsh(JSON.stringify(v))});
  put('folders','folders',DB.folders);
  const st=Object.assign({},DB.settings);DEVICE_SETTINGS.forEach(k=>delete st[k]);put('settings','settings',st);
  DB.spaces.forEach((s,k)=>{const{notes,...r}=s;put('space:'+s.id,'space',Object.assign({},r,{pos:k}));
    notes.forEach(n=>put('note:'+n.id,'note',Object.assign(cleanObj(n),{sid:s.id})))});
  DB.trash.forEach(e=>put('trash:'+e.id,'trash',e));
  for(const[k,v]of Object.entries(DB.history))put('hist:'+k,'hist',v);
  return m}
function syncRebuild(L){const vals=[...L.values()];
  const spaces=vals.filter(x=>x.kind==='space').map(x=>x.v).sort((a,b)=>(a.pos||0)-(b.pos||0)).map(v=>Object.assign({},v,{notes:[]}));
  const byId=new Map(spaces.map(s=>[s.id,s])),orphans=[];
  for(const x of vals)if(x.kind==='note'){const{sid,...n}=x.v;const s=byId.get(sid);(s?s.notes:orphans).push(n)}
  if(orphans.length){if(!spaces.length)spaces.push(makeSpace('Notizen',SPCOL[0],'notizen'));spaces[0].notes.push(...orphans)}
  const g=id=>L.has(id)?L.get(id).v:null;
  const settings=Object.assign({},g('settings')||DB.settings);DEVICE_SETTINGS.forEach(k=>settings[k]=DB.settings[k]);
  const history={};for(const[id,x]of L)if(x.kind==='hist'&&Array.isArray(x.v))history[id.slice(5)]=x.v;
  DB=normDB({folders:g('folders')||[],spaces,settings,trash:vals.filter(x=>x.kind==='trash').map(x=>x.v).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt))),history,active:DB.active,ui:DB.ui});
  applyTheme()}
/* Bei einem Konflikt geht die unterlegene Fassung einer Notiz in den Versionsverlauf */
function keepAsVersion(L,noteId,v){if(!v)return;const id='hist:'+noteId,cur=L.get(id),l=cur?[...cur.v]:[];
  l.push({at:v.updated||now(),title:String(v.title||''),body:String(v.body||''),checklist:arr(v.checklist).map(c=>({text:c.text,done:!!c.done}))});
  while(l.length>HISTORY_MAX)l.shift();L.set(id,{kind:'hist',v:l,h:hsh(JSON.stringify(l))})}

/* ---------- Abgleich ---------- */
function syncSchedule(){if(!sy.cfg||!sy.key||!tv.loaded)return;clearTimeout(sy.timer);sy.timer=setTimeout(syncNow,1500)}
async function syncNow(manual){if(!sy.cfg||!sy.key||!tv.loaded)return;if(sy.busy){sy.again=true;return}
  sy.busy=true;sy.state='run';syncUI();let pulled=0;
  try{const st=sy.cfg.state||(sy.cfg.state={});
    /* 1. Holen – nicht, während eine Notiz offen ist, damit nichts unter den Fingern wechselt */
    if(!busy()){let since=sy.cfg.lastRev||0;const L=sy.replace?new Map():syncItems(),applied=new Set();let any=sy.replace;
      for(;;){const rows=await rpc('kn_pull',{p_token:sy.cfg.token,p_since:since,p_limit:300});
        for(const r of rows){since=Math.max(since,+r.rev);const cur=L.get(r.id),base=st[r.id];
          if(r.deleted){if(cur&&cur.h===base){L.delete(r.id);any=true;pulled++}if(!cur||cur.h===base)delete st[r.id];continue}
          let v;try{v=await dec(r.data)}catch(e){throw new Error('Entschlüsseln fehlgeschlagen – stimmt das Sync-Passwort?')}
          const rh=hsh(JSON.stringify(v));
          if(cur&&cur.h===rh){st[r.id]=rh;continue}
          if(!cur||cur.h===base){L.set(r.id,{kind:r.kind,v,h:rh});st[r.id]=rh;applied.add(r.id);any=true;pulled++;continue}
          /* Konflikt: beide Geräte haben geändert */
          if(r.kind==='note'&&String(cur.v.updated||'')>String(v.updated||'')){keepAsVersion(L,r.id.slice(5),v);st[r.id]=rh;any=true}
          else{if(r.kind==='note')keepAsVersion(L,r.id.slice(5),cur.v);L.set(r.id,{kind:r.kind,v,h:rh});st[r.id]=rh;applied.add(r.id);any=true;pulled++}}
        if(rows.length<300)break}
      sy.cfg.lastRev=since;
      if(any){syncRebuild(L);const L2=syncItems();applied.forEach(id=>{const x=L2.get(id);if(x)st[id]=x.h});save(true);render()}
      sy.replace=false}
    /* 2. Senden: alles, was sich seit dem letzten Abgleich geändert hat */
    const L=syncItems(),out=[];
    for(const[id,x]of L)if(st[id]!==x.h)out.push({id,x});
    for(const id of Object.keys(st))if(!L.has(id))out.push({id,del:true});
    let batch=[],size=0;
    const flush=async()=>{if(!batch.length)return;await rpc('kn_push',{p_token:sy.cfg.token,p_items:batch.map(b=>b.p)});
      batch.forEach(b=>{if(b.del)delete st[b.id];else st[b.id]=b.h});batch=[];size=0};
    for(const o of out){const p=o.del?{id:o.id,kind:'x',deleted:true}:{id:o.id,kind:o.x.kind,data:await enc(o.x.v)};
      const sz=(p.data||'').length+100;if(size+sz>1.5e6)await flush();batch.push({id:o.id,del:!!o.del,h:o.x&&o.x.h,p});size+=sz}
    await flush();
    sy.cfg.lastSync=now();sy.state='ok';sy.err='';sySave();
    if(pulled&&!manual)toast(pulled===1?'1 Änderung vom anderen Gerät übernommen':`${pulled} Änderungen vom anderen Gerät übernommen`);
    if(manual)toast(pulled?`Synchronisiert · ${pulled} Änderung${pulled===1?'':'en'} übernommen`:'Synchronisiert – alles aktuell')}
  catch(e){console.warn(e);sy.state=e.offline?'offline':'err';sy.err=e.message||String(e);if(manual)toast('Synchronisieren fehlgeschlagen: '+sy.err)}
  finally{sy.busy=false;syncUI();if(sy.again){sy.again=false;setTimeout(syncNow,400)}}}
/* Kurz nachfragen, ob es Neues gibt (billig: nur die letzte Revisionsnummer) */
setInterval(async()=>{if(!sy.cfg||!sy.key||sy.busy||!tv.loaded||document.visibilityState!=='visible')return;
  try{const h=await rpc('kn_head',{p_token:sy.cfg.token});if(+h>(sy.cfg.lastRev||0))syncNow()}catch(e){}},8000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncSchedule()});
window.addEventListener('online',()=>syncSchedule());
window.addEventListener('focus',()=>syncSchedule());

/* ---------- Einrichten, Verbinden, Trennen ---------- */
async function syncSetupNew(){
  const r=await ask({title:'Synchronisation einrichten',text:'Wähle ein <b>Sync-Passwort</b>. Damit werden deine Notizen auf diesem Gerät verschlüsselt, bevor sie in die Cloud gehen. Du brauchst es einmal auf jedem weiteren Gerät. <b>Ohne das Passwort lassen sich die Cloud-Daten nicht wiederherstellen.</b>',
    fields:[{name:'pw',label:'Sync-Passwort (mind. 8 Zeichen)',type:'password',required:true},{name:'pw2',label:'Passwort wiederholen',type:'password',required:true}],ok:'Einrichten',
    init:f=>{const a=f.elements.pw,b=f.elements.pw2;const c=()=>{a.setCustomValidity(a.value.length>=8?'':'Mindestens 8 Zeichen');b.setCustomValidity(b.value===a.value?'':'Passwörter stimmen nicht überein')};a.addEventListener('input',c);b.addEventListener('input',c);c()}});
  if(!r)return;toast('Richte Synchronisation ein …');
  try{const code=newCode(),salt=b64e(crypto.getRandomValues(new Uint8Array(16))),raw=await deriveRaw(r.pw,salt),key=await aesKey(raw);
    await rpc('kn_create',{p_token:code,p_salt:salt,p_check:await enc({ok:'kanban-notizen'},key)});
    sy.cfg={token:code,keyB64:b64e(raw),lastRev:0,state:{},since:now()};sy.key=key;sySave();
    await syncNow(true);renderContent();showPairQR(true)}
  catch(e){toast('Einrichten fehlgeschlagen: '+(e.message||e))}}
async function syncJoin(){
  const hasLocal=allNotes().some(x=>!x.n.tags.includes('beispiel'));
  const r=await ask({title:'Mit bestehendem Sync verbinden',text:'Gib den <b>Sync-Code</b> und das <b>Sync-Passwort</b> ein. Beides findest du auf dem anderen Gerät unter Einstellungen → Synchronisation.',
    fields:[{name:'code',label:'Sync-Code',required:true,placeholder:'XXXX-XXXX-XXXX-XXXX-XXXX'},{name:'pw',label:'Sync-Passwort',type:'password',required:true},
      ...(hasLocal?[{name:'mode',label:'Notizen auf diesem Gerät',type:'select',options:[['merge','Zusammenführen – beide Stände behalten'],['replace','Ersetzen – nur die Notizen vom Sync verwenden']]}]:[])],ok:'Verbinden',
    init:f=>{const c=f.elements.code;c.autocapitalize='characters';c.spellcheck=false;c.autocomplete='off';c.addEventListener('input',()=>{const p=c.selectionStart,v=fmtCode(normCode(c.value)).slice(0,24);if(v!==c.value){c.value=v;try{c.setSelectionRange(v.length,v.length)}catch(e){}}})}});
  if(!r)return;const code=normCode(r.code);if(code.length!==20){toast('Der Sync-Code hat 20 Zeichen.');return}
  toast('Verbinde …');
  try{const meta=(await rpc('kn_meta',{p_token:code}))[0];if(!meta){toast('Diesen Sync-Code gibt es nicht. Bitte prüfen.');return}
    const raw=await deriveRaw(r.pw,meta.salt);
    await connectWith(code,raw,meta,hasLocal?r.mode:'replace','Falsches Sync-Passwort.')}
  catch(e){toast('Verbinden fehlgeschlagen: '+(e.message||e))}}
/* Gemeinsamer Abschluss für Passwort und QR-Code: Schlüssel prüfen, speichern, ersten Abgleich starten */
async function connectWith(code,raw,meta,mode,badMsg){const key=await aesKey(raw);
  try{const ok=await dec(meta.check_blob,key);if(!ok||ok.ok!=='kanban-notizen')throw 0}catch(e){toast(badMsg);return false}
  sy.cfg={token:code,keyB64:b64e(raw),lastRev:0,state:{},since:now()};sy.key=key;sySave();
  sy.replace=mode!=='merge';
  await syncNow(true);if(DB.ui.view==='settings')renderContent();render();toast('Verbunden – Notizen werden ab jetzt automatisch abgeglichen');return true}
async function syncDisconnect(){const r=await ask({title:'Synchronisation trennen?',text:'Dieses Gerät gleicht danach nicht mehr ab. Deine Notizen bleiben hier und in der Cloud erhalten. Zum erneuten Verbinden scannst du den QR-Code eines verbundenen Geräts oder gibst Sync-Code und Passwort ein.',ok:'Trennen',danger:true});
  if(!r)return;sy.cfg=null;sy.key=null;sy.state='';sySave();renderContent();toast('Synchronisation getrennt')}
async function syncDeleteCloud(){const r=await ask({title:'Cloud-Daten löschen?',text:'Löscht alle synchronisierten Notizen <b>in der Cloud</b>. Die Notizen auf diesem Gerät bleiben erhalten. Andere Geräte gleichen danach nicht mehr ab und müssen neu verbunden werden.',
    fields:[{name:'k',label:'Zur Bestätigung LÖSCHEN eingeben',required:true}],ok:'Endgültig löschen',danger:true,init:f=>{const k=f.elements.k;const c=()=>k.setCustomValidity(k.value.trim().toUpperCase()==='LÖSCHEN'?'':'Bitte LÖSCHEN eingeben');k.addEventListener('input',c);c()}});
  if(!r)return;try{await rpc('kn_delete_vault',{p_token:sy.cfg.token});sy.cfg=null;sy.key=null;sySave();renderContent();toast('Cloud-Daten gelöscht')}catch(e){toast('Löschen fehlgeschlagen: '+e.message)}}
function showSyncCode(fresh){const c=fmtCode(sy.cfg.token);
  ask({title:fresh?'Synchronisation ist eingerichtet':'Sync-Code',cancel:null,ok:'Fertig',wide:true,
    text:`${fresh?'<p>Deine Notizen sind jetzt verschlüsselt in der Cloud. ':'<p>'}Um ein weiteres Gerät zu verbinden, öffne dort <b>Einstellungen → Synchronisation → Mit bestehendem Sync verbinden</b> und gib diesen Code und dein Sync-Passwort ein:</p>
      <div class="sync-code" id="syCodeVal">${esc(c)}</div><p class="row-btns" style="justify-content:center"><button type="button" class="btn" id="syCopy">Code kopieren</button></p>
      <p class="muted sm">Behandle den Code wie einen Schlüssel: Wer Code <b>und</b> Passwort kennt, kann deine Notizen lesen.</p>`,
    init:()=>{$('#syCopy').onclick=async()=>{toast(await copyText(c)?'Sync-Code kopiert':'Kopieren nicht möglich')}}})}

/* ---------- Anzeige ---------- */
function syncUI(){const el=$('#syncStat');if(el)el.outerHTML=syncStatHTML();const n=$('#syncNav');if(n)n.outerHTML=syncNavHTML()}
function syncStatHTML(){const s=sy.state,t=sy.cfg&&sy.cfg.lastSync;
  const txt=s==='run'?'Synchronisiere …':s==='err'?'Fehler: '+esc(sy.err):s==='offline'?'Offline – wird abgeglichen, sobald wieder Internet da ist':t?'Synchronisiert '+esc(rel(t)):'Noch nicht synchronisiert';
  return`<div class="store-state" id="syncStat"><span class="dotst ${s==='err'?'err':s==='offline'?'warn':'ok'}"></span><div><b>Verbunden</b><div class="muted sm">${txt}</div></div></div>`}
function syncNavHTML(){if(!sy.cfg)return'<span id="syncNav" hidden></span>';const s=sy.state;
  const lbl=s==='run'?'Synchronisiere …':s==='err'?'Sync-Fehler':s==='offline'?'Offline':'Synchronisiert';
  return`<button class="nav-item sync-nav ${s||'ok'}" id="syncNav" data-act="syncNow" title="${sy.cfg.lastSync?'Zuletzt '+esc(fmtTime(sy.cfg.lastSync)):''}"><span class="sync-dot"></span><span class="sp-n">${lbl}</span>${sy.cfg.lastSync&&s!=='run'?`<span class="sp-c">${esc(new Date(sy.cfg.lastSync).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}))}</span>`:''}</button>`}
function syncPanelHTML(){
  if(!sy.cfg)return`<div class="panel"><h3>Synchronisation</h3><p>Gleicht deine Notizen automatisch zwischen PC und iPhone ab, sobald sich etwas ändert. Die Notizen werden auf dem Gerät mit deinem Sync-Passwort <b>verschlüsselt</b> – in der Cloud liegt nur unlesbarer Datensalat.</p>
    <div class="row-btns">${CAN_SCAN?'<button class="btn primary" id="syScan">Mit QR-Code verbinden …</button>':''}<button class="btn${CAN_SCAN?'':' primary'}" id="syNew">Sync einrichten …</button><button class="btn" id="syJoin">Mit Code und Passwort verbinden …</button></div>
    <small>Auf dem ersten Gerät (z. B. dem PC) „Sync einrichten“. Weitere Geräte verbindest du am einfachsten mit dem QR-Code, den das erste Gerät unter Synchronisation anzeigt.</small></div>`;
  return`<div class="panel"><h3>Synchronisation</h3>${syncStatHTML()}
    <p>Änderungen werden nach wenigen Sekunden hochgeladen; neue Notizen vom anderen Gerät erscheinen hier automatisch, solange die App offen ist. Sync-Code: <code>${esc(sy.cfg.token.slice(0,4))}-••••-••••-••••-${esc(sy.cfg.token.slice(-4))}</code></p>
    <div class="row-btns"><button class="btn primary" id="syNow">Jetzt synchronisieren</button><button class="btn" id="syQR">QR-Code für weiteres Gerät</button><button class="btn" id="syCode">Sync-Code anzeigen</button><span class="spacer"></span><button class="btn ghost" id="syOff">Trennen</button><button class="btn ghost danger" id="syDel">Cloud-Daten löschen …</button></div></div>`}
function bindSyncPanel(el){const on=(id,f)=>{const x=$('#'+id,el);if(x)x.onclick=f};
  on('syNew',syncSetupNew);on('syScan',scanPairQR);on('syQR',()=>showPairQR(false));on('syJoin',syncJoin);on('syNow',()=>syncNow(true));on('syCode',()=>showSyncCode(false));on('syOff',syncDisconnect);on('syDel',syncDeleteCloud)}

/* ---------- Koppeln per QR-Code ----------
   Der QR-Code enthält einen Link mit Sync-Code und Schlüssel im #-Teil (wird nie an einen Server geschickt).
   Die iPhone-App scannt ihn mit der eingebauten Kamera; die Kamera-App würde ihn in Safari öffnen,
   das auf dem iPhone einen eigenen Speicher hat. */
const PAIR_URL='https://pipo0911.github.io/kanban-notizen/';
const CAN_SCAN=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)&&(WEB||IOS)&&matchMedia('(pointer:coarse)').matches;
const b64url=s=>s.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return s};
const pairLink=()=>`${PAIR_URL}#kn-pair=${sy.cfg.token}.${b64url(sy.cfg.keyB64)}`;
function parsePair(t){const m=String(t||'').match(/kn-pair=([A-Z0-9]{20})\.([A-Za-z0-9_-]{40,60})/);if(!m)return null;
  try{const raw=b64d(unb64url(m[2]));return raw.length===32?{code:m[1],raw}:null}catch(e){return null}}
const vendorLoaded={};
function loadVendor(name){return vendorLoaded[name]||(vendorLoaded[name]=new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/'+name+'.js';s.onload=res;s.onerror=()=>{delete vendorLoaded[name];rej(new Error('Baustein „'+name+'“ konnte nicht geladen werden'))};document.head.appendChild(s)}))}
async function showPairQR(fresh){if(!sy.cfg)return;
  try{await loadVendor('qrcode')}catch(e){toast(e.message);return}
  const q=qrcode(0,'M');q.addData(pairLink());q.make();
  const svg=q.createSvgTag({cellSize:6,margin:3,scalable:true});let left=120,t=0;
  await ask({title:fresh?'Synchronisation ist eingerichtet':'Weiteres Gerät verbinden',cancel:null,ok:'Fertig',wide:true,
    text:`${fresh?'<p>Deine Notizen liegen jetzt verschlüsselt in der Cloud.</p>':''}<p>Öffne auf dem iPhone die <b>App Kanban Notizen</b> (vom Home-Bildschirm), dann <b>Einstellungen → Synchronisation → Mit QR-Code verbinden</b> und halte die Kamera auf diesen Code:</p>
      <div class="pair-qr" id="pairQR">${svg}</div><p class="muted sm" style="text-align:center" id="pairLeft">Wird nach 2:00 Minuten ausgeblendet</p>
      <p class="muted sm"><b>Nicht mit der Kamera-App scannen</b> – die öffnet Safari statt der App. Der QR-Code ist ein Schlüssel zu deinen Notizen: Zeige ihn niemandem und mach keinen Screenshot davon.</p>`,
    init:()=>{t=setInterval(()=>{left--;const el=$('#pairLeft');if(el)el.textContent=`Wird nach ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} Minuten ausgeblendet`;
      if(left<=0){clearInterval(t);const q=$('#pairQR');if(q)q.innerHTML='<div class="muted" style="padding:40px 10px;text-align:center">Aus Sicherheitsgründen ausgeblendet.<br>Öffne den QR-Code bei Bedarf erneut.</div>'}},1000)}});
  clearInterval(t)}
async function scanPairQR(){
  if(!CAN_SCAN&&!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){toast('Dieses Gerät hat keine Kamera für den QR-Code.');return}
  try{await loadVendor('jsqr')}catch(e){toast(e.message);return}
  const d=$('#dlg2');d.style.width='min(480px,calc(100vw - 24px))';let stream=null,raf=0,done=false;
  d.innerHTML=`<div class="dh">QR-Code scannen</div><div class="ab"><p class="atext">Halte die Kamera auf den QR-Code am PC (Einstellungen → Synchronisation → QR-Code für weiteres Gerät).</p>
    <div class="scan-box"><video id="scanV" playsinline muted autoplay></video><div class="scan-frame"></div></div><p class="muted sm" id="scanMsg">Kamera wird gestartet …</p></div>
    <div class="df"><span class="spacer"></span><button type="button" class="btn ghost" data-x>Abbrechen</button></div>`;
  const stop=()=>{done=true;cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null};
  d.onclose=()=>{stop();d.style.width=''};$('[data-x]',d).onclick=()=>d.close();d.showModal();
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})}
  catch(e){$('#scanMsg',d).textContent=e&&e.name==='NotAllowedError'?'Kein Zugriff auf die Kamera. Erlaube ihn in den iPhone-Einstellungen bei Safari → Kamera bzw. beim Öffnen der Abfrage.':'Kamera konnte nicht gestartet werden: '+(e.message||e);return}
  if(done){stop();return}
  const v=$('#scanV',d);v.srcObject=stream;try{await v.play()}catch(e){}
  $('#scanMsg',d).textContent='Suche QR-Code …';
  const c=document.createElement('canvas'),g=c.getContext('2d',{willReadFrequently:true});let wrong=0;
  const tick=async()=>{if(done)return;
    if(v.readyState>=2&&v.videoWidth){const k=Math.min(1,640/Math.max(v.videoWidth,v.videoHeight));c.width=Math.round(v.videoWidth*k);c.height=Math.round(v.videoHeight*k);
      g.drawImage(v,0,0,c.width,c.height);const img=g.getImageData(0,0,c.width,c.height),res=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});
      if(res&&res.data){const p=parsePair(res.data);
        if(p){stop();$('#scanMsg',d).textContent='Erkannt – verbinde …';d.close();await pairWith(p);return}
        if(++wrong%30===1)$('#scanMsg',d).textContent='Das ist kein QR-Code von Kanban Notizen.'}}
    raf=requestAnimationFrame(tick)};
  tick()}
async function pairWith(p){
  if(sy.cfg&&sy.cfg.token===p.code){toast('Dieses Gerät ist bereits verbunden.');return}
  const hasLocal=allNotes().some(x=>!x.n.tags.includes('beispiel'));let mode='replace';
  if(hasLocal){const r=await ask({title:'Mit dem Sync verbinden',text:'Auf diesem Gerät sind schon eigene Notizen. Was soll mit ihnen passieren?',
      fields:[{name:'mode',label:'Notizen auf diesem Gerät',type:'select',options:[['merge','Zusammenführen – beide Stände behalten'],['replace','Ersetzen – nur die Notizen vom Sync verwenden']]}],ok:'Verbinden'});
    if(!r)return;mode=r.mode}
  toast('Verbinde …');
  try{const meta=(await rpc('kn_meta',{p_token:p.code}))[0];if(!meta){toast('Dieser Sync existiert nicht mehr.');return}
    await connectWith(p.code,p.raw,meta,mode,'Der QR-Code passt nicht zu diesem Sync.')}
  catch(e){toast('Verbinden fehlgeschlagen: '+(e.message||e))}}
/* QR-Code wurde mit der Kamera-App gescannt und hat diese Seite geöffnet */
function handlePairLink(){const p=parsePair(location.hash);if(!p)return;
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){location.hash=''}
  if(IOS&&!STANDALONE){ask({title:'Bitte in der App scannen',cancel:'Trotzdem hier verbinden',ok:'Verstanden',
      text:'Du hast den QR-Code mit der Kamera-App gescannt. Dadurch öffnet sich <b>Safari</b> – und Safari hat auf dem iPhone einen eigenen Speicher, getrennt von der App auf dem Home-Bildschirm.<br><br>Öffne stattdessen die <b>App Kanban Notizen</b> und tippe in den Einstellungen unter Synchronisation auf <b>Mit QR-Code verbinden</b>.'})
    .then(r=>{if(r===null)pairWith(p)});return}
  pairWith(p)}
