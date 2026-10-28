/* Kanban Notizen · Notizkarten und Board mit Ziehen */
'use strict';
/* ============ Karten ============ */
function cardHTML(s,n,opt={}){linkCtx=s.id;
  const st=dueState(s,n),done=isDone(s,n);
  const dn=n.checklist.filter(c=>c.done).length,tot=n.checklist.length,show=n.checklist.slice(0,opt.wall?8:5);
  const short=n.body.split('\n').length<=6&&n.body.length<280;
  const col=opt.showCol?colOf(s,n):null,tt=timeTotal(n),run=!!n.timerStart;
  return`<div class="card c-${n.color}${done?' is-done':''}${opt.ro?'':' has-play'}" data-id="${n.id}" data-sid="${s.id}" tabindex="0" role="button" aria-label="${esc(noteLabel(n))}">
  ${n.images.length?`<img class="n-img" src="${n.images[0].data}" alt="">`:''}
  ${n.pinned||n.fav?`<span class="pin">${n.fav?`<span class="fav-s" title="Favorit">${SVG.starOn}</span>`:''}${n.pinned?`<span title="Angeheftet">${SVG.pin}</span>`:''}</span>`:''}
  ${n.title.trim()?`<div class="n-title">${esc(n.title)}</div>`:''}
  ${n.body.trim()?`<div class="n-body md${short?' short':''}"${n.title.trim()?'':' style="margin-top:0"'}>${md(n.body)}</div>`:''}
  ${!n.title.trim()&&!n.body.trim()&&!tot&&!n.images.length?'<div class="n-title muted">Leere Notiz</div>':''}
  ${tot?`<div class="prog" title="${dn} von ${tot} erledigt"><div style="width:${dn/tot*100}%"></div></div><div class="n-ck">${show.map(c=>`<label class="ck-row${c.done?' done':''}"><input type="checkbox" data-ck="${n.id}:${c.id}"${c.done?' checked':''}${opt.ro?' disabled':''}><span>${esc(c.text)}</span></label>`).join('')}${tot>show.length?`<div class="ck-more">+ ${tot-show.length} weitere</div>`:''}</div>`:''}
  <div class="n-meta">${n.prio?prioIcon(n.prio):''}${opt.showSpace?`<span class="spchip"><i style="background:${esc(s.color)}"></i>${esc(s.name)}</span>`:''}${col?`<span class="colchip"><span class="col-dot" style="background:${NC[col.color].d}"></span>${esc(col.name)}</span>`:''}${n.due?`<span class="chip ${st}" title="Termin ${fmtDate(n.due)}${n.dueTime?' '+n.dueTime:''}">${SVG.cal}${fmtShort(n.due)}${n.dueTime?' '+n.dueTime:''}</span>`:''}${n.repeat?`<span class="chip" title="Wiederholt sich: ${REPEAT[n.repeat]}">${SVG.rep}</span>`:''}${run?`<span class="chip run">${SVG.clock}<span data-runclock="${n.id}">${clock(Date.now()-Date.parse(n.timerStart)).replace(/^00:/,'')}</span></span>`:tt?`<span class="chip" title="Erfasste Zeit">${SVG.clock}${hm(tt)}</span>`:''}${n.images.length>1?`<span class="chip">${SVG.img}${n.images.length}</span>`:''}${n.tags.map(lblHTML).join('')}</div>
  ${opt.ro?'':`<button class="play${run?' run':''}" data-play="${n.id}" title="${run?'Zeit stoppen':'Zeit starten'}" aria-label="${run?'Zeit stoppen':'Zeit starten'}">${run?'■':'▶'}</button>`}
  ${opt.archive?`<div class="arch-acts"><button class="btn sm" data-restore="${n.id}">Wiederherstellen</button><button class="btn sm danger" data-purge="${n.id}">Löschen</button></div>`:''}
  </div>`}
function bindCards(el,opt={}){
  $$('.card',el).forEach(c=>{const s=spaceById(c.dataset.sid);
    c.addEventListener('click',e=>{if(suppressClick||e.target.closest('input,button,a,label'))return;openNote(s.id,c.dataset.id)});
    c.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===c)openNote(s.id,c.dataset.id)});
    if(opt.drag)bindDrag(c)});
  $$('[data-ck]',el).forEach(b=>b.addEventListener('change',()=>{const s=spaceById(b.closest('.card').dataset.sid);const[nid,cid]=b.dataset.ck.split(':');const n=byId(s,nid);const it=n&&n.checklist.find(x=>x.id===cid);if(!it)return;it.done=b.checked;n.updated=now();save();setTimeout(renderContent,120)}));
  $$('[data-play]',el).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const s=spaceById(b.closest('.card').dataset.sid);const n=byId(s,b.dataset.play);if(n)toggleTimer(s,n)}))}
