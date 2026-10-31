/* Kanban Notizen · Seitenleiste, Kopfzeile, Filter, Kategorien-Baum */
'use strict';
/* ============ Navigation & Grundgerüst ============ */
function setView(v){DB.ui.view=v;$('.app').classList.remove('menu-open');save(true);render()}
function goSpace(id){DB.active=id;const gs=spaceById(id);if(gs)expandTo(gs.folder);if(!SPACE_VIEWS.includes(DB.ui.view))DB.ui.view='board';ui.filters=blankF();$('.app').classList.remove('menu-open');save(true);render()}
function applyTheme(){const t=DB.settings.theme;if(t==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t}
function render(){renderSide();renderHead();renderFbar();renderContent();renderBanner();renderTabbar()}
/* Untere Leiste auf dem Handy */
function renderTabbar(){const el=$('#tabbar');if(!el)return;const v=DB.ui.view,isSp=SPACE_VIEWS.includes(v),ct=countToday();
  const it=(act,icon,label,on,extra='')=>`<button class="tb-it${on?' on':''}" data-act="${act}"${extra}>${icon}<span>${label}</span></button>`;
  el.innerHTML=it('view',SVG.board,'Board',isSp,' data-v="board"')+it('view',SVG.today,'Heute',v==='today',' data-v="today"').replace('</span></button>',`</span>${ct?`<i class="tb-badge">${ct}</i>`:''}</button>`)
    +`<button class="tb-new" data-act="create" aria-label="Neue Notiz">+</button>`
    +it('daily',SVG.daily,'Tag',false)+it('palette',SVG.search.replace(/14/g,'18'),'Suchen',false)}
function countToday(){let n=0;for(const x of allNotes()){const st=dueState(x.s,x.n);if(st==='late'||(x.n.due===today()&&!isDone(x.s,x.n)))n++}return n}
function renderBanner(){const b=$('#banner');
  if(tv.on&&['available','downloading','installing'].includes(upd.state)&&!(upd.state==='available'&&upd.dismissed)){b.hidden=false;
    if(upd.state==='available'){b.innerHTML=`<span>Neue Version <b>${esc(upd.version)}</b> ist verfügbar${upd.current?` (installiert: ${esc(upd.current)})`:''}.</span><button class="btn sm primary" id="updGo">Jetzt aktualisieren</button><button class="btn sm ghost" id="updLater">Später</button>`;
      $('#updGo').onclick=installUpdate;$('#updLater').onclick=()=>{upd.dismissed=true;renderBanner()}}
    else b.innerHTML=upd.state==='downloading'?'<span>Update wird heruntergeladen … <b id="updProg">'+upd.progress+' %</b></span>':'<span>Update wird installiert – die App startet gleich neu.</span>';
    return}
  if(WEB&&webUpdate){b.hidden=false;b.innerHTML='<span>Eine neue Version ist bereit.</span><button class="btn sm primary" id="webUpd">Jetzt neu laden</button>';$('#webUpd').onclick=webApplyUpdate}
  else b.hidden=true}
function renderSide(){const v=DB.ui.view,g=GLOBAL_VIEWS.includes(v),ct=countToday();
  $('#side').innerHTML=`<div class="brand"><span class="logo">${SVG.logo}</span><span>Notizen</span></div>
  <nav class="nav"><button class="nav-item${v==='today'?' on':''}" data-act="view" data-v="today">${SVG.today}<span class="sp-n">Heute &amp; Termine</span>${ct?`<span class="badge">${ct}</span>`:''}</button>
  <button class="nav-item" data-act="daily" title="Tagesnotiz von heute öffnen (Taste D)">${SVG.daily}<span class="sp-n">Tagesnotiz</span><span class="sp-c">${WD[dow(today())]} ${+today().slice(8)}.${+today().slice(5,7)}.</span></button>
  <button class="nav-item${v==='time'?' on':''}" data-act="view" data-v="time">${SVG.time}<span class="sp-n">Zeiterfassung</span>${runningTimer()?'<span class="badge soft">läuft</span>':''}</button></nav>
  ${favHTML()}
  <div class="side-h" data-dnd-root title="Hierher ziehen = oberste Ebene"><span>Spaces</span><button class="icon-btn sm" data-act="addMenu" title="Space oder Kategorie erstellen" aria-label="Erstellen">+</button></div>
  <nav class="nav" id="tree">${treeHTML('',0,g)}
  <div class="sp-item add" data-act="newSpace" role="button" tabindex="0"><span class="sav dashed">+</span><span class="sp-n">Space erstellen</span></div>
  <div class="sp-item add" data-act="newFolder" role="button" tabindex="0"><span class="sav dashed" style="border-radius:50%">${SVG.folder}</span><span class="sp-n">Kategorie erstellen</span></div></nav>
  <div class="side-foot">
  ${updNav()}
  <button class="nav-item${v==='trash'?' on':''}" data-act="view" data-v="trash">${SVG.trash}<span class="sp-n">Papierkorb</span>${DB.trash.length?`<span class="sp-c">${DB.trash.length}</span>`:''}</button>
  <button class="nav-item${v==='settings'?' on':''}" data-act="view" data-v="settings">${SVG.gear}<span>Einstellungen</span></button>
  <button class="nav-item" data-act="help">${SVG.key}<span>Tastenkürzel</span></button></div>`;bindTree()}
function treeHTML(parent,depth,g){let h='';const pad=d=>`padding-left:${8+d*16}px`;
  const actChain=new Set(folderChain((sp()||{}).folder).map(f=>f.id));
  DB.folders.filter(f=>f.parent===parent).forEach(f=>{const cnt=folderSpaces(f.id).reduce((a,x)=>a+live(x).filter(n=>!isDoneCol(x,n.colId)).length,0);
    h+=`<div class="sp-item fold${actChain.has(f.id)&&!g?' on-path':''}" data-folder="${f.id}" data-dnd="folder:${f.id}" draggable="true" role="button" tabindex="0" aria-expanded="${!f.collapsed}" style="${pad(depth)}" title="${esc(f.name)}"><span class="chev${f.collapsed?'':' open'}">›</span>${SVG.folder}<span class="sp-n">${esc(f.name)}</span>${cnt?`<span class="sp-c">${cnt}</span>`:''}<span class="row-tools"><button class="icon-btn xs" data-fadd="${f.id}" title="In „${esc(f.name)}“ erstellen" aria-label="Erstellen">+</button><button class="icon-btn xs" data-fmenu="${f.id}" title="Optionen" aria-label="Optionen">⋯</button></span></div>`;
    if(!f.collapsed){const inner=treeHTML(f.id,depth+1,g);h+=inner||`<div class="tree-empty" data-dnd-into="${f.id}" style="padding-left:${30+depth*16}px">Leer – Space hierher ziehen</div>`}});
  DB.spaces.filter(s=>s.folder===parent).forEach(s=>{
    h+=`<div class="sp-item${!g&&s.id===DB.active?' on':''}" data-space="${s.id}" data-dnd="space:${s.id}" draggable="true" role="button" tabindex="0" style="${pad(depth)}" title="${esc(spaceLabel(s))}"><span class="sav" style="background:${esc(s.color)}">${esc((s.name.trim()[0]||'?').toUpperCase())}</span><span class="sp-n">${esc(s.name)}</span><span class="sp-c">${live(s).filter(n=>!isDoneCol(s,n.colId)).length}</span><span class="row-tools"><button class="icon-btn xs" data-smenu="${s.id}" title="Optionen" aria-label="Optionen">⋯</button></span></div>`});
  return h}
/* Kategorien: Menüs, Erstellen, Verschieben, Ziehen */
function showMenu(x,y,items){closeMenu();const m=document.createElement('div');m.id='ctx';m.setAttribute('role','menu');
  m.innerHTML=items.map((it,k)=>it==='-'?'<div class="sep"></div>':it.cap?`<div class="cap">${esc(it.cap)}</div>`:`<button role="menuitem" data-k="${k}"${it.danger?' class="danger"':''}>${esc(it.t)}</button>`).join('');
  document.body.appendChild(m);const r=m.getBoundingClientRect();m.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  $$('button',m).forEach(b=>b.onclick=e=>{e.stopPropagation();const it=items[+b.dataset.k];closeMenu();it.run()});
  const f=$('button',m);if(f)f.focus();
  m.addEventListener('keydown',e=>{const bs=$$('button',m),i=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();bs[(i+1)%bs.length].focus()}else if(e.key==='ArrowUp'){e.preventDefault();bs[(i-1+bs.length)%bs.length].focus()}else if(e.key==='Escape'){e.preventDefault();closeMenu()}})}
