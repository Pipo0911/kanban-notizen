/* Kanban Notizen · Zeitbericht, Drucken, Markdown-Export */
'use strict';
/* ============ Zeiterfassung (Bericht) ============ */
function periodRange(p){const t=today(),d=dow(t),mon=addDays(t,-((d+6)%7));
  switch(p){case'today':return[t,t,'Heute'];case'yesterday':return[addDays(t,-1),addDays(t,-1),'Gestern'];
    case'week':return[mon,addDays(mon,6),'Diese Woche (KW '+isoWeek(t)+')'];case'lastweek':return[addDays(mon,-7),addDays(mon,-1),'Letzte Woche (KW '+isoWeek(addDays(mon,-7))+')'];
    case'month':return[t.slice(0,8)+'01',t,new Date(t+'T12:00').toLocaleDateString('de-CH',{month:'long',year:'numeric'})];
    case'lastmonth':{const[y,m]=t.split('-').map(Number);const py=m===1?y-1:y,pm=m===1?12:m-1,last=new Date(py,pm,0).getDate(),a=`${py}-${String(pm).padStart(2,'0')}-01`;return[a,`${py}-${String(pm).padStart(2,'0')}-${last}`,new Date(a+'T12:00').toLocaleDateString('de-CH',{month:'long',year:'numeric'})]}
    default:return['0000-01-01','9999-12-31','Alle Einträge']}}
function timeRows(p){const[a,b]=periodRange(p),rows=[];
  for(const{s,n}of allNotes())for(const t of n.time)if(t.day>=a&&t.day<=b)rows.push({s,n,t});
  rows.sort((x,y)=>y.t.day.localeCompare(x.t.day)||(y.t.start||'').localeCompare(x.t.start||''));return rows}
function renderTime(el){const p=ui.period,[a,b,label]=periodRange(p),rows=timeRows(p),tot=rows.reduce((x,r)=>x+r.t.min,0);
  const days=[...new Set(rows.map(r=>r.t.day))];const perNote={};rows.forEach(r=>{const k=r.s.id+'/'+r.n.id;(perNote[k]=perNote[k]||{s:r.s,n:r.n,min:0}).min+=r.t.min});
  const top=Object.values(perNote).sort((x,y)=>y.min-x.min);const run=runningTimer();
  el.innerHTML=`<div class="scroll" id="bw"><div class="page wide">
  <div class="row-btns" style="margin-bottom:14px"><select id="per" aria-label="Zeitraum">${[['today','Heute'],['yesterday','Gestern'],['week','Diese Woche'],['lastweek','Letzte Woche'],['month','Dieser Monat'],['lastmonth','Letzter Monat'],['all','Alle']].map(([k,n])=>`<option value="${k}"${p===k?' selected':''}>${n}</option>`).join('')}</select><span class="muted">${esc(label)}${p!=='all'?' · '+fmtDate(a)+(a!==b?' – '+fmtDate(b):''):''}</span><span class="spacer"></span><button class="btn" id="tCsv"${rows.length?'':' disabled'}>CSV für Excel</button><button class="btn" id="tPrint"${rows.length?'':' disabled'}>Drucken / PDF</button></div>
  <div class="tsum"><div class="kpi"><div class="kpi-n">${hm(tot)}</div><div class="kpi-l">Stunden total</div></div><div class="kpi"><div class="kpi-n">${(tot/60).toFixed(2)}</div><div class="kpi-l">Dezimal-Stunden</div></div><div class="kpi"><div class="kpi-n">${rows.length}</div><div class="kpi-l">Einträge</div></div><div class="kpi"><div class="kpi-n">${top.length}</div><div class="kpi-l">Notizen</div></div></div>
  ${run?`<div class="panel" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span>Läuft gerade: <b>${esc(noteLabel(run.n))}</b> · ${esc(run.s.name)}</span><span class="spacer"></span><button class="btn ok sm" data-act="stopRun">■ Stoppen</button></div>`:''}
  ${rows.length?`<div class="panel"><h3>Einträge</h3><div class="tbl-wrap"><table class="ttable"><thead><tr><th>Notiz</th><th>Space</th><th>Beschreibung</th><th class="r">Dauer</th></tr></thead><tbody>
    ${days.map(d=>{const dr=rows.filter(r=>r.t.day===d),dt=dr.reduce((x,r)=>x+r.t.min,0);return`<tr class="day"><td colspan="3">${WD[dow(d)]}, ${fmtDate(d)}</td><td class="r">${hm(dt)}</td></tr>`+dr.map(r=>`<tr class="clk" data-sid="${r.s.id}" data-nid="${r.n.id}"><td>${esc(noteLabel(r.n))}</td><td class="muted">${esc(r.s.name)}</td><td class="muted">${esc(r.t.text)||(r.t.start?new Date(r.t.start).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})+'–'+new Date(r.t.end).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}):'')}</td><td class="r">${hm(r.t.min)}</td></tr>`).join('')}).join('')}
    </tbody></table></div></div>
    <div class="panel"><h3>Nach Notiz</h3><div class="tbl-wrap"><table class="ttable"><tbody>${top.map(x=>`<tr class="clk" data-sid="${x.s.id}" data-nid="${x.n.id}"><td>${esc(noteLabel(x.n))}</td><td class="muted">${esc(x.s.name)}</td><td>${x.n.tags.map(lblHTML).join(' ')}</td><td class="r">${hm(x.min)}</td></tr>`).join('')}</tbody></table></div></div>`
    :`<div class="empty-big">Keine Zeiten im gewählten Zeitraum. Starte die Zeiterfassung mit ▶ auf einer Notiz oder erfasse Zeit im Editor.</div>`}
  <p class="muted sm">Rundung beim Stoppen: ${DB.settings.round?'auf '+DB.settings.round+' Minuten aufrunden':'keine'} – änderbar unter Einstellungen.</p></div></div>`;
  $('#per',el).onchange=e=>{ui.period=e.target.value;renderContent()};
  $$('tr.clk',el).forEach(r=>r.onclick=()=>openNote(r.dataset.sid,r.dataset.nid));
  $('#tCsv',el).onclick=()=>{const q=v=>{v=String(v??'');return/[";\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
    const lines=[['Datum','Space','Notiz','Labels','Beschreibung','Start','Ende','Minuten','Stunden'].join(';'),...[...rows].reverse().map(r=>[fmtDate(r.t.day),r.s.name,noteLabel(r.n),r.n.tags.join(', '),r.t.text,r.t.start?new Date(r.t.start).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}):'',r.t.end?new Date(r.t.end).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}):'',r.t.min,(r.t.min/60).toFixed(2).replace('.',',')].map(q).join(';'))];
    download(`zeiterfassung-${a===b?a:a+'_'+b}.csv`.replace('0000-01-01_9999-12-31','alle'),'﻿'+lines.join('\r\n'),'text/csv;charset=utf-8')};
  $('#tPrint',el).onclick=()=>printTime(p)}
