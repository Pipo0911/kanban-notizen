/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Notara · App-Sperre: PIN oder Passwort beim Öffnen und nach Inaktivität.
   Gilt pro Gerät (wird nicht synchronisiert). Gespeichert wird nur ein PBKDF2-Hash, nie die PIN selbst.
   Die Sperre schützt vor fremden Blicken; die Notizdatei selbst wird dadurch nicht verschlüsselt. */
'use strict';
const LOCKKEY='kanban-notizen-lock';
const LOCK_AFTER=[[0,'Nur beim Öffnen der App'],[1,'Nach 1 Minute ohne Eingabe'],[5,'Nach 5 Minuten ohne Eingabe'],[15,'Nach 15 Minuten ohne Eingabe'],[30,'Nach 30 Minuten ohne Eingabe'],[60,'Nach 1 Stunde ohne Eingabe']];
const LOCK_IC='<svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const lockCfg=()=>{try{const c=JSON.parse(localStorage.getItem(LOCKKEY)||'null');return c&&c.hash&&c.salt?c:null}catch(e){return null}};
const lockSave=c=>{try{c?localStorage.setItem(LOCKKEY,JSON.stringify(c)):localStorage.removeItem(LOCKKEY)}catch(e){}};
const lb64=u=>btoa(String.fromCharCode(...new Uint8Array(u))),lunb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function lockHash(secret,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveBits']);
  return lb64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:150000},k,256))}
async function lockVerify(secret){const c=lockCfg();if(!c)return true;return await lockHash(String(secret),lunb64(c.salt))===c.hash}
async function lockSet(kind,secret,after){const salt=crypto.getRandomValues(new Uint8Array(16));
  lockSave({kind,salt:lb64(salt),hash:await lockHash(String(secret),salt),after:+after||0,fails:0,until:0})}
const lockValid=(kind,v)=>kind==='pin'?/^\d{4,12}$/.test(v):String(v).length>=4;