/* ============ Board ============ */
function renderBoard(el){
  const s=sp(),notes=live(s).filter(n=>matches(s,n));
  el.innerHTML=`<div class="scroll board-wrap" id="bw"><div class="board">${s.columns.map(c=>{const cn=notes.filter(n=>n.colId===c.id).sort(colSort(s)),all=live(s).filter(n=>n.colId===c.id).length;
    return`<section class="col" data-col="${c.id}"><header class="col-h"><span class="col-dot" style="background:${NC[c.color].d}"></span><span class="col-n" data-ren="${c.id}" title="Doppelklick zum Umbenennen">${esc(c.name)}</span><span class="col-c">${cn.length!==all?cn.length+'/':''}${all}</span>${c.done?'<span class="col-done" title="Notizen hier gelten als erledigt">✓</span>':''}<span class="spacer"></span><button class="icon-btn sm" data-addto="${c.id}" title="Notiz in „${esc(c.name)}“ erstellen" aria-label="Notiz hinzufügen">+</button></header>
    <div class="col-list" data-col="${c.id}">${cn.map(n=>cardHTML(s,n)).join('')||`<div class="col-empty">${all?'Keine Treffer':'Noch keine Notizen'}</div>`}</div>
    <button class="add-inline" data-inline="${c.id}">+ Schnelle Notiz</button></section>`}).join('')}
    <button class="addcol" data-act="addCol">+ Spalte hinzufügen</button></div></div>`;
  bindCards(el,{drag:true});
  $$('[data-addto]',el).forEach(b=>b.onclick=()=>createNote(s.id,b.dataset.addto));
  $$('[data-inline]',el).forEach(b=>b.onclick=()=>inlineAdd(b));
  $$('[data-ren]',el).forEach(x=>x.ondblclick=()=>renameCol(s,s.columns.find(c=>c.id===x.dataset.ren)))}
function inlineAdd(btn){const s=sp(),colId=btn.dataset.inline,w=document.createElement('div');w.className='inline-form';
  w.innerHTML='<textarea rows="3" placeholder="Notiz schreiben … (erste Zeile = Titel)" aria-label="Schnelle Notiz"></textarea><div class="hint"><kbd>Enter</kbd> speichern · <kbd>Shift</kbd>+<kbd>Enter</kbd> neue Zeile · <kbd>Esc</kbd> abbrechen</div>';
  btn.replaceWith(w);const ta=$('textarea',w);ta.focus();w.closest('.col').querySelector('.col-list').scrollTop=1e6;
  ta.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();renderContent();applyExternal()}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const t=ta.value.trim();if(!t)return;
    const[first,...rest]=t.split('\n');newNote(s,{colId,title:first.trim(),body:rest.join('\n').trim()});save();renderContent();renderSide();
    const nb=$(`[data-inline="${colId}"]`);if(nb)inlineAdd(nb)}};
  w.addEventListener('focusout',()=>setTimeout(()=>{if(w.isConnected&&!w.contains(document.activeElement)&&!ta.value.trim()){renderContent();applyExternal()}},200))}
function moveNote(s,id,colId,beforeId){
  const n=byId(s,id);if(!n)return;const wasDone=isDone(s,n);
  const list=live(s).filter(x=>x.colId===colId&&x.id!==id).sort(dispSort);
  let k=beforeId?list.findIndex(x=>x.id===beforeId):-1;if(k<0)k=list.length;list.splice(k,0,n);
  if(n.colId!==colId){n.colId=colId;n.updated=now()}
  list.forEach((x,i)=>x.order=i);afterDone(s,n,wasDone);save();render()}

/* Ziehen mit Maus und Touch */
let drag=null,suppressClick=false;
function bindDrag(card){
  card.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('input,button,a,label'))return;preDrag(card,e.clientX,e.clientY,false)});
  card.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('input,button,a,label'))return;const t=e.touches[0];preDrag(card,t.clientX,t.clientY,true)},{passive:true})}
function preDrag(card,x,y,touch){drag={id:card.dataset.id,sid:card.dataset.sid,card,sx:x,sy:y,x,y,started:false,touch};
  if(touch)drag.timer=setTimeout(()=>{if(drag&&!drag.started)startDrag()},300)}