/* ============ Drucken / PDF ============ */
function printNoteHTML(s,n,showSpace){const col=colOf(s,n);
  const meta=[showSpace?s.name:'',col.name,n.due?'Termin '+fmtDate(n.due)+(n.dueTime?' '+n.dueTime:''):'',n.prio?'Priorität '+PRIO[n.prio].n:'',n.tags.length?n.tags.join(', '):'',n.time.length?'Zeit '+hShort(timeTotal(n)):''].filter(Boolean).join(' · ');
  return`<div class="pn"><h3>${esc(noteLabel(n))}</h3>${meta?`<div class="pm">${esc(meta)}</div>`:''}${n.body.trim()?`<div class="md">${md(n.body)}</div>`:''}${n.checklist.length?`<ul class="pck">${n.checklist.map(c=>`<li class="${c.done?'done':''}">${esc(c.text)}</li>`).join('')}</ul>`:''}${n.images.map(i=>`<img src="${i.data}" alt="">`).join('')}</div>`}
function doPrint(html){const pa=$('#printArea');pa.innerHTML=html;setTimeout(()=>{window.print();setTimeout(()=>pa.innerHTML='',500)},60)}
function printNotes(title,list,single){doPrint(`<h1>${esc(title)}</h1><div class="pmeta">Gedruckt am ${fmtTime(now())}</div>${list.map(x=>printNoteHTML(x.s,x.n,!single)).join('')}`)}
function printSpace(s){let h=`<h1>${esc(s.name)}</h1><div class="pmeta">${s.desc?esc(s.desc)+' · ':''}Stand ${fmtTime(now())}</div>`;
  s.columns.forEach(c=>{const l=live(s).filter(n=>n.colId===c.id).sort(dispSort);if(l.length)h+=`<h2>${esc(c.name)}</h2>`+l.map(n=>printNoteHTML(s,n)).join('')});doPrint(h)}
function printTime(p){const[a,b,label]=periodRange(p),rows=timeRows(p),tot=rows.reduce((x,r)=>x+r.t.min,0),days=[...new Set(rows.map(r=>r.t.day))].sort();
  doPrint(`<h1>Zeiterfassung</h1><div class="pmeta">${esc(label)}${p!=='all'?' · '+fmtDate(a)+' – '+fmtDate(b):''} · Total ${hm(tot)} h (${(tot/60).toFixed(2)})</div><table><thead><tr><th>Notiz</th><th>Space</th><th>Beschreibung</th><th class="r">Dauer</th></tr></thead><tbody>${days.map(d=>{const dr=rows.filter(r=>r.t.day===d).reverse();return`<tr class="day"><td colspan="3">${WD[dow(d)]}, ${fmtDate(d)}</td><td class="r">${hm(dr.reduce((x,r)=>x+r.t.min,0))}</td></tr>`+dr.map(r=>`<tr><td>${esc(noteLabel(r.n))}</td><td>${esc(r.s.name)}</td><td>${esc(r.t.text)}</td><td class="r">${hm(r.t.min)}</td></tr>`).join('')}).join('')}</tbody></table>`)}
function exportMd(s){const L=[`# ${s.name}`,''];if(s.desc)L.push(s.desc,'');
  const sec=(name,list)=>{if(!list.length)return;L.push(`## ${name}`,'');list.forEach(n=>{L.push(noteText(s,n).replace(/^# /,'### '),'')})};
  s.columns.forEach(c=>sec(c.name,live(s).filter(n=>n.colId===c.id).sort(dispSort)));sec('Archiv',s.notes.filter(n=>n.archived));
  download(`${safeName(s.name)}-${today()}.md`,L.join('\n'),'text/markdown')}