function closeMenu(){const m=$('#ctx');if(m)m.remove()}
document.addEventListener('mousedown',e=>{if(!e.target.closest('#ctx'))closeMenu()},true);
window.addEventListener('blur',closeMenu);window.addEventListener('resize',closeMenu);
const menuAt=el=>{const r=el.getBoundingClientRect();return[r.left,r.bottom+4]};
function addMenu(x,y,fid){const f=fid&&folderById(fid);showMenu(x,y,[...(f?[{cap:f.name}]:[]),{t:'Space erstellen …',run:()=>createSpace(fid||'')},{t:f?'Unterkategorie erstellen …':'Kategorie erstellen …',run:()=>createFolder(fid||'')}])}
function folderMenu(f,x,y){const n=folderSpaces(f.id).length;showMenu(x,y,[{cap:f.name},{t:'Space hier erstellen …',run:()=>createSpace(f.id)},{t:'Unterkategorie erstellen …',run:()=>createFolder(f.id)},'-',
  {t:'Umbenennen …',run:()=>renameFolder(f)},{t:'Verschieben nach …',run:()=>moveFolderDlg(f)},{t:f.collapsed?'Aufklappen':'Zuklappen',run:()=>toggleFolder(f.id)},'-',{t:`Kategorie auflösen …${n?` (${n} Space${n===1?'':'s'} bleiben erhalten)`:''}`,danger:true,run:()=>deleteFolder(f)}])}
