/* Kanban Notizen · Wiki-Links, Rückverweise, Tagesnotiz, Favoriten */
'use strict';

/* ---------- Wiki-Links: [[Titel]] und [[Titel|Anzeigetext]] ---------- */
const WL_RE=/\[\[([^\[\]|\n]{1,200}?)(?:\|([^\[\]\n]{1,200}?))?\]\]/g;
const reEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const linkKey=t=>String(t||'').trim().toLowerCase();

/* Findet die Notiz zu einem Link. Bevorzugt: gleicher Space, nicht archiviert. Datum (JJJJ-MM-TT) = Tagesnotiz. */
function resolveLink(target,sid){const t=String(target||'').trim();if(!t)return null;
  if(isDate(t)){for(const x of allNotes())if(x.n.daily===t)return x}
  const k=t.toLowerCase();let best=null,score=-1;
  for(const x of allNotes()){if(linkKey(x.n.title)!==k)continue;const sc=(x.s.id===sid?2:0)+(x.n.archived?0:1);if(sc>score){best=x;score=sc}}
  return best}
function linkTargets(body){const out=[];String(body||'').replace(WL_RE,(_,t)=>{out.push(t.trim());return''});return out}
function wikiHTML(target,alias){const t=target.trim(),r=resolveLink(t,linkCtx);
  const label=alias?alias.trim():isDate(t)?fmtDate(t):t;
  return`<a class="wl${r?'':' missing'}" href="#" data-wl="${esc(t)}" title="${r?esc('Öffnen: '+noteLabel(r.n)+' · '+r.s.name):esc('Notiz „'+t+'“ erstellen')}">${esc(label)}</a>`}
/* Space, aus dem gerade gerendert wird (für die Auflösung gleichnamiger Notizen) */
let linkCtx='';

/* Notizen, die auf n verlinken */
function backlinks(n){const keys=new Set([linkKey(n.title)].filter(Boolean));if(n.daily)keys.add(n.daily);if(!keys.size)return[];const out=[];
  for(const x of allNotes()){if(x.n===n)continue;const lines=String(x.n.body).split('\n');
    const hit=lines.find(l=>{let f=false;l.replace(WL_RE,(_,t)=>{const k=t.trim();if(keys.has(k.toLowerCase())||keys.has(k))f=true;return''});return f});
    if(hit!==undefined)out.push({s:x.s,n:x.n,line:hit.trim()})}
  return out.sort((a,b)=>b.n.updated.localeCompare(a.n.updated))}

/* Nach dem Umbenennen: Links in allen anderen Notizen nachziehen */
function relinkTitle(n,oldTitle){const o=oldTitle.trim(),nw=n.title.trim();if(!o||!nw||linkKey(o)===linkKey(nw))return 0;
  const other=allNotes().find(x=>x.n!==n&&linkKey(x.n.title)===linkKey(o));if(other)return 0;
  const re=new RegExp('\\[\\['+reEsc(o)+'(\\|[^\\[\\]\\n]*)?\\]\\]','gi');let cnt=0;
  for(const x of allNotes()){if(x.n===n||!re.test(x.n.body))continue;re.lastIndex=0;x.n.body=x.n.body.replace(re,(_,al)=>{cnt++;return'[['+nw+(al||'')+']]'})}
  return cnt}

/* Klick auf einen Link (Karte, Vorschau, Rückverweis) */
let edStack=[];
function followLink(target,sid){const t=String(target||'').trim();if(!t)return;
  if(isDate(t)){openDaily(t,{fromLink:true});return}
  const r=resolveLink(t,sid);
  if(r){openNote(r.s.id,r.n.id,{fromLink:true});return}
  const s=spaceById(sid)||sp(),n=newNote(s,{title:t});n.updated=now();save();render();
  openNote(s.id,n.id,{fromLink:true});toast(`Notiz „${t}“ erstellt`)}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.wl');if(!a)return;e.preventDefault();e.stopPropagation();
  const c=a.closest('[data-sid]'),ed=a.closest('#ed');followLink(a.dataset.wl,c?c.dataset.sid:ed?ed.dataset.sid:DB.active)},true);

/* ---------- Autovervollständigung im Editor nach „[[“ ---------- */
function caretXY(ta,pos){const m=document.createElement('div'),cs=getComputedStyle(ta);
  for(const p of['boxSizing','width','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','tabSize','wordSpacing'])m.style[p]=cs[p];
  Object.assign(m.style,{position:'absolute',visibility:'hidden',whiteSpace:'pre-wrap',overflowWrap:'break-word',top:'0',left:'-9999px'});
  m.textContent=ta.value.slice(0,pos);const sp_=document.createElement('span');sp_.textContent='​';m.appendChild(sp_);document.body.appendChild(m);
  const r=ta.getBoundingClientRect(),x=r.left+sp_.offsetLeft-ta.scrollLeft,y=r.top+sp_.offsetTop-ta.scrollTop+parseFloat(cs.lineHeight||'20');m.remove();return{x,y}}
