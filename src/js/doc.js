/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Notara · Notizbücher zum Dokumentieren wie in OneNote – unabhängig von den Boards.
   DB.books  = [{id,name,color,created,sections:[{id,name,color,pages:[{id,title,parent,created,updated}]}]}]
   DB.dpages = {pageId:{page:{bg,items,ink},body,updated}}   (Inhalt der Seite, body = Text für die Suche)
   DB.files  = {fileId:{name,mime,size,data(base64),created}} (Anhänge, auch für Seiten in Boards)
   Sync: 'books' (Struktur), 'dpage:<id>' (Inhalt), 'file:<id>' (Anhang). */
'use strict';
const DOC_COLORS=['#2f5bd3','#d64545','#1e9e5a','#e6862a','#8a4fd6','#1f8fbf','#c2185b','#7a8a00','#646b76','#00897b'];

/* ---------- Normalisieren ---------- */
function normBooks(a){const seen=new Set(),ok=id=>{if(!okId(id)||seen.has(id))return uid();seen.add(String(id));return String(id)};
  const col=(c,i)=>isHex(c)?c:DOC_COLORS[i%DOC_COLORS.length];
  return arr(a).filter(b=>b&&typeof b==='object').map((b,bi)=>({id:ok(b.id),name:String(b.name||'Notizbuch').slice(0,80),color:col(b.color,bi),created:isNaN(Date.parse(b.created))?now():b.created,
    sections:arr(b.sections).filter(Boolean).map((s,si)=>{const pages=arr(s.pages).filter(Boolean).map(p=>({id:ok(p.id),title:String(p.title||'').slice(0,200),parent:okId(p.parent)?String(p.parent):'',
        created:isNaN(Date.parse(p.created))?now():p.created,updated:isNaN(Date.parse(p.updated))?now():p.updated}));
      const ids=new Set(pages.map(p=>p.id));pages.forEach(p=>{if(!ids.has(p.parent)||p.parent===p.id)p.parent=''});
      pages.forEach(p=>{let q=p.parent,g=0;const s2=new Set([p.id]);while(q&&g++<200){if(s2.has(q)){p.parent='';break}s2.add(q);q=(pages.find(x=>x.id===q)||{}).parent}});
      return{id:ok(s.id),name:String(s.name||'Abschnitt').slice(0,80),color:col(s.color,si+bi),pages}})}))}
function normDPages(o,pids){const out={};if(o&&typeof o==='object')for(const[k,v]of Object.entries(o)){if(!pids.has(k)||!v||typeof v!=='object')continue;
  out[k]={page:normPage(v.page),body:String(v.body||''),updated:isNaN(Date.parse(v.updated))?'':String(v.updated)}}return out}
const docPageIds=books=>{const s=new Set();books.forEach(b=>b.sections.forEach(x=>x.pages.forEach(p=>s.add(p.id))));return s};
/* Anhänge behalten, solange irgendeine Seite (auch im Papierkorb/Verlauf) sie verwendet */
function normFiles(o,ref){const out={};if(!o||typeof o!=='object')return out;const json=JSON.stringify(ref),used=new Set();
  for(const m of json.matchAll(/"fid":"([A-Za-z0-9_-]{1,64})"/g))used.add(m[1]);
  for(const[k,f]of Object.entries(o))if(used.has(k)&&f&&typeof f.data==='string')out[k]={name:String(f.name||'Datei').slice(0,200),mime:String(f.mime||'').slice(0,100),size:+f.size||0,data:f.data,created:String(f.created||'')};
  return out}

/* ---------- Zugriff ---------- */
const bookById=id=>DB.books.find(b=>b.id===id);
function docFind(pid){for(const b of DB.books)for(const s of b.sections){const p=s.pages.find(x=>x.id===pid);if(p)return{b,s,p}}return null}
const docState=()=>{const u=DB.ui.doc||(DB.ui.doc={});return u};
function docLinkTargets(){const out=[];for(const b of DB.books)for(const s of b.sections)for(const p of s.pages)out.push([p.id,`${b.name} › ${s.name} › ${p.title||'Ohne Titel'}`]);return out}
function openDocPage(pid){const f=docFind(pid);if(!f)return false;const u=docState();u.b=f.b.id;u.s=f.s.id;u.p=pid;(u.sel||(u.sel={}))[f.s.id]=pid;docOpenPhone='page';setView('doc');return true}
function openBook(bid){const b=bookById(bid);if(!b)return;const u=docState();if(u.b!==bid){u.b=bid;u.s=(b.sections[0]||{}).id||'';u.p=''}docOpenPhone='';setView('doc')}
const docTouch=b=>{b.updated=now()};