function spaceMenu(s,x,y){showMenu(x,y,[{cap:s.name},{t:'Öffnen',run:()=>goSpace(s.id)},{t:'Umbenennen …',run:()=>renameSpace(s)},{t:'In Kategorie verschieben …',run:()=>moveSpaceDlg(s)},{t:'Space-Einstellungen',run:()=>{DB.active=s.id;ui.stab='details';setView('spacecfg')}},{t:'Drucken / PDF',run:()=>printSpace(s)},'-',{t:'Space löschen …',danger:true,run:()=>deleteSpace(s)}])}
function toggleFolder(id){const f=folderById(id);if(!f)return;f.collapsed=!f.collapsed;save(true);renderSide()}
async function createFolder(parent){
  const r=await ask({title:parent?'Unterkategorie erstellen':'Kategorie erstellen',text:'Kategorien gruppieren deine Spaces in der Seitenleiste – z. B. „Kunden“ mit einem Space pro Kunde. Sie lassen sich beliebig verschachteln.',
    fields:[{name:'name',label:'Name',required:true,maxlength:60,placeholder:parent?'z. B. Kunden A–M':'z. B. Kunden'},{name:'parent',label:'Liegt in',type:'select',options:folderOptions(),value:parent||''}],ok:'Erstellen'});
  if(!r)return;const f={id:uid(),name:r.name.trim(),parent:r.parent,collapsed:false};DB.folders.push(f);expandTo(f.parent);save(true);renderSide();toast(`Kategorie „${f.name}“ erstellt`)}
