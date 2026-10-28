/* Kanban Notizen · Alle Notizen, Archiv, Heute */
'use strict';
/* ============ Pinnwand, Archiv, Heute ============ */
function renderWall(el){const s=sp(),notes=live(s).filter(n=>matches(s,n)).sort((a,b)=>(b.pinned-a.pinned)||b.updated.localeCompare(a.updated));
  el.innerHTML=`<div class="scroll wall-wrap" id="bw">${notes.length?`<div class="wall">${notes.map(n=>cardHTML(s,n,{showCol:true,wall:true})).join('')}</div>`:`<div class="empty-big">${live(s).length?'Keine Notiz passt zu den Filtern.':'Noch keine Notizen. Mit „+ Notiz“ oder der Taste N legst du die erste an.'}</div>`}</div>`;
  bindCards(el)}
function renderArchive(el){const s=sp(),notes=s.notes.filter(n=>n.archived).sort((a,b)=>b.updated.localeCompare(a.updated));
  el.innerHTML=`<div class="scroll wall-wrap" id="bw">${notes.length?`<div class="row-btns" style="margin:4px 0 14px"><span class="muted">${notes.length} archivierte Notiz${notes.length===1?'':'en'} – sie erscheinen nicht auf dem Board.</span><span class="spacer"></span><button class="btn sm danger" id="purgeAll">Archiv leeren …</button></div><div class="wall">${notes.map(n=>cardHTML(s,n,{showCol:true,wall:true,archive:true,ro:true})).join('')}</div>`:'<div class="empty-big">Das Archiv ist leer. Notizen archivierst du im Editor über „Archivieren“.</div>'}</div>`;
  bindCards(el);
  $$('[data-restore]',el).forEach(b=>b.onclick=e=>{e.stopPropagation();const n=byId(s,b.dataset.restore);n.archived=false;n.order=maxOrder(s,n.colId)+1;n.updated=now();save();render();toast('Notiz wiederhergestellt')});
  $$('[data-purge]',el).forEach(b=>b.onclick=e=>{e.stopPropagation();const snap=JSON.stringify(DB),n=byId(s,b.dataset.purge);if(!n)return;trashNote(s,n);save();render();toast('In den Papierkorb verschoben',{undo:snap})});
  const pa=$('#purgeAll',el);if(pa)pa.onclick=async()=>{const r=await ask({title:'Archiv leeren?',text:`${notes.length} archivierte Notizen werden in den Papierkorb verschoben und dort nach ${TRASH_DAYS} Tagen endgültig gelöscht.`,ok:'In den Papierkorb',danger:true});if(!r)return;const snap=JSON.stringify(DB);s.notes.filter(n=>n.archived).forEach(n=>trashNote(s,n));save();render();toast('Archiv geleert',{undo:snap})}}
function renderToday(el){const t=today(),end=addDays(t,7),L=[];
  for(const{s,n}of allNotes())if(!isDone(s,n))L.push({s,n});
  const by=(f)=>L.filter(f).sort((a,b)=>(a.n.due+(a.n.dueTime||'99')).localeCompare(b.n.due+(b.n.dueTime||'99'))||PRANK(a.n.prio)-PRANK(b.n.prio));
  const secs=[['Überfällig',by(x=>x.n.due&&dueState(x.s,x.n)==='late'),'late'],['Heute',by(x=>x.n.due===t&&dueState(x.s,x.n)!=='late'),''],['Morgen',by(x=>x.n.due===addDays(t,1)),''],
    ['Nächste 7 Tage',by(x=>x.n.due>addDays(t,1)&&x.n.due<=end),''],['Angeheftet',L.filter(x=>x.n.pinned&&!(x.n.due&&x.n.due<=end)),'']];
  const run=runningTimer();
  const todayMin=allNotes().reduce((a,{n})=>a+n.time.filter(x=>x.day===t).reduce((b,x)=>b+x.min,0),0);
  let html=`<div class="tsum"><div class="kpi"><div class="kpi-n">${secs[0][1].length}</div><div class="kpi-l">Überfällig</div></div><div class="kpi"><div class="kpi-n">${secs[1][1].length}</div><div class="kpi-l">Heute fällig</div></div><div class="kpi"><div class="kpi-n">${secs[3][1].length+secs[2][1].length}</div><div class="kpi-l">Bis in 7 Tagen</div></div><div class="kpi"><div class="kpi-n">${hm(todayMin)}</div><div class="kpi-l">Heute erfasst${run?' · Timer läuft':''}</div></div></div>`;
  let any=false;
  for(const[name,list,cls]of secs){if(!list.length)continue;any=true;
    html+=`<div class="sec-title${cls?' '+cls:''}">${name}<span class="badge soft">${list.length}</span></div><div class="wall">${list.map(x=>cardHTML(x.s,x.n,{showSpace:true,showCol:true,wall:true})).join('')}</div>`}
  if(!any)html+='<div class="empty-big">Keine Termine in den nächsten 7 Tagen und nichts angeheftet. Termine setzt du im Editor einer Notiz.</div>';
  el.innerHTML=`<div class="scroll wall-wrap" id="bw">${html}</div>`;bindCards(el)}