function startDrag(){const d=drag,r=d.card.getBoundingClientRect();d.started=true;
  d.ox=d.sx-r.left;d.oy=d.sy-r.top;d.ghost=d.card.cloneNode(true);d.ghost.classList.add('drag-ghost');d.ghost.style.width=r.width+'px';d.ghost.style.left=r.left+'px';d.ghost.style.top=r.top+'px';
  document.body.appendChild(d.ghost);d.ph=document.createElement('div');d.ph.className='ph';d.ph.style.height=r.height+'px';d.card.before(d.ph);d.card.classList.add('dragging');
  document.body.classList.add('is-dragging');d.tick=setInterval(dragTick,30);placeDrag()}
function placeDrag(){const d=drag;d.ghost.style.left=(d.x-d.ox)+'px';d.ghost.style.top=(d.y-d.oy)+'px';
  const el=document.elementFromPoint(d.x,d.y);let list=el&&el.closest('.col-list');
  if(!list){let col=el&&el.closest('.col');
    if(!col){let best=null,bd=1e9;$$('.col').forEach(c=>{const r=c.getBoundingClientRect();if(r.right<0||r.left>innerWidth)return;const dd=d.x<r.left?r.left-d.x:d.x>r.right?d.x-r.right:0;if(dd<bd){bd=dd;best=c}});col=best}
    if(col)list=$('.col-list',col)}
  if(!list)return;const em=$('.col-empty',list);if(em)em.remove();
  const after=$$('.card:not(.dragging)',list).find(c=>{const r=c.getBoundingClientRect();return d.y<r.top+r.height/2});
  if(after){if(d.ph.nextElementSibling!==after)list.insertBefore(d.ph,after)}else if(list.lastElementChild!==d.ph)list.appendChild(d.ph)}
function dragTick(){if(!drag)return;const bw=$('#bw'),d=drag,W=innerWidth,E=56;
  if(bw){const r=bw.getBoundingClientRect(),v=W<860?9:16;if(d.x<Math.max(E,r.left+E))bw.scrollLeft-=v;else if(d.x>W-E)bw.scrollLeft+=v}
  const list=d.ph&&d.ph.parentElement;if(list&&list.classList.contains('col-list')){const r=list.getBoundingClientRect();if(d.y<r.top+40)list.scrollTop-=10;else if(d.y>r.bottom-40)list.scrollTop+=10}
  placeDrag()}
function endDrag(){const d=drag;clearInterval(d.tick);
  const list=d.ph.parentElement;let n=d.ph.nextElementSibling;while(n&&n.classList.contains('dragging'))n=n.nextElementSibling;
  const colId=list&&list.dataset.col,before=n&&n.classList.contains('card')?n.dataset.id:null;
  d.ghost.remove();d.ph.remove();d.card.classList.remove('dragging');document.body.classList.remove('is-dragging');drag=null;
  suppressClick=true;setTimeout(()=>suppressClick=false,60);
  if(colId)moveNote(spaceById(d.sid),d.id,colId,before);else renderContent();applyExternal()}
function cancelDrag(){const d=drag;clearInterval(d.tick);d.ghost.remove();d.ph.remove();d.card.classList.remove('dragging');document.body.classList.remove('is-dragging');drag=null;renderContent()}
document.addEventListener('pointermove',e=>{if(!drag||drag.touch)return;drag.x=e.clientX;drag.y=e.clientY;if(!drag.started){if(Math.hypot(drag.x-drag.sx,drag.y-drag.sy)>5)startDrag();return}placeDrag()});
document.addEventListener('pointerup',()=>{if(!drag||drag.touch)return;if(drag.started)endDrag();else drag=null});
document.addEventListener('touchmove',e=>{if(!drag)return;const t=e.touches[0];drag.x=t.clientX;drag.y=t.clientY;
  if(!drag.started){if(Math.hypot(drag.x-drag.sx,drag.y-drag.sy)>8){clearTimeout(drag.timer);drag=null}return}
  e.preventDefault();placeDrag()},{passive:false});
document.addEventListener('touchend',()=>{if(!drag)return;clearTimeout(drag.timer);if(drag.started)endDrag();else drag=null});
document.addEventListener('touchcancel',()=>{if(!drag)return;clearTimeout(drag.timer);if(drag.started)cancelDrag();else drag=null});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag&&drag.started)cancelDrag()});