function linkAC(ta,n,sid,onPick){let pop=null,items=[],sel=0,start=-1;
  const close=()=>{if(pop){pop.remove();pop=null}start=-1};
  const pick=k=>{const it=items[k];if(!it)return;const p=ta.selectionStart;let end=p;if(ta.value.slice(p,p+2)===']]')end=p+2;
    ta.setRangeText('[['+it.ins+']]',start,end,'end');close();onPick()};
  const draw=()=>{pop.innerHTML=items.map((it,k)=>`<div class="ac-it${k===sel?' on':''}" data-k="${k}"><span class="ac-t">${esc(it.t)}</span>${it.sub?`<span class="ac-s">${esc(it.sub)}</span>`:''}</div>`).join('');
    $$('.ac-it',pop).forEach(x=>{x.onmousedown=e=>{e.preventDefault();pick(+x.dataset.k)}})};
  const update=()=>{const p=ta.selectionStart,before=ta.value.slice(0,p),m=before.match(/\[\[([^\[\]\n|]{0,80})$/);
    if(!m||ta.selectionStart!==ta.selectionEnd){close();return}
    start=p-m[0].length;const q=m[1].trim().toLowerCase();
    const cand=allNotes().filter(x=>x.n!==n&&x.n.title.trim()).map(x=>{const t=x.n.title.trim(),lo=t.toLowerCase(),i=q?lo.indexOf(q):0;
      return i<0?null:{x,t,score:(i===0?4:0)+(x.s.id===sid?2:0)+(x.n.archived?-3:0)+(lo===q?10:0)}}).filter(Boolean)
      .sort((a,b)=>b.score-a.score||b.x.n.updated.localeCompare(a.x.n.updated));
    const seen=new Set();items=[];
    for(const c of cand){const k=c.t.toLowerCase();if(seen.has(k))continue;seen.add(k);items.push({t:c.t,ins:c.t,sub:c.x.s.name+(c.x.n.daily?' · Tagesnotiz':'')});if(items.length>=8)break}
    if(q&&!seen.has(q))items.push({t:`Neue Notiz „${m[1].trim()}“`,ins:m[1].trim(),sub:'wird beim Klick auf den Link erstellt'});
    if(!items.length){close();return}
    sel=Math.min(sel,items.length-1);
    if(!pop){pop=document.createElement('div');pop.className='ac-pop';pop.setAttribute('role','listbox');ta.closest('dialog').appendChild(pop)}
    draw();const{x,y}=caretXY(ta,start),W=320;pop.style.left=Math.max(8,Math.min(x,innerWidth-W-8))+'px';
    const h=pop.offsetHeight;pop.style.top=(y+h+8>innerHeight?y-h-28:y+2)+'px'};
  ta.addEventListener('input',()=>{sel=0;update()});
  ta.addEventListener('click',update);ta.addEventListener('blur',()=>setTimeout(close,120));
  return{open:()=>!!pop,close,key:e=>{if(!pop)return false;
    if(e.key==='ArrowDown'){e.preventDefault();sel=(sel+1)%items.length;draw();return true}
    if(e.key==='ArrowUp'){e.preventDefault();sel=(sel-1+items.length)%items.length;draw();return true}
    if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();pick(sel);return true}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return true}
    return false}}}

/* ---------- Tagesnotiz ---------- */
const dailyTitle=d=>`Tagesnotiz ${WDL[dow(d)]}, ${fmtDate(d)}`;
function dailySpace(){const S=DB.settings.daily;let s=spaceById(S.space);
  if(!s){s=DB.spaces.find(x=>x.name==='Tagesnotizen');
    if(!s){s=makeSpace('Tagesnotizen','#1f8fbf','leer','Eine Notiz pro Tag – öffnen mit der Taste D.');s.columns[0].name='Tage';DB.spaces.push(s)}
    S.space=s.id}
  return s}
function findDaily(d){for(const x of allNotes())if(x.n.daily===d)return x;return null}
function openDaily(d,opt={}){d=isDate(d)?d:today();let x=findDaily(d);
  if(!x){const s=dailySpace(),body=fillVars(DB.settings.daily.tpl,d);
    const n=newNote(s,{title:dailyTitle(d),body,daily:d});n._dailyFresh=body;x={s,n};save(true);render()}
  openNote(x.s.id,x.n.id,opt)}
/* Unveränderte, leere Tagesnotiz wieder entfernen (z. B. nach dem Blättern) */
function dailyUntouched(n){return n._dailyFresh!==undefined&&n.body===n._dailyFresh&&n.title===dailyTitle(n.daily)&&!n.checklist.length&&!n.images.length&&!n.time.length&&!n.timerStart}

/* ---------- Favoriten ---------- */
function favorites(){return allNotes().filter(x=>x.n.fav&&!x.n.archived).sort((a,b)=>noteLabel(a.n).localeCompare(noteLabel(b.n)))}
function favHTML(){const f=favorites();if(!f.length)return'';
  return`<div class="side-h"><span>Favoriten</span></div><nav class="nav">${f.map(x=>`<button class="nav-item fav-it" data-act="openNote" data-nsid="${x.s.id}" data-nid="${x.n.id}" title="${esc(noteLabel(x.n)+' · '+spaceLabel(x.s))}"><span class="fav-dot" style="background:${esc(x.s.color)}"></span><span class="sp-n">${esc(noteLabel(x.n))}</span></button>`).join('')}</nav>`}