/* ---------- Seitenbaum ---------- */
let docClosed=(()=>{try{return new Set(JSON.parse(localStorage.getItem('kanban-notizen-doc-closed')||'[]'))}catch(e){return new Set()}})();
const saveDocClosed=()=>{try{localStorage.setItem('kanban-notizen-doc-closed',JSON.stringify([...docClosed].slice(-500)))}catch(e){}};
function docTree(sec){const kids=new Map();for(const p of sec.pages){const k=p.parent||'';if(!kids.has(k))kids.set(k,[]);kids.get(k).push(p)}
  const out=[],walk=(par,d)=>{for(const p of kids.get(par)||[]){const has=(kids.get(p.id)||[]).length>0;out.push({p,d,has});if(has&&!docClosed.has(p.id))walk(p.id,d+1)}};walk('',0);return out}
const docDesc=(sec,id)=>{const out=[];const add=q=>sec.pages.filter(p=>p.parent===q).forEach(p=>{out.push(p);add(p.id)});add(id);return out};

/* ---------- Anlegen ---------- */
async function createBook(){const r=await ask({title:'Neues Notizbuch',fields:[{name:'name',label:'Name',required:true,maxlength:80,placeholder:'z. B. Schule, Arbeit, Doku'}],ok:'Erstellen'});if(!r)return;
  const b={id:uid(),name:r.name.trim()||'Notizbuch',color:DOC_COLORS[DB.books.length%DOC_COLORS.length],created:now(),sections:[{id:uid(),name:'Neuer Abschnitt',color:DOC_COLORS[0],pages:[]}]};
  DB.books.push(b);save();openBook(b.id)}
async function addSection(b){const r=await ask({title:'Neuer Abschnitt',fields:[{name:'name',label:'Name',required:true,maxlength:80,placeholder:'z. B. Modul 321'}],ok:'Erstellen'});if(!r)return;
  const s={id:uid(),name:r.name.trim()||'Abschnitt',color:DOC_COLORS[b.sections.length%DOC_COLORS.length],pages:[]};b.sections.push(s);const u=docState();u.s=s.id;u.p='';docOpenPhone='pages';save();renderContent();renderSide()}
function addPage(b,s,parent=''){const p={id:uid(),title:'',parent,created:now(),updated:now()};
  if(parent){const d=docDesc(s,parent),last=d.length?d[d.length-1]:s.pages.find(x=>x.id===parent);s.pages.splice(s.pages.indexOf(last)+1,0,p);docClosed.delete(parent);saveDocClosed()}else s.pages.push(p);
  DB.dpages[p.id]={page:blankPage(),body:'',updated:now()};const u=docState();u.s=s.id;u.p=p.id;(u.sel||(u.sel={}))[s.id]=p.id;docOpenPhone='page';docFocusTitle=true;save(true);renderContent()}

/* ---------- Menüs ---------- */
function bookMenuDoc(b,x,y){showMenu(x,y,[{cap:b.name},
  {t:'Umbenennen',run:async()=>{const r=await ask({title:'Notizbuch umbenennen',fields:[{name:'name',label:'Name',value:b.name,required:true,maxlength:80}],ok:'Speichern'});if(r){b.name=r.name.trim()||b.name;save();render()}}},
  {t:'Farbe …',run:()=>colorPick($('#side [data-book="'+b.id+'"]')||document.body,b.color,c=>{if(isHex(c)){b.color=c;save();render()}},{title:'Farbe des Notizbuchs'})},
  {t:'Nach oben',run:()=>{moveArr(DB.books,b,-1);save();render()}},{t:'Nach unten',run:()=>{moveArr(DB.books,b,1);save();render()}},'-',
  {t:'Als Markdown exportieren',run:()=>exportBook(b)},'-',
  {t:'Notizbuch löschen …',danger:true,run:async()=>{const n=b.sections.reduce((a,s)=>a+s.pages.length,0);
    const r=await ask({title:`„${b.name}“ löschen?`,text:`${b.sections.length} Abschnitt${b.sections.length===1?'':'e'} und ${n} Seite${n===1?'':'n'} werden gelöscht. Direkt danach kannst du das rückgängig machen.`,ok:'Löschen',danger:true});if(!r)return;
    const snap=JSON.stringify(DB);DB.books=DB.books.filter(x=>x!==b);docDropPages(b.sections.flatMap(s=>s.pages));if(DB.ui.view==='doc'&&docState().b===b.id)DB.ui.view='today';save();render();toast('Notizbuch gelöscht',{undo:snap})}}])}