async function renameFolder(f){const r=await ask({title:'Kategorie umbenennen',fields:[{name:'n',label:'Name',value:f.name,required:true,maxlength:60}],ok:'Speichern'});if(!r)return;f.name=r.n.trim()||f.name;save(true);render()}
async function renameSpace(s){const r=await ask({title:'Space umbenennen',fields:[{name:'n',label:'Name',value:s.name,required:true,maxlength:60}],ok:'Speichern'});if(!r)return;s.name=r.n.trim()||s.name;save();render()}
async function moveFolderDlg(f){const r=await ask({title:`„${f.name}“ verschieben`,fields:[{name:'p',label:'Neuer Ort',type:'select',options:folderOptions(f.id),value:f.parent}],ok:'Verschieben'});if(!r)return;
  f.parent=r.p;expandTo(f.parent);save(true);render();toast('Kategorie verschoben')}
async function moveSpaceDlg(s){const r=await ask({title:`„${s.name}“ verschieben`,fields:[{name:'p',label:'Kategorie',type:'select',options:folderOptions(),value:s.folder}],ok:'Verschieben'});if(!r)return;
  s.folder=r.p;expandTo(s.folder);save();render();toast(r.p?`Verschoben nach „${folderChain(r.p).map(x=>x.name).join(' › ')}“`:'Auf die oberste Ebene verschoben')}
async function deleteFolder(f){const subs=DB.folders.filter(x=>x.parent===f.id).length,sps=DB.spaces.filter(x=>x.folder===f.id).length,par=folderById(f.parent);
  const r=await ask({title:`Kategorie „${f.name}“ auflösen?`,text:`Es wird nichts gelöscht: ${sps||subs?`${sps} Space${sps===1?'':'s'}${subs?` und ${subs} Unterkategorie${subs===1?'':'n'}`:''} wandern nach <b>${par?esc(par.name):'oberste Ebene'}</b>.`:'Die Kategorie ist leer.'}`,ok:'Auflösen',danger:true});if(!r)return;
  const snap=JSON.stringify(DB);DB.folders.forEach(x=>{if(x.parent===f.id)x.parent=f.parent});DB.spaces.forEach(x=>{if(x.folder===f.id)x.folder=f.parent});DB.folders=DB.folders.filter(x=>x!==f);save();render();toast(`Kategorie „${f.name}“ aufgelöst`,{undo:snap})}
let treeDrag=null;
function clearDrop(){$$('#side .drop-before,#side .drop-after,#side .drop-into').forEach(x=>x.classList.remove('drop-before','drop-after','drop-into'))}
function dropPos(el,e){const[kind,id]=(el.dataset.dnd||'').split(':'),[sk,sid]=treeDrag.split(':');
  if(el.hasAttribute('data-dnd-root'))return'root';
  if(el.dataset.dndInto){if(sk==='folder'&&(sid===el.dataset.dndInto||isFolderInside(el.dataset.dndInto,sid)))return null;return'into'}
  if(treeDrag===el.dataset.dnd)return null;
  const r=el.getBoundingClientRect(),y=(e.clientY-r.top)/r.height;
  if(kind==='folder'){if(sk==='folder'&&isFolderInside(id,sid))return null;return y<.28?'before':y>.72?'after':'into'}
  return y<.5?'before':'after'}
function treeMove(src,tgtEl,pos){const[sk,sid]=src.split(':');let tk='',tid='';
  if(pos==='root'){}else if(tgtEl.dataset.dndInto){tk='folder';tid=tgtEl.dataset.dndInto}else[tk,tid]=tgtEl.dataset.dnd.split(':');
  if(sk==='space'){const s=spaceById(sid);if(!s)return;let parent='';
    if(pos==='root')parent='';else if(tk==='folder'){const f=folderById(tid);parent=pos==='into'?f.id:f.parent}else parent=spaceById(tid).folder;
    s.folder=parent;DB.spaces.splice(DB.spaces.indexOf(s),1);
    if(tk==='space'){let i=DB.spaces.indexOf(spaceById(tid));if(pos==='after')i++;DB.spaces.splice(i,0,s)}
    else if(tk==='folder'&&pos==='before'){const i=DB.spaces.findIndex(x=>x.folder===parent);DB.spaces.splice(i<0?DB.spaces.length:i,0,s)}
    else DB.spaces.push(s);
    expandTo(parent)}
  else{const f=folderById(sid);if(!f)return;
    if(pos==='root'){f.parent=''}
    else if(tk==='folder'){const t=folderById(tid);if(pos==='into'){f.parent=t.id;t.collapsed=false;DB.folders.splice(DB.folders.indexOf(f),1);DB.folders.push(f)}
      else{f.parent=t.parent;DB.folders.splice(DB.folders.indexOf(f),1);let i=DB.folders.indexOf(t);if(pos==='after')i++;DB.folders.splice(i,0,f)}}
    else f.parent=spaceById(tid).folder;
    expandTo(f.parent)}
  save(true);render()}
