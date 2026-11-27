/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Notara · Alle Notizen, Archiv, Heute */
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
  const kpi=`<div class="tsum"><div class="kpi"><div class="kpi-n">${secs[0][1].length}</div><div class="kpi-l">Überfällig</div></div><div class="kpi"><div class="kpi-n">${secs[1][1].length}</div><div class="kpi-l">Heute fällig</div></div><div class="kpi"><div class="kpi-n">${secs[3][1].length+secs[2][1].length}</div><div class="kpi-l">Bis in 7 Tagen</div></div><div class="kpi"><div class="kpi-n">${hm(todayMin)}</div><div class="kpi-l">Heute erfasst${run?' · Timer läuft':''}</div></div></div>`;let html='';
  const ups=upcomingReminders(2,8);
  if(ups.length)html+=`<div class="sec-title">Nächste Erinnerungen<span class="badge soft">${ups.length}</span></div><div class="rem-up wide">${ups.map(x=>`<button type="button" class="rem-it" data-act="openNote" data-nsid="${x.s.id}" data-nid="${x.n.id}"><span class="rem-t">${esc(fmtRemind(x.t))}</span><span>${esc(noteLabel(x.n))}</span><span class="muted sm">${esc(x.s.name)}</span></button>`).join('')}</div>`;
  let any=false;
  for(const[name,list,cls]of secs){if(!list.length)continue;any=true;
    html+=`<div class="sec-title${cls?' '+cls:''}">${name}<span class="badge soft">${list.length}</span></div><div class="wall">${list.map(x=>cardHTML(x.s,x.n,{showSpace:true,showCol:true,wall:true})).join('')}</div>`}
  if(!any)html+='<div class="empty-big today-empty">Keine Termine in den nächsten 7 Tagen und nichts angeheftet. Termine setzt du im Editor einer Notiz oder direkt im Kalender.</div>';
  el.innerHTML=`<div class="scroll wall-wrap" id="bw">${kpi}<section class="today-cal" id="tCal" aria-label="Kalender"></section><div class="today-main">${html}</div></div>`;
  bindCards(el);drawCal($('#tCal',el))}

/* ============ Kalender auf „Heute & Termine“ ============ */
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WD_SHORT=['Mo','Di','Mi','Do','Fr','Sa','So'];
const WD_LONG=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const calColor=n=>n.color&&n.color!=='default'?colHex(n.color):n.prio?PRIO[n.prio].c:'var(--accent)';
/* Alle Einträge im Zeitraum, inkl. kommender Wiederholungen (nur Vorschau) */
function calItems(from,to){const out={},put=(d,x)=>{(out[d]=out[d]||[]).push(x)};
  for(const{s,n}of allNotes()){if(!n.due)continue;const done=isDone(s,n);
    if(n.due>=from&&n.due<=to)put(n.due,{s,n,done,rep:false});
    if(n.repeat&&!done){let d=n.due,i=0;while(i++<400){d=advance(d,n.repeat);if(d>to)break;if(d>=from)put(d,{s,n,done:false,rep:true})}}}
  for(const d in out)out[d].sort((a,b)=>(a.done-b.done)||(a.n.dueTime||'99').localeCompare(b.n.dueTime||'99')||PRANK(a.n.prio)-PRANK(b.n.prio));
  return out}