function sectionMenu(b,s,x,y,anchor){showMenu(x,y,[{cap:s.name},
  {t:'Umbenennen',run:async()=>{const r=await ask({title:'Abschnitt umbenennen',fields:[{name:'name',label:'Name',value:s.name,required:true,maxlength:80}],ok:'Speichern'});if(r){s.name=r.name.trim()||s.name;save();renderContent()}}},
  {t:'Farbe …',run:()=>colorPick(anchor||document.body,s.color,c=>{if(isHex(c)){s.color=c;save();renderContent()}},{title:'Farbe des Abschnitts'})},
  {t:'Nach oben',run:()=>{moveArr(b.sections,s,-1);save();renderContent()}},{t:'Nach unten',run:()=>{moveArr(b.sections,s,1);save();renderContent()}},
  ...(DB.books.length>1?[{t:'In anderes Notizbuch verschieben …',run:async()=>{const r=await ask({title:'Abschnitt verschieben',fields:[{name:'b',label:'Ziel-Notizbuch',type:'select',options:DB.books.filter(x=>x!==b).map(x=>[x.id,x.name])}],ok:'Verschieben'});
    if(!r)return;const t=bookById(r.b);if(!t)return;b.sections=b.sections.filter(x=>x!==s);t.sections.push(s);const u=docState();u.b=t.id;u.s=s.id;save();render()}}]:[]),'-',
  {t:'Abschnitt löschen …',danger:true,run:async()=>{const r=await ask({title:`Abschnitt „${s.name}“ löschen?`,text:`${s.pages.length} Seite${s.pages.length===1?'':'n'} werden gelöscht. Direkt danach kannst du das rückgängig machen.`,ok:'Löschen',danger:true});if(!r)return;
    const snap=JSON.stringify(DB);b.sections=b.sections.filter(x=>x!==s);docDropPages(s.pages);const u=docState();if(u.s===s.id){u.s=(b.sections[0]||{}).id||'';u.p=''}save();renderContent();renderSide();toast('Abschnitt gelöscht',{undo:snap})}}])}
