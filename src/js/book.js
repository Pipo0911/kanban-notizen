/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Kanban Notizen · Notizbuch-Ansicht wie in OneNote:
   Space = Notizbuch, Spalten = Abschnitte (Reiter oben), Notizen = Seiten (Liste links, mit Unterseiten über n.parent),
   rechts die gewählte Seite direkt bearbeitbar. Board und Notizbuch zeigen dieselben Daten. */
'use strict';
const bookState=s=>{const u=DB.ui.book||(DB.ui.book={});const b=u[s.id]||(u[s.id]={});
  if(!s.columns.some(c=>c.id===b.col))b.col=(s.columns.find(c=>!c.done)||s.columns[0]).id;return b};
let bookCtl=null,bookMounted='',bookCollapsed=(()=>{try{return new Set(JSON.parse(localStorage.getItem('kanban-notizen-book-closed')||'[]'))}catch(e){return new Set()}})();
const saveCollapsed=()=>{try{localStorage.setItem('kanban-notizen-book-closed',JSON.stringify([...bookCollapsed].slice(-500)))}catch(e){}};

/* Seiten eines Abschnitts als Baum (Unterseiten über n.parent im selben Abschnitt) */
function bookTree(s,colId){const L=live(s).filter(n=>n.colId===colId).sort(dispSort),ids=new Set(L.map(n=>n.id));
  const kids=new Map();for(const n of L){const p=n.parent&&ids.has(n.parent)&&n.parent!==n.id?n.parent:'';if(!kids.has(p))kids.set(p,[]);kids.get(p).push(n)}
  const out=[],seen=new Set();const walk=(p,d)=>{for(const n of kids.get(p)||[]){if(seen.has(n.id))continue;seen.add(n.id);out.push({n,d,has:(kids.get(n.id)||[]).length>0});if(!bookCollapsed.has(n.id))walk(n.id,d+1)}};
  walk('',0);return out}
const descendants=(s,id)=>{const out=[];const add=p=>live(s).filter(n=>n.parent===p).forEach(n=>{if(!out.includes(n)){out.push(n);add(n.id)}});add(id);return out};

