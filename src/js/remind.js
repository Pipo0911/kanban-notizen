/* Kanban Notizen · Erinnerungen: Zeitpunkt pro Notiz, Hinweis in der App, Windows-Mitteilung und iPhone-Push.
   - PC: Die App prüft laufend (auch im Infobereich) und zeigt eine Windows-Mitteilung.
   - iPhone: Jedes Gerät plant nach dem Abgleich alle Erinnerungen der nächsten 30 Tage auf dem Server ein.
     Titel und Text werden dabei auf dem Gerät für das iPhone verschlüsselt (Web Push, RFC 8291);
     der Server schickt zur geplanten Zeit nur den Ciphertext an Apple – auch wenn die App geschlossen ist. */
'use strict';
const VAPID_PUBLIC='BDyfGZH6-6b6qLEtsLHs2PSTNv5d6y2YdsWnPdH2R5ymEtS8JM_K4EPZUKW9d1RC7aRLzVDkcitTqKZuE5Ogsfk';
const REMIND_OPTS=[['','Zum Termin'],['rel:5','5 Min. vorher'],['rel:15','15 Min. vorher'],['rel:30','30 Min. vorher'],['rel:60','1 Std. vorher'],['rel:120','2 Std. vorher'],['rel:1440','1 Tag vorher'],['at','Eigene Zeit …'],['off','Keine Erinnerung']];
const REMIND_RE=/^(off|rel:\d{1,5}|at:\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/;
const pad2=x=>String(x).padStart(2,'0');
const localStamp=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/* Zeitpunkt der Erinnerung (oder null). Standard: zum Termin, wenn er eine Uhrzeit hat. Ganztägig: Basis 09:00. */
function remindAt(n){const r=n.remind||'';if(r==='off')return null;
  if(r.startsWith('at:')){const d=new Date(r.slice(3));return isNaN(d)?null:d}
  if(!n.due)return null;const base=new Date(n.due+'T'+(n.dueTime||'09:00'));
  if(r==='')return n.dueTime?base:null;
  if(r.startsWith('rel:'))return new Date(+base-(+r.slice(4))*6e4);
  return null}
const remindKey=(n,t)=>n.id+'@'+localStamp(t);
function fmtRemind(t){const d=localStamp(t);return`${fmtShort(d.slice(0,10))}, ${d.slice(11)}`}
function remindLabel(n){const t=remindAt(n);if(!t)return'';return fmtRemind(t)}

/* ---------- Erinnert: pro Gerät merken (nicht synchronisieren – jedes Gerät soll selbst erinnern) ---------- */
const RKEY='kanban-notizen-reminded';
const reminded=(()=>{try{return JSON.parse(localStorage.getItem(RKEY)||'{}')}catch(e){return{}}})();
function markReminded(k){reminded[k]=Date.now();const cut=Date.now()-30*864e5;for(const x in reminded)if(reminded[x]<cut)delete reminded[x];try{localStorage.setItem(RKEY,JSON.stringify(reminded))}catch(e){}}

function remindBody(s,n){const t=remindAt(n),parts=[];
  if(n.due)parts.push(fmtShort(n.due)+(n.dueTime?' '+n.dueTime:''));parts.push(s.name);
  const first=String(n.body||'').split('\n').map(l=>l.replace(/^[-*#>\s]+|\[[ xX]\]\s*/g,'').trim()).find(Boolean);
  return parts.join(' · ')+(first?'\n'+first.slice(0,120):'')}

/* Regelmässig prüfen: fällige Erinnerungen der letzten 12 Stunden zeigen */
function checkReminders(){if(!tv.loaded)return;const nw=Date.now();
  for(const{s,n}of allNotes()){if(n.archived||isDone(s,n))continue;const t=remindAt(n);if(!t)continue;
    const tt=+t;if(tt>nw||nw-tt>12*36e5)continue;const k=remindKey(n,t);if(reminded[k])continue;
    markReminded(k);fireReminder(s,n)}}
setInterval(checkReminders,20000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(checkReminders,500)});

function fireReminder(s,n){
  remindCard(s,n);
  /* iPhone mit Push: die Mitteilung kommt vom Server, sonst lokal */
  if(!(WEB&&pushOn()))notify('⏰ '+noteLabel(n),remindBody(s,n),'kn-'+n.id,{sid:s.id,nid:n.id},true)}

/* Karte unten rechts: Öffnen, Später, Erledigt */
function remindCard(s,n){let box=$('#remindBox');if(!box){box=document.createElement('div');box.id='remindBox';box.className='remind-box';document.body.appendChild(box)}
  const c=document.createElement('div');c.className='remind-card';c.setAttribute('role','alert');
  const done=s.columns.find(x=>x.done);
  c.innerHTML=`<div class="rc-h"><span class="rc-ic">⏰</span><b>${esc(noteLabel(n))}</b><button class="icon-btn sm" data-rx aria-label="Schliessen">✕</button></div>
    <div class="rc-b">${esc(remindBody(s,n)).replace(/\n/g,'<br>')}</div>
    <div class="rc-a"><button class="btn sm primary" data-ro>Öffnen</button><button class="btn sm" data-rs="10">+10 Min.</button><button class="btn sm" data-rs="60">+1 Std.</button><button class="btn sm" data-rs="tomorrow">Morgen</button>${done?'<button class="btn sm ghost" data-rd>Erledigt</button>':''}</div>`;
  const close=()=>{c.classList.add('out');setTimeout(()=>c.remove(),200)};
  $('[data-rx]',c).onclick=close;
  $('[data-ro]',c).onclick=()=>{close();openNote(s.id,n.id)};
  $$('[data-rs]',c).forEach(b=>b.onclick=()=>{snooze(n,b.dataset.rs);close()});
  const rd=$('[data-rd]',c);if(rd)rd.onclick=()=>{moveNote(s,n.id,done.id);close();toast('Erledigt: '+noteLabel(n))};
  box.appendChild(c);while(box.children.length>4)box.firstChild.remove();
  if(WEB&&IOS)setTimeout(close,60000)}
function snooze(n,v){let d;if(v==='tomorrow'){d=new Date();d.setDate(d.getDate()+1);d.setHours(8,0,0,0)}else d=new Date(Date.now()+(+v)*6e4);
  n.remind='at:'+localStamp(d);n.updated=now();save();render();toast('Erinnere dich wieder: '+fmtRemind(d))}

/* Anstehende Erinnerungen (für „Heute“ und die Planung) */
function upcomingReminders(days=30,max=200){const nw=Date.now(),end=nw+days*864e5,L=[];
  for(const{s,n}of allNotes()){if(n.archived||isDone(s,n))continue;const t=remindAt(n);if(!t)continue;const tt=+t;if(tt<=nw-6e4||tt>end)continue;L.push({s,n,t})}
  return L.sort((a,b)=>a.t-b.t).slice(0,max)}

/* ---------- Mitteilungen auf diesem Gerät ---------- */
const PUSHKEY='kanban-notizen-push';
const pushCfg=(()=>{try{return JSON.parse(localStorage.getItem(PUSHKEY)||'{}')}catch(e){return{}}})();
function pushSave(){try{localStorage.setItem(PUSHKEY,JSON.stringify(pushCfg))}catch(e){}}
const pushOn=()=>!!pushCfg.on;
const deviceId=()=>{if(!pushCfg.dev){pushCfg.dev=newCode().slice(0,12);pushSave()}return pushCfg.dev};
const PUSH_OK='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;

/* ---------- Web Push: Inhalt für ein Ziel-Gerät verschlüsseln (RFC 8291, aes128gcm) ---------- */
const te8=new TextEncoder();
const cat8=(...a)=>{const o=new Uint8Array(a.reduce((s,x)=>s+x.length,0));let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};
async function hkdf(salt,ikm,info,len){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,len*8))}
async function webpushEncrypt(sub,obj){
  const ua=b64d(unb64url(sub.p256dh)),auth=b64d(unb64url(sub.auth));
  const kp=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const asPub=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));
  const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},kp.privateKey,256));
  const ikm=await hkdf(auth,shared,cat8(te8.encode('WebPush: info\0'),ua,asPub),32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(salt,ikm,te8.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdf(salt,ikm,te8.encode('Content-Encoding: nonce\0'),12);
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,cat8(te8.encode(JSON.stringify(obj)),new Uint8Array([2]))));
  const hdr=new Uint8Array(21);hdr.set(salt,0);new DataView(hdr.buffer).setUint32(16,4096);hdr[20]=65;
  return b64e(cat8(hdr,asPub,ct))}