function drawCal(box){if(!box)return;const t=today();
  if(!isDate(ui.calD))ui.calD=t;if(!/^\d{4}-\d{2}$/.test(ui.calM||''))ui.calM=ui.calD.slice(0,7);
  const[y,m]=ui.calM.split('-').map(Number),first=`${ui.calM}-01`,start=addDays(first,-((dow(first)+6)%7)),end=addDays(start,41);
  const items=calItems(start,end),daily=new Set(),ds=dailySpaceId();
  for(const{n}of allNotes())if(n.daily&&n.daily>=start&&n.daily<=end&&!n.archived)daily.add(n.daily);
  const phone=isPhone(),max=phone?4:Math.max(3,Math.floor((innerHeight-330)/6/20)-1);let g='';
  for(let w=0;w<6;w++){const wk=addDays(start,w*7);g+=`<div class="cal-kw">${isoWeek(wk)}</div>`;
    for(let i=0;i<7;i++){const d=addDays(wk,i),L=items[d]||[],cls=['cal-d'];
      if(d.slice(0,7)!==ui.calM)cls.push('out');if(d===t)cls.push('today');if(d===ui.calD)cls.push('sel');if(i>4)cls.push('we');if(L.some(x=>!x.done&&!x.rep&&d<t))cls.push('late');
      g+=`<div class="${cls.join(' ')}" data-cday="${d}" role="button" tabindex="0" aria-label="${WD_LONG[dow(d)]}, ${fmtDate(d)}${L.length?', '+L.length+' Einträge':''}"><div class="cal-n"><span>${+d.slice(8)}</span>${daily.has(d)?'<i class="cal-dn" title="Tagesnotiz vorhanden"></i>':''}</div>`+
        L.slice(0,max).map(x=>`<div class="cal-it${x.done?' done':''}${x.rep?' rep':''}" ${x.rep||x.done?'':'draggable="true"'} data-cnid="${x.n.id}" data-cnsid="${x.s.id}" style="--c:${calColor(x.n)}" title="${esc(noteLabel(x.n))}${x.n.dueTime?' · '+x.n.dueTime:''}${x.rep?' (Wiederholung)':''} · ${esc(x.s.name)}">${x.n.dueTime&&!phone?`<b>${x.n.dueTime}</b> `:''}${esc(noteLabel(x.n))}</div>`).join('')+
        (L.length>max?`<div class="cal-more">+${L.length-max}</div>`:'')+'</div>'}}
  const sel=items[ui.calD]||(ui.calD>=start&&ui.calD<=end?[]:calItems(ui.calD,ui.calD)[ui.calD]||[]);
  const real=sel.filter(x=>!x.rep),reps=sel.filter(x=>x.rep);
  box.innerHTML=`<div class="cal">
    <div class="cal-h"><b>${MONTHS[m-1]} ${y}</b><span class="cal-nav"><button type="button" class="icon-btn" data-calnav="-1" aria-label="Voriger Monat">‹</button><button type="button" class="btn sm ghost" data-calnav="0">Heute</button><button type="button" class="icon-btn" data-calnav="1" aria-label="Nächster Monat">›</button></span></div>
    <div class="cal-g"><div class="cal-wh">KW</div>${WD_SHORT.map((x,i)=>`<div class="cal-wh${i>4?' we':''}">${x}</div>`).join('')}${g}</div>
    <div class="cal-day"><div class="cal-day-h"><b>${WD_LONG[dow(ui.calD)]}, ${fmtDate(ui.calD)}</b><span><button type="button" class="btn sm ghost" data-caldaily>Tagesnotiz</button><button type="button" class="btn sm primary" data-calnew>+ Termin</button></span></div>
      ${real.length?`<div class="cal-list">${real.map(x=>cardHTML(x.s,x.n,{showSpace:true,showCol:true,wall:true})).join('')}</div>`:''}
      ${reps.length?`<div class="cal-reps">${reps.map(x=>`<button type="button" class="cal-rep" data-cnid="${x.n.id}" data-cnsid="${x.s.id}" style="--c:${calColor(x.n)}">↻ ${esc(noteLabel(x.n))}${x.n.dueTime?' · '+x.n.dueTime:''}<span class="muted sm">wiederholt sich · ${esc(x.s.name)}</span></button>`).join('')}</div>`:''}
      ${!real.length&&!reps.length?'<div class="muted sm cal-empty">Nichts an diesem Tag. Doppelklick auf einen Tag oder „+ Termin“ legt einen Termin an. Termine lassen sich im Kalender auf einen anderen Tag ziehen.</div>':''}
    </div></div>`;
  bindCards(box);
  const day=d=>{ui.calD=d;if(d.slice(0,7)!==ui.calM)ui.calM=d.slice(0,7);drawCal(box)};
  $$('[data-calnav]',box).forEach(b=>b.onclick=()=>{const k=+b.dataset.calnav;if(!k){day(t);return}const nm=new Date(y,m-1+k,1);ui.calM=`${nm.getFullYear()}-${String(nm.getMonth()+1).padStart(2,'0')}`;drawCal(box)});
  $$('[data-cnid]',box).forEach(c=>c.addEventListener('click',e=>{e.stopPropagation();openNote(c.dataset.cnsid,c.dataset.cnid)}));
  $$('.cal-d',box).forEach(c=>{const d=c.dataset.cday;c.onclick=()=>day(d);c.ondblclick=e=>{if(!e.target.closest('[data-cnid]'))newDue(d)};
    c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();day(d)}};
    c.ondragover=e=>{if(e.dataTransfer.types.includes('text/kn-cal')){e.preventDefault();c.classList.add('drop')}};c.ondragleave=()=>c.classList.remove('drop');
    c.ondrop=e=>{e.preventDefault();c.classList.remove('drop');const[sid,nid]=(e.dataTransfer.getData('text/kn-cal')||'').split('|'),s=spaceById(sid),n=s&&s.notes.find(x=>x.id===nid);
      if(!n||n.due===d)return;const snap=JSON.stringify(DB);n.due=d;n.updated=now();save();render();toast(`„${noteLabel(n)}“ auf ${fmtDate(d)} verschoben`,{undo:snap})}});
  $$('.cal-it[draggable]',box).forEach(c=>c.ondragstart=e=>{e.dataTransfer.setData('text/kn-cal',c.dataset.cnsid+'|'+c.dataset.cnid);e.dataTransfer.effectAllowed='move'});
  $('[data-calnew]',box).onclick=()=>newDue(ui.calD);
  $('[data-caldaily]',box).onclick=()=>openDaily(ui.calD)}
function newDue(d){let s=sp();if(!s||s.id===dailySpaceId())s=DB.spaces.find(x=>x.id!==dailySpaceId())||s;if(!s)return;
  const n=newNote(s,{colId:firstOpenCol(s).id,due:d});n._new=true;if(s.kind==='page')toPage(n);openNote(s.id,n.id)}