function renderBook(el){const s=sp(),b=bookState(s);
  const sel=b.nid&&byId(s,b.nid)&&!byId(s,b.nid).archived?byId(s,b.nid):null;
  if(sel&&sel.colId!==b.col)b.col=sel.colId;
  const tree=bookTree(s,b.col);
  const tabs=s.columns.map(c=>`<button class="bk-tab${c.id===b.col?' on':''}" data-bcol="${c.id}" style="--tc:${colHex(c.color)}">${esc(c.name)}<span class="cnt">${live(s).filter(n=>n.colId===c.id).length}</span></button>`).join('')+'<button class="bk-tab add" data-act="addCol" title="Abschnitt hinzufügen">+</button>';
  const list=tree.length?tree.map(({n,d,has})=>`<div class="bk-it${sel&&sel.id===n.id?' on':''}" data-bnid="${n.id}" style="--d:${d}">
      ${has?`<button class="bk-tog" data-btog="${n.id}" aria-label="${bookCollapsed.has(n.id)?'Aufklappen':'Zuklappen'}">${bookCollapsed.has(n.id)?'▸':'▾'}</button>`:'<span class="bk-tog sp"></span>'}
      <span class="bk-ic">${n.kind==='page'?'📄':'📝'}</span><span class="bk-t">${esc(noteLabel(n)||'Ohne Titel')}</span>
      <button class="bk-more" data-bmore="${n.id}" aria-label="Aktionen" title="Aktionen">⋯</button></div>`).join('')
    :'<div class="bk-empty">Noch keine Seiten in diesem Abschnitt.</div>';
  const keep=bookMounted&&sel&&bookMounted===sel.id&&bookCtl&&bookCtl.note===sel&&$('#bookPage',el);
  const sideHTML=`<div class="bk-tabs" id="bkTabs">${tabs}</div><div class="bk-list" id="bkList">${list}</div>
    <div class="bk-add"><button class="btn sm primary" id="bkNew">+ Seite</button><button class="btn sm ghost" id="bkNewNote" title="Normale Notiz mit Textfeld">+ Notiz</button></div>`;
  if(keep){$('#bkSide',el).innerHTML=sideHTML;el.firstElementChild.classList.toggle('has-sel',!!sel);bindBookSide(el,s,b);return}
  if(bookCtl&&bookCtl.note!==sel)leaveBookPage();else if(bookCtl){bookCtl.flush();bookCtl.destroy();bookCtl=null}bookMounted='';
  el.innerHTML=`<div class="book${sel?' has-sel':''}"><aside class="bk-side" id="bkSide">${sideHTML}</aside><section class="bk-main" id="bkMain"></section></div>`;
  bindBookSide(el,s,b);
  const main=$('#bkMain',el);
  if(!sel){main.innerHTML=`<div class="empty-big">Wähle links eine Seite oder erstelle mit <b>+ Seite</b> eine neue – wie in OneNote. Abschnitte sind die Spalten deines Boards.</div>`;return}
  main.innerHTML=`<div class="bk-head"><button class="btn sm ghost bk-back" id="bkBack">‹ Seiten</button>
      <input class="bk-title" id="bkTitle" value="${esc(sel.title)}" placeholder="Seitentitel" maxlength="200" aria-label="Titel">
      <span class="muted sm bk-meta">${esc(fmtTime(sel.created))}</span><button class="btn sm" id="bkDetails" title="Termin, Erinnerung, Labels … im Editor">Details</button></div>
    <div id="bookPage" data-nid="${sel.id}"></div>`;
  const before={v:snapOf(sel)},origTitle=sel.title;let t=0;
  const touch=()=>{sel.updated=now();clearTimeout(t);t=setTimeout(()=>{save(true);refreshBookList()},450)};
  const ti=$('#bkTitle',main);ti.oninput=()=>{sel.title=ti.value;touch()};
  ti.onblur=()=>{const c=relinkTitle(sel,origTitle);if(c)toast(`${c} Verweis${c===1?'':'e'} aktualisiert`)};
  ti.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(bookCtl&&bookCtl.focusText)bookCtl.focusText();else ti.blur()}};
  $('#bkDetails',main).onclick=()=>{if(bookCtl)bookCtl.flush();openNote(s.id,sel.id)};
  $('#bkBack',main).onclick=()=>{b.nid='';saveUi();renderContent()};
  const host=$('#bookPage',main);
  if(sel.kind==='page'){bookCtl=mountPage(host,sel,touch);bookCtl.before=before}
  else{linkCtx=s.id;host.innerHTML=`<div class="bk-note md" title="Klicken zum Bearbeiten">${sel.body.trim()?md(sel.body):'<span class="muted">Kein Text – klicke zum Bearbeiten.</span>'}</div>
      <div class="bk-conv"><button class="btn sm" id="bkConv">In freie Seite umwandeln</button></div>`;
    $('.bk-note',host).onclick=e=>{if(!e.target.closest('a'))openNote(s.id,sel.id)};
    $('#bkConv',host).onclick=()=>{recordHistory(sel,snapOf(sel));toPage(sel);save();bookMounted='';renderContent()};
    bookCtl={flush(){},destroy(){},before}}
  bookCtl.note=sel;bookMounted=sel.id;
  if(!sel.title.trim()&&!(sel.page&&sel.page.items.length))setTimeout(()=>ti.focus(),50)}
function refreshBookList(){const el=$('#content');if(DB.ui.view==='book'&&el)renderBook(el)}
/* Seite verlassen: Verlauf schreiben, leere Seiten entfernen */
function leaveBookPage(){if(!bookCtl||!bookCtl.note)return;const n=bookCtl.note;bookCtl.flush();
  const s=DB.spaces.find(x=>x.notes.includes(n));if(s&&noteEmpty(n)){s.notes=s.notes.filter(x=>x!==n);save(true)}
  else recordHistory(n,bookCtl.before&&bookCtl.before.v);
  bookCtl.destroy();bookCtl=null;bookMounted=''}

function bindBookSide(el,s,b){
  $$('[data-bcol]',el).forEach(x=>x.onclick=()=>{leaveBookPage();b.col=x.dataset.bcol;const first=bookTree(s,b.col)[0];b.nid=first?first.n.id:'';saveUi();renderContent()});
  $$('.bk-it',el).forEach(x=>x.onclick=e=>{if(e.target.closest('button'))return;if(b.nid===x.dataset.bnid&&bookMounted)return;leaveBookPage();b.nid=x.dataset.bnid;saveUi();renderContent()});
  $$('[data-btog]',el).forEach(x=>x.onclick=()=>{const id=x.dataset.btog;bookCollapsed.has(id)?bookCollapsed.delete(id):bookCollapsed.add(id);saveCollapsed();renderBook(el)});
  $$('[data-bmore]',el).forEach(x=>x.onclick=e=>{e.stopPropagation();bookMenu(x,s,b,byId(s,x.dataset.bmore))});
  $('#bkNew',el).onclick=()=>bookNew(s,b,'page','');
  $('#bkNewNote',el).onclick=()=>bookNew(s,b,'','')}