/* ---------- Push auf diesem iPhone ein-/ausschalten ---------- */
async function pushSubscription(){const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription()}
async function pushRegister(sub){const j=sub.toJSON();
  await rpc('kn_sub_upsert',{p_token:sy.cfg.token,p_id:deviceId(),p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_label:IOS?'iPhone':'Browser'})}
async function pushEnable(){
  if(!PUSH_OK){toast(IOS?'Push braucht iOS 16.4 oder neuer und die App vom Home-Bildschirm.':'Dieses Gerät unterstützt keine Push-Mitteilungen.');return}
  if(IOS&&!STANDALONE){toast('Push geht nur in der App vom Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm).');return}
  if(!sy.cfg){toast('Richte zuerst die Synchronisation ein – darüber laufen die Push-Mitteilungen.');return}
  try{const p=await Notification.requestPermission();if(p!=='granted'){toast('Mitteilungen sind nicht erlaubt. iPhone-Einstellungen → Mitteilungen → Notizen.');refreshRemindUI();return}
    const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64d(unb64url(VAPID_PUBLIC))});
    await pushRegister(sub);pushCfg.on=true;pushCfg.sig='';pushSave();subsCache=null;
    await pushReschedule(true);refreshRemindUI();toast('Push-Mitteilungen sind eingeschaltet')}
  catch(e){console.warn(e);toast('Einschalten fehlgeschlagen: '+(e.message||e))}}