function pageMenuDoc(b,s,p,x,y){const sibs=s.pages.filter(q=>q.parent===p.parent),i=sibs.indexOf(p),prev=sibs[i-1];
  const moveSib=k=>{const o=sibs[i+k];if(!o)return;const a=s.pages.indexOf(p),c=s.pages.indexOf(o);s.pages[a]=o;s.pages[c]=p;save(true);renderContent()};
  showMenu(x,y,[{cap:p.title||'Ohne Titel'},
    {t:'Unterseite hinzufügen',run:()=>addPage(b,s,p.id)},
    ...(prev?[{t:'Einrücken (Unterseite von „'+(prev.title||'Ohne Titel').slice(0,30)+'“)',run:()=>{p.parent=prev.id;docClosed.delete(prev.id);save(true);renderContent()}}]:[]),
    ...(p.parent?[{t:'Ausrücken',run:()=>{const par=s.pages.find(q=>q.id===p.parent);p.parent=par?par.parent:'';save(true);renderContent()}}]:[]),
    ...(i>0?[{t:'Nach oben',run:()=>moveSib(-1)}]:[]),...(i<sibs.length-1?[{t:'Nach unten',run:()=>moveSib(1)}]:[]),
    {t:'In anderen Abschnitt verschieben …',run:async()=>{const opts=[];DB.books.forEach(bk=>bk.sections.forEach(sx=>{if(sx!==s)opts.push([bk.id+'|'+sx.id,(DB.books.length>1?bk.name+' › ':'')+sx.name])}));
      if(!opts.length){toast('Es gibt keinen anderen Abschnitt');return}const r=await ask({title:'Seite verschieben',fields:[{name:'t',label:'Ziel-Abschnitt',type:'select',options:opts}],ok:'Verschieben'});if(!r)return;
      const[tb,ts]=r.t.split('|'),B=bookById(tb),S=B&&B.sections.find(z=>z.id===ts);if(!S)return;const grp=[p,...docDesc(s,p.id)];s.pages=s.pages.filter(q=>!grp.includes(q));p.parent='';S.pages.push(...grp);
      const u=docState();u.b=B.id;u.s=S.id;u.p=p.id;save();render()}},
    {t:'Link zu dieser Seite kopieren',run:()=>{const t=`#doc:${p.id}`;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Seitenlink kopiert – im Link-Dialog oder als Text einfügen'),()=>toast(t))}},'-',
    {t:'Seite löschen …',danger:true,run:async()=>{const d=docDesc(s,p.id);const r=await ask({title:`„${p.title||'Ohne Titel'}“ löschen?`,text:d.length?`Auch ${d.length} Unterseite${d.length===1?'':'n'} werden gelöscht.`:'Direkt danach kannst du das rückgängig machen.',ok:'Löschen',danger:true});if(!r)return;
      const snap=JSON.stringify(DB),grp=[p,...d];s.pages=s.pages.filter(q=>!grp.includes(q));docDropPages(grp);const u=docState();if(grp.some(q=>q.id===u.p))u.p='';save();renderContent();toast('Seite gelöscht',{undo:snap})}}])}
function docDropPages(pages){pages.forEach(p=>delete DB.dpages[p.id])}

/* ---------- Ansicht ---------- */
let docCtl=null,docMounted='',docOpenPhone='',docFocusTitle=false;const docScroll={};
function leaveDocPage(){if(docCtl){const sc=$('#pgScroll');if(sc&&docMounted)docScroll[docMounted]=[sc.scrollLeft,sc.scrollTop];docCtl.flush();docCtl.destroy();docCtl=null}
  /* leere, unbenannte Seite wieder entfernen */
  if(docMounted){const f=docFind(docMounted),dp=DB.dpages[docMounted];if(f&&!f.p.title.trim()&&!docDesc(f.s,f.p.id).length&&(!dp||!(dp.page.items.length||dp.page.ink.length))){f.s.pages=f.s.pages.filter(x=>x!==f.p);delete DB.dpages[f.p.id];save(true)}}
  docMounted=''}
function renderDoc(el){const u=docState();let b=bookById(u.b)||DB.books[0];
  if(!b){leaveDocPage();el.innerHTML=`<div class="empty-big doc-empty"><b>Noch kein Notizbuch</b><br>Notizbücher sind zum Dokumentieren wie in OneNote: Abschnitte, Seiten und Unterseiten, frei platzierter Text, Tabellen, Code, Bilder, Zeichnungen und Anhänge.<br><br><button class="btn primary" id="docFirst">+ Notizbuch erstellen</button></div>`;$('#docFirst',el).onclick=createBook;return}
  u.b=b.id;let s=b.sections.find(x=>x.id===u.s)||b.sections[0];u.s=s?s.id:'';
  let p=s&&s.pages.find(x=>x.id===u.p);if(!p&&s&&u.sel&&u.sel[s.id])p=s.pages.find(x=>x.id===u.sel[s.id]);if(!p&&s&&!isPhone())p=s.pages.find(x=>!x.parent)||s.pages[0];u.p=p?p.id:'';
  if(p)(u.sel||(u.sel={}))[s.id]=p.id;
  const secs=b.sections.map(x=>`<div class="ds-it${x===s?' on':''}" data-dsec="${x.id}" style="--c:${x.color}" role="button" tabindex="0"><span class="ds-n">${esc(x.name)}</span><span class="ds-c">${x.pages.length||''}</span><button class="ds-more" data-dsmore="${x.id}" aria-label="Aktionen" title="Aktionen">⋯</button></div>`).join('');
  const tree=s?docTree(s):[];
  const pages=tree.map(({p:q,d,has})=>`<div class="dp-it${q===p?' on':''}" data-dpage="${q.id}" style="--d:${d}" role="button" tabindex="0">${has?`<button class="bk-tog" data-dtog="${q.id}" aria-label="${docClosed.has(q.id)?'Aufklappen':'Zuklappen'}">${docClosed.has(q.id)?'▸':'▾'}</button>`:'<span class="bk-tog sp"></span>'}<span class="dp-t">${esc(q.title||'Ohne Titel')}</span><button class="bk-more" data-dpmore="${q.id}" aria-label="Aktionen" title="Aktionen">⋯</button></div>`).join('');
  const mode=isPhone()?(docOpenPhone==='page'&&p?'page':docOpenPhone==='pages'&&s?'pages':'secs'):'';
  const keep=p&&docMounted===p.id&&docCtl&&$('#docPage',el);
  const colsHTML=`<aside class="doc-secs"><div class="doc-bh"><span class="doc-bdot" style="background:${b.color}"></span><b title="${esc(b.name)}">${esc(b.name)}</b><button class="icon-btn sm" id="docBMenu" title="Notizbuch-Aktionen" aria-label="Notizbuch-Aktionen">⋯</button></div>
      <div class="ds-list">${secs||'<div class="bk-empty">Noch keine Abschnitte.</div>'}</div><button class="doc-add" id="docAddSec">+ Abschnitt</button></aside>
    <aside class="doc-pages"><div class="dp-h">${isPhone()?'<button class="btn sm ghost" id="docBackSecs">‹ Abschnitte</button>':''}<button class="doc-add top" id="docAddPage"${s?'':' disabled'}>+ Seite hinzufügen</button></div>
      <div class="dp-list">${pages||(s?'<div class="bk-empty">Noch keine Seiten.<br>Mit „+ Seite hinzufügen“ legst du die erste an.</div>':'')}</div></aside>`;
  if(keep){$('.doc-cols',el).innerHTML=colsHTML;bindDocCols(el,b,s,p);return}
  leaveDocPage();
  el.innerHTML=`<div class="doc${mode?' m-'+mode:''}"><div class="doc-cols">${colsHTML}</div><section class="doc-main" id="docMain"></section></div>`;
  bindDocCols(el,b,s,p);
  const main=$('#docMain',el);
  if(!p){main.innerHTML=`<div class="empty-big">${s?'Wähle links eine Seite oder lege mit <b>+ Seite hinzufügen</b> eine neue an.':'Lege links mit <b>+ Abschnitt</b> den ersten Abschnitt an.'}</div>`;return}
  const dp=DB.dpages[p.id]||(DB.dpages[p.id]={page:blankPage(),body:'',updated:''});
  const crumbs=[];let q=p;while(q&&q.parent){q=s.pages.find(x=>x.id===q.parent);if(q)crumbs.unshift(q)}
  main.innerHTML=`<div class="doc-head">${isPhone()?'<button class="btn sm ghost" id="docBackPages">‹ Seiten</button>':''}
      <div class="doc-crumb">${esc(s.name)}${crumbs.map(c=>' › '+esc(c.title||'Ohne Titel')).join('')}</div>
      <input class="doc-title" id="docTitle" value="${esc(p.title)}" placeholder="Seitentitel" maxlength="200" aria-label="Seitentitel">
      <div class="doc-date">${esc(docDate(p.created))}</div></div><div id="docPage" class="doc-page"></div>`;
  let t=0;const touch=()=>{p.updated=now();dp.updated=now();clearTimeout(t);t=setTimeout(()=>save(true),400)};
  const ti=$('#docTitle',main);ti.oninput=()=>{p.title=ti.value;touch();const it=$(`[data-dpage="${p.id}"] .dp-t`,el);if(it)it.textContent=p.title||'Ohne Titel'};
  ti.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(docCtl)docCtl.focusText()}};
  const bp=$('#docBackPages',main);if(bp)bp.onclick=()=>{docOpenPhone='pages';renderContent()};
  docCtl=mountPage($('#docPage',main),dp,touch);docMounted=p.id;
  const sc=$('#pgScroll',main),pos=docScroll[p.id];if(sc&&pos)requestAnimationFrame(()=>{sc.scrollLeft=pos[0];sc.scrollTop=pos[1]});
  if(docFocusTitle){docFocusTitle=false;setTimeout(()=>ti.focus(),40)}}