function bindTree(){const side=$('#side');
  $$('[data-dnd],[data-dnd-into],[data-dnd-root]',side).forEach(el=>{
    if(el.dataset.dnd){el.addEventListener('dragstart',e=>{treeDrag=el.dataset.dnd;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',el.textContent.trim())}catch(_){}setTimeout(()=>el.classList.add('dragsrc'),0)});
      el.addEventListener('dragend',()=>{treeDrag=null;clearDrop();el.classList.remove('dragsrc')})}
    el.addEventListener('dragover',e=>{if(!treeDrag)return;const pos=dropPos(el,e);if(!pos)return;e.preventDefault();e.dataTransfer.dropEffect='move';
      if(el.dataset.pos!==pos||!el.classList.contains('drop-'+(pos==='root'?'into':pos))){clearDrop();el.classList.add('drop-'+(pos==='root'?'into':pos))}el.dataset.pos=pos;
      if(el.dataset.folder){clearTimeout(el._open);const f=folderById(el.dataset.folder);if(f&&f.collapsed&&pos==='into')el._open=setTimeout(()=>{if(treeDrag){f.collapsed=false;renderSide()}},700)}});
    el.addEventListener('dragleave',e=>{if(!el.contains(e.relatedTarget)){el.classList.remove('drop-before','drop-after','drop-into');clearTimeout(el._open)}});
    el.addEventListener('drop',e=>{e.preventDefault();const pos=el.dataset.pos;clearDrop();const src=treeDrag;treeDrag=null;if(src&&pos)treeMove(src,el,pos)})});
  $$('.sp-item[role=button]',side).forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){if(e.target!==el)return;e.preventDefault();el.click()}
    else if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const[x,y]=menuAt(el);el.dataset.folder?folderMenu(folderById(el.dataset.folder),x,y):el.dataset.space&&spaceMenu(spaceById(el.dataset.space),x,y)}
    else if(el.dataset.folder&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){const f=folderById(el.dataset.folder);if((e.key==='ArrowRight')===!!f.collapsed){e.preventDefault();toggleFolder(f.id);$(`[data-folder="${f.id}"]`)?.focus()}}}));
  side.oncontextmenu=e=>{const fo=e.target.closest('[data-folder]'),spc=e.target.closest('[data-space]');if(fo){e.preventDefault();folderMenu(folderById(fo.dataset.folder),e.clientX,e.clientY)}else if(spc){e.preventDefault();spaceMenu(spaceById(spc.dataset.space),e.clientX,e.clientY)}}}
function updNav(){if(!tv.on)return'';const st=upd.state;
  if(st==='available')return`<button class="nav-item upd-go" data-act="installUpdate" title="Version ${esc(upd.version)} herunterladen und installieren">${SVG.upd}<span class="sp-n">Update installieren</span><span class="badge">${esc(upd.version)}</span></button>`;
  if(st==='downloading')return`<div class="nav-item upd-go" aria-live="polite">${SVG.upd}<span class="sp-n">Lade Update … ${upd.progress} %</span></div>`;
  if(st==='installing')return`<div class="nav-item upd-go">${SVG.upd}<span class="sp-n">Installiere …</span></div>`;
  return`<button class="nav-item" data-act="checkUpdate" title="Nach einer neuen Version suchen">${SVG.upd}<span class="sp-n">${st==='checking'?'Suche nach Updates …':'Nach Updates suchen'}</span>${upd.current?`<span class="sp-c">v${esc(upd.current)}</span>`:''}</button>`}
