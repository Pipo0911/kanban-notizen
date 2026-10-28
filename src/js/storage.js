/* Kanban Notizen · Speichern in die Datendatei, Desktop-Verhalten, Updates */
'use strict';
/* ============ Speichern (Desktop-App) ============ */
/* Die Notizen liegen als JSON-Datei auf der Festplatte (Rust-Seite: src-tauri/src/lib.rs).
   Wird die Oberfläche im Browser geöffnet, läuft sie im Entwicklungsmodus ohne Speichern. */
const TAURI=window.__TAURI__&&window.__TAURI__.core?window.__TAURI__:null;
const DEV=!TAURI;
const tv={on:!DEV,path:'',mtime:0,dirty:false,writing:false,timer:0,isDefault:true,loaded:false};
const UIKEY='kanban-notizen-ui';
const tInvoke=(c,a)=>TAURI.core.invoke(c,a);
function loadUi(){try{return JSON.parse(localStorage.getItem(UIKEY)||'{}')}catch(e){return{}}}
function saveUi(){try{localStorage.setItem(UIKEY,JSON.stringify({ui:DB.ui,active:DB.active}))}catch(e){}}
function fileFields(d){return{folders:d.folders,spaces:d.spaces,settings:d.settings,trash:d.trash,history:d.history}}
function applyFileData(d){DB=normDB(Object.assign(fileFields(d),{active:DB.active,ui:DB.ui}));applyTheme();render()}
async function tauriInfo(){const i=await tInvoke('data_info');tv.path=i.path;tv.isDefault=i.is_default;return i}
async function tauriLoad(){const i=await tauriInfo();const txt=await tInvoke('load_data');
  if(txt&&txt.trim()){const d=JSON.parse(txt);if(!Array.isArray(d.spaces))throw new Error('Die Datei enthält keine Kanban-Notizen');applyFileData(d);tv.mtime=i.mtime;return true}return false}
/* Einmalige Übernahme aus Version 1.0 (damals lagen die Notizen im Speicher des Fensters) */
function legacyLocal(){try{const r=localStorage.getItem('kanban-notizen-office-v1');return r?JSON.parse(r):null}catch(e){return null}}
async function tauriInit(){
  if(DEV){tv.loaded=true;setStatus('Entwicklungsmodus – Änderungen werden nicht gespeichert',true);render();return}
  try{upd.current=await TAURI.app.getVersion()}catch(e){}
  setTimeout(()=>checkUpdate(false),4000);setInterval(()=>checkUpdate(false),6*3600e3);
  try{
    if(await tauriLoad())setStatus('Geladen · '+hhmm());
    else{const old=legacyLocal();if(old&&Array.isArray(old.spaces))applyFileData(old);tv.loaded=true;await tauriWrite();toast('Deine Notizen werden hier gespeichert: '+tv.path)}
    tv.loaded=true;purgeTrash()}
  catch(e){console.warn(e);setStatus('Datei konnte nicht gelesen werden: '+e,true)}
  render()}
function tauriSchedule(){tv.dirty=true;clearTimeout(tv.timer);tv.timer=setTimeout(tauriWrite,400)}
async function tauriWrite(){if(DEV||!tv.loaded)return;if(tv.writing){tauriSchedule();return}tv.writing=true;
  try{tv.mtime=await tInvoke('save_data',{json:JSON.stringify(payload()),day:today()});tv.dirty=false;setStatus('Gespeichert · '+hhmm())}
  catch(e){setStatus('Speichern fehlgeschlagen: '+e,true)}finally{tv.writing=false}}
function save(quiet){saveUi();if(DEV){if(!quiet)setStatus('Entwicklungsmodus – nicht gespeichert',true);return}if(!tv.loaded)return;tauriSchedule()}
/* Änderungen von einem anderen PC (z. B. über OneDrive) übernehmen, sobald das Fenster aktiv wird */
let pendingExternal=false;
async function checkFileChanged(){if(DEV||!tv.loaded||tv.dirty||tv.writing)return;
  try{const i=await tInvoke('data_info');if(i.mtime&&i.mtime>tv.mtime+1){if(busy()){pendingExternal=true;return}await tauriLoad();toast('Neuere Version aus der Datei geladen')}}catch(e){}}