async function pushDisable(){try{const sub=await pushSubscription();if(sub)await sub.unsubscribe()}catch(e){}
  try{if(sy.cfg)await rpc('kn_sub_delete',{p_token:sy.cfg.token,p_id:deviceId()})}catch(e){}
  pushCfg.on=false;pushSave();subsCache=null;refreshRemindUI();toast('Push-Mitteilungen ausgeschaltet')}
async function pushTest(){if(!sy.cfg||!pushOn())return;
  try{const subs=await rpc('kn_sub_list',{p_token:sy.cfg.token}),me=subs.find(x=>x.id===deviceId());
    if(!me){toast('Dieses Gerät ist nicht angemeldet – bitte Push aus- und wieder einschalten.');return}
    const payload=await webpushEncrypt(me,{title:'⏰ Test-Erinnerung',body:'So kommen deine Erinnerungen an – auch wenn die App geschlossen ist.',tag:'kn-test'});
    await rpc('kn_job_now',{p_token:sy.cfg.token,p_sub:me.id,p_key:'test@'+Date.now(),p_payload:payload});
    toast('Test-Mitteilung kommt innerhalb einer Minute. Du kannst die App jetzt schliessen.')}
  catch(e){toast('Test fehlgeschlagen: '+(e.message||e))}}

/* ---------- Planung auf dem Server (von jedem Gerät aus, für alle iPhones) ---------- */
let subsCache=null,schedT=0,scheduling=false;
async function getSubs(){if(subsCache&&Date.now()-subsCache.at<6e5)return subsCache.list;
  const list=await rpc('kn_sub_list',{p_token:sy.cfg.token});subsCache={at:Date.now(),list};return list}
function pushSchedule(){clearTimeout(schedT);schedT=setTimeout(()=>pushReschedule(false),3000)}
async function pushReschedule(force){if(!sy.cfg||!sy.key||!tv.loaded||scheduling)return;scheduling=true;
  try{const subs=await getSubs();
    const L=upcomingReminders(30,150).map(x=>({key:remindKey(x.n,x.t),at:x.t.toISOString(),title:'⏰ '+noteLabel(x.n),body:remindBody(x.s,x.n),tag:'kn-'+x.n.id,open:{sid:x.s.id,nid:x.n.id}}));
    const sig=hsh(JSON.stringify([L,subs.map(s=>s.id+s.p256dh)]));
    if(!force&&sig===pushCfg.sig&&Date.now()-(pushCfg.sigAt||0)<36e5)return;
    const jobs=[];
    for(const s of subs)for(const r of L)jobs.push({key:r.key,sub:s.id,fire_at:r.at,payload:await webpushEncrypt(s,{title:r.title,body:r.body,tag:r.tag,open:r.open})});
    if(subs.length||pushCfg.sig)await rpc('kn_jobs_replace',{p_token:sy.cfg.token,p_jobs:jobs});
    pushCfg.sig=sig;pushCfg.sigAt=Date.now();pushSave()}
  catch(e){console.warn('Erinnerungen planen',e)}
  finally{scheduling=false}}
setInterval(()=>pushReschedule(false),15*6e4);

/* Beim Start: Push-Abo prüfen, Link aus einer Mitteilung öffnen */
async function remindStart(){
  const m=location.search.match(/[?&]open=([\w-]+)\.([\w-]+)/);
  if(m){try{history.replaceState(null,'',location.pathname)}catch(e){}setTimeout(()=>openNote(m[1],m[2]),300)}
  if(WEB&&pushOn()&&PUSH_OK&&sy.cfg){try{const sub=await pushSubscription();if(sub)await pushRegister(sub);else{pushCfg.on=false;pushSave();await rpc('kn_sub_delete',{p_token:sy.cfg.token,p_id:deviceId()})}}catch(e){}}
  checkReminders();pushReschedule(false)}