function bookNew(s,b,kind,parent){leaveBookPage();const after=parent?byId(s,parent):null;
  const n=newNote(s,{colId:b.col,parent:parent||''});if(kind==='page')toPage(n);
  if(after){const sib=live(s).filter(x=>x.colId===b.col).sort(dispSort);let o=after.order;descendants(s,after.id).forEach(d=>{if(d.order>o)o=d.order});
    sib.forEach(x=>{if(x!==n&&x.order>o)x.order+=1});n.order=o+1;bookCollapsed.delete(after.id);saveCollapsed()}
  b.nid=n.id;save();renderContent();if(kind!=='page')openNote(s.id,n.id)}

/* Aktionen einer Seite: Unterseite, Reihenfolge, Ebene, Abschnitt, Löschen */
function bookMenu(anchor,s,b,n){if(!n)return;$$('.bk-menu').forEach(x=>x.remove());
  const sib=live(s).filter(x=>x.colId===n.colId&&(x.parent||'')===(n.parent||'')).sort(dispSort),k=sib.indexOf(n);
  const items=[['sub','＋ Unterseite hinzufügen'],k>0&&['up','↑ Nach oben'],k<sib.length-1&&['down','↓ Nach unten'],k>0&&['in','→ Einrücken (Unterseite)'],n.parent&&['out','← Ausrücken'],
    ['open','Im Editor öffnen'],...s.columns.filter(c=>c.id!==n.colId).map(c=>['col:'+c.id,'In „'+c.name+'“ verschieben']),['del','Löschen']].filter(Boolean);
  const m=document.createElement('div');m.className='bk-menu';m.setAttribute('role','menu');
  m.innerHTML=items.map(([k,l])=>`<button type="button" data-m="${k}" class="${k==='del'?'danger':''}">${esc(l)}</button>`).join('');
  document.body.appendChild(m);const r=anchor.getBoundingClientRect();m.style.left=Math.min(r.left,innerWidth-m.offsetWidth-8)+'px';m.style.top=Math.min(r.bottom+4,innerHeight-m.offsetHeight-8)+'px';
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)};const out=e=>{if(!m.contains(e.target))close()};
  setTimeout(()=>document.addEventListener('pointerdown',out,true),0);
  $$('[data-m]',m).forEach(x=>x.onclick=async()=>{const a=x.dataset.m;close();
    const swap=(o)=>{const t=sib[k+o],tmp=n.order;n.order=t.order;t.order=tmp;if(n.order===t.order)n.order+=o};
    if(a==='sub'){bookNew(s,b,'page',n.id);return}
    if(a==='up')swap(-1);else if(a==='down')swap(1);
    else if(a==='in'){n.parent=sib[k-1].id;bookCollapsed.delete(n.parent);saveCollapsed()}
    else if(a==='out'){const p=byId(s,n.parent);n.parent=p?p.parent||'':''}
    else if(a==='open'){openNote(s.id,n.id);return}
    else if(a.startsWith('col:')){const c=a.slice(4);[n,...descendants(s,n.id)].forEach(x=>{x.colId=c;x.order=maxOrder(s,c)+1});if(b.nid===n.id)b.col=c}
    else if(a==='del'){const kids=descendants(s,n.id);const r=await ask({title:'Seite löschen?',text:`„${esc(noteLabel(n)||'Ohne Titel')}“${kids.length?` und ${kids.length} Unterseite${kids.length===1?'':'n'}`:''} kommen in den Papierkorb.`,ok:'Löschen',danger:true});if(!r)return;
      if(b.nid===n.id||kids.some(x=>x.id===b.nid)){leaveBookPage();b.nid=''}
      const snap=JSON.stringify(DB);[n,...kids].forEach(x=>trashNote(s,x));save();renderContent();toast('In den Papierkorb verschoben',{undo:snap});return}
    n.updated=now();save();renderContent()})}