function applyExternal(){if(!pendingExternal||busy())return;pendingExternal=false;checkFileChanged()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkFileChanged()});
window.addEventListener('focus',checkFileChanged);
window.addEventListener('beforeunload',()=>{if(tv.dirty)tauriWrite()});
function setStatus(t,err){statusMsg=t;statusErr=!!err;const el=$('#status');if(el){el.textContent=t;el.className='status'+(statusErr?' err':'')}}
const busy=()=>$('#dlg').open||$('#dlg2').open||!!$('.inline-form')||!!drag;
const jsonFilter=[{name:'Kanban-Notizen',extensions:['json']}];
async function tauriNewFile(){const p=await TAURI.dialog.save({defaultPath:'kanban-notizen.json',filters:jsonFilter});if(!p)return;
  await tInvoke('set_data_path',{path:p});await tauriInfo();await tauriWrite();render();toast('Notizen werden jetzt hier gespeichert: '+tv.path)}
async function tauriOpenFile(){const p=await TAURI.dialog.open({multiple:false,directory:false,filters:jsonFilter});if(!p)return;
  const r=await ask({title:'Datei öffnen?',text:'Die Notizen aus dieser Datei ersetzen die aktuell angezeigten. Die bisherige Datei bleibt unverändert.',ok:'Öffnen'});if(!r)return;
  const old=tv.path;await tInvoke('set_data_path',{path:Array.isArray(p)?p[0]:p});
  try{if(!(await tauriLoad()))await tauriWrite();render();toast('Geöffnet: '+tv.path)}catch(e){await tInvoke('set_data_path',{path:tv.isDefault?null:old});await tauriInfo();toast('Öffnen fehlgeschlagen: '+e.message)}}
async function tauriResetPath(){const r=await ask({title:'Standard-Speicherort verwenden?',text:'Die App speichert danach wieder unter <b>Dokumente\\Kanban Notizen</b>. Liegt dort schon eine Datei, wird sie geladen.',ok:'Zurücksetzen'});if(!r)return;
  await tInvoke('set_data_path',{path:null});if(!(await tauriLoad()))await tauriWrite();render();toast('Standard-Speicherort aktiv')}
/* Desktop-Verhalten: kein Browser-Kontextmenü, kein Neuladen/Zoomen, keine gezogenen Bilder/Links */
if(tv.on){document.documentElement.classList.add('desktop');
  const editable=t=>t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"]');
  document.addEventListener('contextmenu',e=>{if(editable(e.target))return;const sel=String(window.getSelection()||'');if(sel.trim())return;e.preventDefault()});
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase(),c=e.ctrlKey||e.metaKey;
    if(e.key==='F5'||(c&&k==='r')||(c&&['+','-','=','0'].includes(e.key))||(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))||e.key==='BrowserBack'||e.key==='BrowserForward'){e.preventDefault()}},true);
  window.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
  document.addEventListener('dragstart',e=>{const t=e.target;if(t&&(t.tagName==='IMG'||t.tagName==='A'))e.preventDefault()});
  document.addEventListener('auxclick',e=>{if(e.button===1&&e.target.closest('a'))e.preventDefault()})}