/* ---------- PC: Infobereich und Autostart ---------- */
const desk={prefs:null,auto:null};
async function deskLoad(){if(!TAURI)return;try{desk.prefs=await tInvoke('get_prefs')}catch(e){desk.prefs=null}
  try{desk.auto=TAURI.autostart?await TAURI.autostart.isEnabled():null}catch(e){desk.auto=null}}

/* ---------- Einstellungen ---------- */
function remindPanelHTML(){const S=DB.settings,up=upcomingReminders(7,5);
  const list=up.length?`<div class="rem-up">${up.map(x=>`<button type="button" class="rem-it" data-act="openNote" data-nsid="${x.s.id}" data-nid="${x.n.id}"><span class="rem-t">${esc(fmtRemind(x.t))}</span><span>${esc(noteLabel(x.n))}</span></button>`).join('')}</div>`:'<p class="muted sm">Keine Erinnerungen in den nächsten 7 Tagen.</p>';
  let dev='';
  if(TAURI){const p=desk.prefs;
    dev=`<div class="chk-col"><label class="chk"><input type="checkbox" id="rOs"${S.osNotify!==false?' checked':''}> Windows-Mitteilung anzeigen</label>
      ${p?`<label class="chk"><input type="checkbox" id="rTray"${p.close_to_tray?' checked':''}> Beim Schliessen im Infobereich weiterlaufen <span class="muted sm">– nötig, damit Erinnerungen auch bei geschlossenem Fenster kommen</span></label>`:''}
      ${desk.auto!==null?`<label class="chk"><input type="checkbox" id="rAuto"${desk.auto?' checked':''}> Mit Windows starten <span class="muted sm">– unsichtbar im Infobereich</span></label>`:''}</div>
      <div class="row-btns"><button class="btn" id="rTestPc">Test-Mitteilung</button></div>`}
  else{const on=pushOn(),perm='Notification' in window?Notification.permission:'unsupported';
    dev=`<div class="store-state"><span class="dotst ${on?'ok':'warn'}"></span><div><b>Push auf diesem ${IOS?'iPhone':'Gerät'}: ${on?'eingeschaltet':'aus'}</b><div class="muted sm">${on?'Erinnerungen kommen als Mitteilung, auch wenn die App geschlossen ist.':!sy.cfg?'Braucht die Synchronisation (unten).':IOS&&!STANDALONE?'Geht nur in der App vom Home-Bildschirm.':perm==='denied'?'Mitteilungen sind blockiert – iPhone-Einstellungen → Mitteilungen → Notizen.':'Tippe auf „Einschalten“ und erlaube Mitteilungen.'}</div></div></div>
      <div class="row-btns">${on?'<button class="btn" id="rTest">Test-Mitteilung</button><button class="btn ghost" id="rOff">Ausschalten</button>':`<button class="btn primary" id="rOn"${PUSH_OK?'':' disabled'}>Einschalten</button>`}</div>`}
  return`<div class="panel" id="remPanel"><h3>Erinnerungen</h3><p>Lege im Editor einer Notiz bei <b>Erinnerung</b> fest, wann du erinnert werden willst – zum Termin, eine bestimmte Zeit vorher oder zu einer eigenen Zeit.${sy.cfg?' Erinnerungen vom PC kommen dank Synchronisation auch aufs iPhone.':''}</p>
    ${dev}<div class="ed-sec-h" style="margin-top:12px">Nächste Erinnerungen</div>${list}</div>`}
function bindRemindPanel(el){const on=(id,ev,f)=>{const x=$('#'+id,el);if(x)x[ev]=f};
  on('rOn','onclick',pushEnable);on('rOff','onclick',pushDisable);on('rTest','onclick',pushTest);
  on('rOs','onchange',e=>{DB.settings.osNotify=e.target.checked;save(true)});
  on('rTray','onchange',async e=>{try{desk.prefs=await tInvoke('set_prefs',{prefs:{close_to_tray:e.target.checked}});toast(e.target.checked?'Die App läuft beim Schliessen im Infobereich weiter':'Schliessen beendet die App – dann kommen keine Erinnerungen')}catch(x){toast('Speichern fehlgeschlagen')}});
  on('rAuto','onchange',async e=>{try{e.target.checked?await TAURI.autostart.enable():await TAURI.autostart.disable();desk.auto=await TAURI.autostart.isEnabled();toast(desk.auto?'Startet ab jetzt mit Windows':'Startet nicht mehr mit Windows')}catch(x){toast('Autostart konnte nicht geändert werden');e.target.checked=!e.target.checked}});
  on('rTestPc','onclick',()=>notify('⏰ Test-Erinnerung','So sehen deine Erinnerungen aus.','kn-test',null,true))}
function refreshRemindUI(){const p=$('#remPanel');if(p){p.outerHTML=remindPanelHTML();bindRemindPanel($('#remPanel').parentNode)}}
