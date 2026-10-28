/* Kanban Notizen · Globale Ereignisse und Start */
'use strict';
/* ============ Globale Ereignisse ============ */
const ACTIONS={newSpace:()=>createSpace(''),newFolder:()=>createFolder(''),addMenu:a=>{const[x,y]=menuAt(a);addMenu(x,y,'')},view:a=>setView(a.dataset.v),create:()=>createNote(sp().id),menu:()=>$('.app').classList.toggle('menu-open'),
  clearF:()=>{ui.filters=blankF();renderFbar();renderContent()},addCol:()=>addCol(),palette:()=>openPalette(),help:()=>showHelp(),
  checkUpdate:()=>checkUpdate(true),installUpdate:()=>installUpdate(),
  backupNow:()=>backupAll(),daily:()=>openDaily(today()),openNote:a=>openNote(a.dataset.nsid,a.dataset.nid),
  openRun:()=>{const r=runningTimer();if(r)openNote(r.s.id,r.n.id)},stopRun:()=>{const r=runningTimer();if(r)stopTimer(r.s,r.n)}};
document.addEventListener('click',e=>{if(e.target.closest('dialog'))return;
  const tl=e.target.closest('[data-fadd],[data-fmenu],[data-smenu]');
  if(tl){e.stopPropagation();const[x,y]=menuAt(tl);if(tl.dataset.fadd)addMenu(x,y,tl.dataset.fadd);else if(tl.dataset.fmenu)folderMenu(folderById(tl.dataset.fmenu),x,y);else spaceMenu(spaceById(tl.dataset.smenu),x,y);return}
  const fo=e.target.closest('[data-folder]');if(fo){toggleFolder(fo.dataset.folder);return}
  const sb=e.target.closest('[data-space]');if(sb){goSpace(sb.dataset.space);return}
  const a=e.target.closest('[data-act]');if(a&&ACTIONS[a.dataset.act])ACTIONS[a.dataset.act](a,e)});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#ctx')){e.preventDefault();closeMenu();return}
  if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();if(!$('#pal').open&&!$('#dlg2').open){if($('#dlg').open)$('#dlg').close();openPalette()}return}
  if($('#dlg').open||$('#dlg2').open||$('#pal').open||$('#lightbox').open)return;
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
  const v=DB.ui.view,k=e.key.toLowerCase();
  if(k==='n'||k==='c'){e.preventDefault();createNote(sp().id)}
  else if(e.key==='/'){const q=$('#q');if(q){e.preventDefault();q.focus()}else{e.preventDefault();openPalette()}}
  else if(e.key==='?'){e.preventDefault();showHelp()}
  else if(k==='d'){e.preventDefault();openDaily(today())}
  else if(k==='h')setView('today');else if(k==='z')setView('time');
  else if(k==='t'){const r=runningTimer();if(r)stopTimer(r.s,r.n)}
  else if(['1','2','3','4'].includes(e.key))setView(SPACE_VIEWS[+e.key-1])});
/* ============ Start ============ */
{const u=loadUi();DB=normDB({ui:u.ui,active:u.active})}
applyTheme();render();setStatus(DEV?'Entwicklungsmodus':'Lade Notizen …',DEV);
tauriInit().then(checkReminders);