function timerPill(){const r=runningTimer();if(!r)return'';return`<span class="timer-pill" title="Zeiterfassung läuft"><span class="tl" data-act="openRun">${esc(noteLabel(r.n))}</span><span class="tt" id="timerTime">${clock(Date.now()-Date.parse(r.n.timerStart))}</span><button data-act="stopRun" title="Stoppen" aria-label="Zeit stoppen">■</button></span>`}
function renderHead(){const v=DB.ui.view,h=$('#head');
  const st=`<span class="status${statusErr?' err':''}" id="status">${esc(statusMsg)}</span>`;
  const sb=`<button class="searchbtn" data-act="palette" title="Alles durchsuchen">${SVG.search}<span class="lbl">Suchen …</span><span class="spacer"></span><kbd>Strg K</kbd></button>`;
  if(GLOBAL_VIEWS.includes(v)){const T={today:'Heute & Termine',time:'Zeiterfassung',trash:'Papierkorb',settings:'Einstellungen'}[v];
    h.innerHTML=`<div class="head-row" style="padding-bottom:12px"><button class="icon-btn menu-btn" data-act="menu" aria-label="Menü">☰</button><div class="ttl"><div class="crumb">${v==='today'?esc(new Date().toLocaleDateString('de-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+' · KW '+isoWeek(today()):'Übersicht'}</div><h1>${T}</h1></div><span class="spacer"></span>${st}${timerPill()}${sb}${v==='today'?'<button class="btn primary" data-act="create" title="Taste N">+ Notiz</button>':''}</div>`;return}
  const s=sp(),na=s.notes.filter(n=>n.archived).length;
  h.innerHTML=`<div class="head-row"><button class="icon-btn menu-btn" data-act="menu" aria-label="Menü">☰</button><span class="sav lg" style="background:${esc(s.color)}">${esc((s.name.trim()[0]||'?').toUpperCase())}</span><div class="ttl"><div class="crumb">${spacePath(s).length?spacePath(s).map(esc).join(' › '):'Space'}</div><h1>${esc(s.name)}</h1></div><span class="spacer"></span>${st}${timerPill()}${sb}<button class="btn primary" data-act="create" title="Taste N">+ Notiz</button></div>
  <nav class="tabs">${[['board','Board'],['wall','Alle Notizen'],['archive','Archiv'+(na?`<span class="cnt">${na}</span>`:'')],['spacecfg','Einstellungen']].map(([k,n])=>`<button class="tab${v===k?' on':''}" data-act="view" data-v="${k}">${n}</button>`).join('')}</nav>`}