/* Updates (nur Desktop-App): prüft beim Start und alle 6 Stunden */
window.addEventListener('focus',()=>{if(tv.on&&upd.state!=='available'&&Date.now()-(upd.lastCheck||0)>36e5)checkUpdate(false)});
const upd={lastCheck:0,state:'',version:'',current:'',update:null,progress:0,dismissed:false,notes:''};
async function checkUpdate(manual){
  upd.lastCheck=Date.now();
  if(DEV||!TAURI.updater){if(manual)toast('Updates gibt es nur in der installierten App.');return}
  if(upd.state==='downloading'||upd.state==='installing')return;
  upd.state='checking';refreshUpdateUI();
  try{const u=await TAURI.updater.check();
    if(u){const isNew=upd.version!==u.version;upd.update=u;upd.version=u.version;upd.notes=u.body||'';upd.state='available';if(manual)upd.dismissed=false;
      if(isNew){toast(`Neue Version ${u.version} ist verfügbar`,{open:installUpdate,openLabel:'Jetzt installieren'});
        if(DB.settings.notify&&'Notification' in window&&Notification.permission==='granted'){try{const no=new Notification('Kanban Notizen '+u.version+' ist verfügbar',{body:'Klicke in der App auf „Jetzt aktualisieren“.',tag:'kn-update'});no.onclick=()=>window.focus()}catch(e){}}}}
    else{upd.state='none';upd.update=null;if(manual)toast(`Du hast die neueste Version (${upd.current||'?'}).`)}}
  catch(e){console.warn(e);upd.state='error';if(manual)toast('Update-Prüfung fehlgeschlagen. Bist du online?')}
  refreshUpdateUI()}
async function installUpdate(){const u=upd.update;if(!u)return;
  clearTimeout(tv.timer);if(tv.dirty)await tauriWrite();
  upd.state='downloading';upd.progress=0;refreshUpdateUI();let total=0,got=0;
  try{await u.downloadAndInstall(ev=>{if(ev.event==='Started')total=(ev.data&&ev.data.contentLength)||0;
      else if(ev.event==='Progress'){got+=(ev.data&&ev.data.chunkLength)||0;upd.progress=total?Math.min(100,Math.round(got/total*100)):0;const el=$('#updProg');if(el)el.textContent=upd.progress+' %';const sl=$('.upd-go .sp-n');if(sl&&upd.state==='downloading')sl.textContent=`Lade Update … ${upd.progress} %`}
      else if(ev.event==='Finished'){upd.state='installing';refreshUpdateUI()}});
    await TAURI.process.relaunch()}
  catch(e){console.warn(e);upd.state='available';refreshUpdateUI();toast('Update fehlgeschlagen: '+e)}}
function refreshUpdateUI(){renderBanner();renderSide();if(DB.ui.view==='settings'&&ui.gtab==='general'&&!busy())renderContent()}
function updateLine(){const v=upd.current?`Version ${esc(upd.current)}`:'Version unbekannt';
  const st={checking:'Suche nach Updates …',none:'Neueste Version installiert',error:'Prüfung fehlgeschlagen',available:`Version ${esc(upd.version)} verfügbar`,downloading:'Lade Update …',installing:'Installiere …'}[upd.state]||'';
  return`<div class="panel"><h3>Updates</h3><div class="row-btns"><span><b>${v}</b>${st?` · <span class="muted">${st}</span>`:''}</span><span class="spacer"></span>${upd.state==='available'?'<button class="btn primary" id="uInstall">Jetzt aktualisieren</button>':''}<button class="btn" id="uCheck"${upd.state==='checking'||upd.state==='downloading'?' disabled':''}>Nach Updates suchen</button></div><small>Die App sucht beim Start und alle 6 Stunden automatisch nach neuen Versionen. Deine Notizen bleiben beim Update erhalten.</small></div>`}
function tauriStoreHTML(){return updateLine()+`<div class="panel"><h3>Speicherort</h3>
    <div class="store-state"><span class="dotst ok"></span><div><b>${tv.isDefault?'Standard-Speicherort':'Eigener Speicherort'}</b><div class="muted sm" style="word-break:break-all">${esc(tv.path)}</div></div></div>
    <p>Die Desktop-App speichert jede Änderung sofort in diese Datei und legt im Unterordner <b>Backups</b> jeden Tag automatisch eine Sicherung an (die letzten 30 Tage). Liegt die Datei in <b>OneDrive</b>, hast du auf einem zweiten PC mit derselben Datei dieselben Notizen.</p>
    <div class="row-btns"><button class="btn" id="tReveal">Ordner öffnen</button><button class="btn" id="tNew">Neuen Speicherort wählen …</button><button class="btn" id="tOpen">Bestehende Datei öffnen …</button>${tv.isDefault?'':'<button class="btn ghost" id="tReset">Standard verwenden</button>'}</div></div>`}