const docDate=iso=>{const d=new Date(iso);if(isNaN(d))return'';return d.toLocaleDateString('de-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'  '+d.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})};
function bindDocCols(el,b,s,p){const u=docState();
  $('#docBMenu',el).onclick=e=>{const[x,y]=menuAt(e.currentTarget);bookMenuDoc(b,x,y)};
  $('#docAddSec',el).onclick=()=>addSection(b);
  const ap=$('#docAddPage',el);if(ap&&s)ap.onclick=()=>addPage(b,s);
  const bs=$('#docBackSecs',el);if(bs)bs.onclick=()=>{docOpenPhone='';renderContent()};
  $$('[data-dsec]',el).forEach(x=>{const go=()=>{if(u.s!==x.dataset.dsec){u.s=x.dataset.dsec;u.p=''}docOpenPhone='pages';saveUi();renderContent()};
    x.onclick=e=>{if(e.target.closest('[data-dsmore]'))return;go()};x.onkeydown=e=>{if(e.key==='Enter')go()};
    x.oncontextmenu=e=>{e.preventDefault();const sec=b.sections.find(z=>z.id===x.dataset.dsec);if(sec)sectionMenu(b,sec,e.clientX,e.clientY,x)}});
  $$('[data-dsmore]',el).forEach(x=>x.onclick=e=>{e.stopPropagation();const sec=b.sections.find(z=>z.id===x.dataset.dsmore);const[mx,my]=menuAt(x);if(sec)sectionMenu(b,sec,mx,my,x)});
  $$('[data-dpage]',el).forEach(x=>{const go=()=>{u.p=x.dataset.dpage;(u.sel||(u.sel={}))[s.id]=u.p;docOpenPhone='page';saveUi();renderContent()};
    x.onclick=e=>{if(e.target.closest('[data-dpmore],[data-dtog]'))return;go()};x.onkeydown=e=>{if(e.key==='Enter')go()};
    x.oncontextmenu=e=>{e.preventDefault();const q=s.pages.find(z=>z.id===x.dataset.dpage);if(q)pageMenuDoc(b,s,q,e.clientX,e.clientY)}});
  $$('[data-dpmore]',el).forEach(x=>x.onclick=e=>{e.stopPropagation();const q=s.pages.find(z=>z.id===x.dataset.dpmore);const[mx,my]=menuAt(x);if(q)pageMenuDoc(b,s,q,mx,my)});
  $$('[data-dtog]',el).forEach(x=>x.onclick=e=>{e.stopPropagation();const id=x.dataset.dtog;docClosed.has(id)?docClosed.delete(id):docClosed.add(id);saveDocClosed();renderContent()})}

/* ---------- Seitenleiste ---------- */
function booksSideHTML(){const v=DB.ui.view,cur=v==='doc'?docState().b:'';
  return`<div class="side-h"><span>Notizbücher</span><button class="icon-btn sm" data-act="newBook" title="Notizbuch erstellen" aria-label="Notizbuch erstellen">+</button></div>
  <nav class="nav">${DB.books.map(b=>{const n=b.sections.reduce((a,s)=>a+s.pages.length,0);return`<div class="sp-item${b.id===cur?' on':''}" data-book="${b.id}" role="button" tabindex="0"><span class="sav book-ic" style="background:${b.color}">${DOC_IC}</span><span class="sp-n">${esc(b.name)}</span>${n?`<span class="sp-c">${n}</span>`:''}<button class="sp-more" data-bkmenu="${b.id}" aria-label="Aktionen" title="Aktionen">⋯</button></div>`}).join('')}
  ${DB.books.length?'':`<div class="sp-item add" data-act="newBook" role="button" tabindex="0"><span class="sav dashed">+</span><span class="sp-n">Notizbuch erstellen</span></div>`}</nav>`}
const DOC_IC='<svg width="13" height="13" viewBox="0 0 16 16"><path d="M3.5 2h8.5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 2v12M2 5h2.5M2 8h2.5M2 11h2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

/* ---------- Export als Markdown ---------- */
function exportBook(b){let md=`# ${b.name}\n`;
  for(const s of b.sections){md+=`\n## ${s.name}\n`;for(const{p,d}of(()=>{const o=[];const w=(par,dd)=>s.pages.filter(q=>q.parent===par).forEach(q=>{o.push({p:q,d:dd});w(q.id,dd+1)});w('',0);return o})()){
    md+=`\n${'#'.repeat(Math.min(6,3+d))} ${p.title||'Ohne Titel'}\n\n${(DB.dpages[p.id]||{}).body||''}\n`}}
  download(b.name.replace(/[\\/:*?"<>|]+/g,'_')+'.md',md,'text/markdown')}