/* ---------- Sperren und Entsperren ---------- */
let locked=!!lockCfg(),lastAct=Date.now();
if(locked)document.documentElement.classList.add('locked');
const isLocked=()=>locked;
function lockNow(){if(!lockCfg())return;locked=true;document.documentElement.classList.add('locked');
  if(typeof closeMenu==='function')closeMenu();$$('.cpick,.wb-pop').forEach(x=>x.remove());
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();showLock()}
function unlock(){locked=false;lastAct=Date.now();document.documentElement.classList.remove('locked');const d=$('#lockDlg');if(d){d.dataset.ok='1';d.close();d.remove()}}
function showLock(){const c=lockCfg();if(!c){unlock();return}let d=$('#lockDlg');
  if(!d){d=document.createElement('dialog');d.id='lockDlg';d.className='lock-dlg';d.setAttribute('aria-label','Notara ist gesperrt');document.body.appendChild(d);
    d.addEventListener('cancel',e=>e.preventDefault());d.addEventListener('close',()=>{if(locked&&!d.dataset.ok)setTimeout(()=>{if(locked)d.showModal()},0)})}
  const pin=c.kind==='pin';
  d.innerHTML=`<div class="lock-box"><div class="lock-logo">${LOCK_IC}</div><h2>Notara ist gesperrt</h2>
    <form id="lockF" autocomplete="off"><input id="lockIn" type="password" ${pin?'inputmode="numeric" pattern="[0-9]*" maxlength="12"':'maxlength="200"'} autocomplete="current-password" placeholder="${pin?'PIN':'Passwort'}" aria-label="${pin?'PIN':'Passwort'}">
    <button class="btn primary" id="lockGo">Entsperren</button></form><div class="lock-err" id="lockErr" role="alert"></div>
    <button type="button" class="btn ghost sm" id="lockForgot">${pin?'PIN':'Passwort'} vergessen?</button></div>`;
  if(!d.open)d.showModal();
  const inp=$('#lockIn',d),err=$('#lockErr',d),f=$('#lockF',d);
  const wait=()=>{const cc=lockCfg();return cc&&cc.until>Date.now()?Math.ceil((cc.until-Date.now())/1000):0};
  const tick=()=>{const s=wait();if(s){err.textContent=`Zu viele Fehlversuche. Bitte ${s} Sekunden warten.`;inp.disabled=true;setTimeout(tick,1000)}else if(inp.disabled){inp.disabled=false;err.textContent='';inp.focus()}};
  f.onsubmit=async e=>{e.preventDefault();if(wait())return;const v=inp.value;if(!v)return;$('#lockGo',d).disabled=true;
    const ok=await lockVerify(v);$('#lockGo',d).disabled=false;const cc=lockCfg();
    if(ok){if(cc){cc.fails=0;cc.until=0;lockSave(cc)}unlock();return}
    if(cc){cc.fails=(cc.fails||0)+1;if(cc.fails>=5)cc.until=Date.now()+Math.min(900,30*2**(cc.fails-5))*1000;lockSave(cc)}
    inp.value='';err.textContent=pin?'Falsche PIN.':'Falsches Passwort.';const b=$('.lock-box',d);b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');tick();inp.focus()};
  $('#lockForgot',d).onclick=()=>lockForgot(d);
  tick();setTimeout(()=>inp.focus(),50)}
function lockForgot(d){const syncOn=typeof sy!=='undefined'&&sy.cfg;
  d.innerHTML=`<div class="lock-box wide"><div class="lock-logo">${LOCK_IC}</div><h2>Dieses Gerät zurücksetzen?</h2>
    <p>Ohne PIN oder Passwort lässt sich die Sperre nur aufheben, indem Notara auf diesem Gerät zurückgesetzt wird:</p>
    <ul><li>Alle Notizen auf diesem Gerät werden gelöscht${TAURI?' (die täglichen Sicherungen im Ordner „Backups“ bleiben erhalten)':''}.</li>
    <li>Die Synchronisation wird auf diesem Gerät getrennt. ${syncOn?'Deine Notizen bleiben in der Cloud und auf deinen anderen Geräten. Verbinde danach dieses Gerät wieder mit dem QR-Code, dann sind sie zurück.':'<b>Da die Synchronisation nicht eingerichtet ist, gibt es keine Kopie in der Cloud.</b>'}</li></ul>
    <label class="lock-confirm"><input type="checkbox" id="lockYes"> Ich habe verstanden</label>
    <div class="row-btns"><button type="button" class="btn ghost" id="lockBack">Zurück</button><button type="button" class="btn danger-solid" id="lockReset" disabled>Zurücksetzen</button></div></div>`;
  $('#lockYes',d).onchange=e=>{$('#lockReset',d).disabled=!e.target.checked};
  $('#lockBack',d).onclick=showLock;
  $('#lockReset',d).onclick=async()=>{$('#lockReset',d).disabled=true;
    try{if(TAURI){DB=normDB({});await save(true)}}catch(e){}
    try{Object.keys(localStorage).filter(k=>k.startsWith('kanban-notizen')).forEach(k=>localStorage.removeItem(k))}catch(e){}
    location.reload()}}

/* ---------- Inaktivität ---------- */
['pointerdown','keydown','wheel','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{if(!locked)lastAct=Date.now()},{capture:true,passive:true}));
function lockIdleCheck(){const c=lockCfg();if(!c||locked||!(c.after>0))return;if(Date.now()-lastAct>c.after*60000)lockNow()}
setInterval(lockIdleCheck,10000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')lockIdleCheck()});
/* Solange gesperrt: keine Tastenkürzel, Klicks oder Einfügen ausserhalb der Sperrmaske */
['keydown','keyup','paste','click','dblclick','contextmenu'].forEach(ev=>window.addEventListener(ev,e=>{if(locked&&!(e.target.closest&&e.target.closest('#lockDlg'))){e.stopPropagation();if(ev!=='keyup')e.preventDefault()}},true));
function lockBoot(){if(locked)showLock()}

/* ---------- Einstellungen ---------- */
function lockPanelHTML(){const c=lockCfg();
  return`<div class="panel" id="lockPanel"><h3>App-Sperre</h3><p>Beim Öffnen fragt Notara nach einer PIN oder einem Passwort, bevor deine Notizen sichtbar sind. Die Sperre gilt nur für dieses Gerät.</p>
    ${c?`<p class="lock-state on">${LOCK_IC}<b>Eingeschaltet</b> · mit ${c.kind==='pin'?'PIN':'Passwort'}</p>
      <div class="fld" style="max-width:360px"><label for="lkAfter">Automatisch sperren</label><select id="lkAfter">${LOCK_AFTER.map(([v,l])=>`<option value="${v}"${v===(c.after||0)?' selected':''}>${l}</option>`).join('')}</select><small>Zusätzlich wird bei jedem Öffnen der App gesperrt.</small></div>
      <div class="row-btns"><button class="btn primary" id="lkNow">Jetzt sperren</button><button class="btn" id="lkChange">${c.kind==='pin'?'PIN':'Passwort'} ändern</button><button class="btn ghost" id="lkOff">Ausschalten</button></div>`
     :`<p class="lock-state">${LOCK_IC}<b>Ausgeschaltet</b></p><div class="row-btns"><button class="btn primary" id="lkOn">Sperre einrichten</button></div>`}
    <small>Die Sperre schützt vor neugierigen Blicken. Die Notizdatei wird dadurch nicht verschlüsselt.</small></div>`}
function bindLockPanel(el){const c=lockCfg(),on=(id,f)=>{const b=$('#'+id,el);if(b)b.onclick=f};
  const kindF=v=>({name:'kind',label:'Art',type:'select',options:[['pin','PIN (4–12 Ziffern)'],['pw','Passwort (mind. 4 Zeichen)']],value:v||'pin'});
  const newF=[{name:'a',label:'Neue PIN / neues Passwort',type:'password',required:true,maxlength:200},{name:'b',label:'Wiederholen',type:'password',required:true,maxlength:200}];
  const check=r=>{if(r.a!==r.b){toast('Die beiden Eingaben stimmen nicht überein');return false}if(!lockValid(r.kind,r.a)){toast(r.kind==='pin'?'Die PIN muss aus 4 bis 12 Ziffern bestehen':'Das Passwort braucht mindestens 4 Zeichen');return false}return true};
  on('lkOn',async()=>{const r=await ask({title:'App-Sperre einrichten',text:'Merke dir die PIN oder das Passwort gut. Ohne sie lässt sich die Sperre nur durch Zurücksetzen dieses Geräts aufheben.',
      fields:[kindF('pin'),...newF,{name:'after',label:'Automatisch sperren',type:'select',options:LOCK_AFTER,value:5}],ok:'Einschalten'});
    if(!r||!check(r))return;await lockSet(r.kind,r.a,r.after);lastAct=Date.now();renderSide();renderContent();toast('App-Sperre eingeschaltet')});
  on('lkChange',async()=>{const r=await ask({title:'PIN oder Passwort ändern',fields:[{name:'cur',label:'Aktuelle '+(c.kind==='pin'?'PIN':'Passwort'),type:'password',required:true,maxlength:200},kindF(c.kind),...newF],ok:'Ändern'});
    if(!r)return;if(!await lockVerify(r.cur)){toast(c.kind==='pin'?'Die aktuelle PIN ist falsch':'Das aktuelle Passwort ist falsch');return}
    if(!check(r))return;await lockSet(r.kind,r.a,c.after);renderContent();toast('Gespeichert')});
  on('lkOff',async()=>{const r=await ask({title:'App-Sperre ausschalten?',fields:[{name:'cur',label:c.kind==='pin'?'PIN':'Passwort',type:'password',required:true,maxlength:200}],ok:'Ausschalten',danger:true});
    if(!r)return;if(!await lockVerify(r.cur)){toast(c.kind==='pin'?'Falsche PIN':'Falsches Passwort');return}lockSave(null);renderSide();renderContent();toast('App-Sperre ausgeschaltet')});
  on('lkNow',lockNow);
  const sel=$('#lkAfter',el);if(sel)sel.onchange=()=>{const cc=lockCfg();if(cc){cc.after=+sel.value;lockSave(cc);lastAct=Date.now();toast('Gespeichert')}}}