function renderFbar(){const v=DB.ui.view,el=$('#fbar');if(v!=='board'&&v!=='wall'){el.innerHTML='';return}
  const s=sp(),f=ui.filters,tags=tagsOf(s);
  const nAct=['tag','prio','color','due'].filter(k=>f[k]).length+(f.pinned?1:0);
  el.classList.toggle('open',!!ui.fOpen);
  el.innerHTML=`<button class="fbar-toggle${nAct?' act':''}" id="fTog" aria-expanded="${!!ui.fOpen}">Filter${nAct?` · ${nAct}`:''}</button><div class="search">${SVG.search}<input id="q" type="search" placeholder="In diesem Space suchen ( / )" value="${esc(f.q)}" autocomplete="off" aria-label="Suchen"></div>
  <select class="f${f.tag?' act':''}" id="fTag" aria-label="Tag"><option value="">Alle Labels</option>${tags.map(t=>`<option value="${esc(t)}"${f.tag===t?' selected':''}>${esc(t)}</option>`).join('')}</select>
  <select class="f${f.prio?' act':''}" id="fPrio" aria-label="Priorität"><option value="">Alle Prioritäten</option>${PRIOS.map(p=>`<option value="${p.id}"${f.prio===p.id?' selected':''}>${p.n}</option>`).join('')}<option value="none"${f.prio==='none'?' selected':''}>Ohne Priorität</option></select>
  <select class="f${f.color?' act':''}" id="fCol" aria-label="Farbe"><option value="">Alle Farben</option>${NCOL.map(c=>`<option value="${c.id}"${f.color===c.id?' selected':''}>${c.n}</option>`).join('')}</select>
  <select class="f${f.due?' act':''}" id="fDue" aria-label="Termin"><option value="">Alle Termine</option>${[['late','Überfällig'],['today','Heute'],['week','Nächste 7 Tage'],['any','Mit Termin'],['none','Ohne Termin']].map(([k,n])=>`<option value="${k}"${f.due===k?' selected':''}>${n}</option>`).join('')}</select>
  <label class="chk"><input type="checkbox" id="fPin"${f.pinned?' checked':''}> Nur angeheftete</label>
  <button class="link" data-act="clearF" id="clearF"${Object.values(f).some(Boolean)?'':' hidden'}>Filter löschen</button>${v==='board'?`<span class="spacer"></span><label class="chk">Sortieren nach <select class="f" id="fSort" aria-label="Sortierung">${Object.entries(SORTS).map(([k,n])=>`<option value="${k}"${(s.sort||'manual')===k?' selected':''}>${n}</option>`).join('')}</select></label>`:''}`;
  const upd=()=>{$('#clearF').hidden=!Object.values(f).some(Boolean);renderContent()};
  $('#q').addEventListener('input',e=>{f.q=e.target.value;upd()});
  $('#q').addEventListener('keydown',e=>{if(e.key==='Escape'){e.target.value='';f.q='';e.target.blur();upd()}});
  for(const[id,k]of[['fTag','tag'],['fPrio','prio'],['fCol','color'],['fDue','due']])$('#'+id).onchange=e=>{f[k]=e.target.value;e.target.classList.toggle('act',!!f[k]);upd()};
  $('#fPin').onchange=e=>{f.pinned=e.target.checked;upd()};
  $('#fTog').onclick=()=>{ui.fOpen=!ui.fOpen;renderFbar()};
  const so=$('#fSort');if(so)so.onchange=e=>{s.sort=e.target.value;save(true);renderContent()}}
function renderContent(){const c=$('#content'),old=$('#bw'),v=DB.ui.view,key=v+(v==='spacecfg'?ui.stab:'')+(v==='settings'?ui.gtab:'')+(SPACE_VIEWS.includes(v)?DB.active:'');
  const sc=old&&old.dataset.k===key?{l:old.scrollLeft,t:old.scrollTop,cols:$$('.col-list',old).map(x=>x.scrollTop)}:null;
  ({board:renderBoard,wall:renderWall,archive:renderArchive,spacecfg:renderSpaceCfg,today:renderToday,time:renderTime,trash:renderTrash,settings:renderSettings}[v]||renderBoard)(c);
  const nw=$('#bw');if(nw){nw.dataset.k=key;if(sc){nw.scrollLeft=sc.l;nw.scrollTop=sc.t;$$('.col-list',nw).forEach((x,k)=>{if(sc.cols[k])x.scrollTop=sc.cols[k]})}}}
function matches(s,n){const f=ui.filters;
  if(f.q){const q=f.q.trim().toLowerCase();if(q&&![n.title,n.body,n.tags.join(' '),n.checklist.map(c=>c.text).join(' ')].join('\n').toLowerCase().includes(q))return false}
  if(f.tag&&!n.tags.includes(f.tag))return false;
  if(f.color&&n.color!==f.color)return false;
  if(f.prio&&(f.prio==='none'?!!n.prio:n.prio!==f.prio))return false;
  if(f.pinned&&!n.pinned)return false;
  if(f.due){const t=today();
    if(f.due==='late'&&dueState(s,n)!=='late')return false;
    if(f.due==='today'&&n.due!==t)return false;
    if(f.due==='week'&&!(n.due&&n.due>=t&&n.due<=addDays(t,7)))return false;
    if(f.due==='any'&&!n.due)return false;
    if(f.due==='none'&&n.due)return false}
  return true}
