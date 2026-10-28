/* Kanban Notizen · Notiz-Editor */
'use strict';
/* ============ Editor ============ */
function createNote(sid,colId,tpl){const s=spaceById(sid)||sp();const n=newNote(s,{colId:colId||firstOpenCol(s).id});n._new=true;if(tpl)applyTpl(n,tpl);openNote(s.id,n.id)}
function applyTpl(n,t){t.tags.forEach(ensureLabel);n.title=fillVars(t.title);n.body=fillVars(t.body);n.color=t.color;n.tags=[...new Set([...n.tags,...t.tags])];n.checklist=t.checklist.map(x=>ck(fillVars(x)));n.updated=now()}
async function addImages(files,n,after){
  for(const f of files){if(!/^image\//.test(f.type))continue;
    try{const data=await shrink(f);n.images.push({id:uid(),data,name:f.name||'Bild'});n.updated=now()}catch(e){toast('Bild konnte nicht gelesen werden')}}
  after()}
function shrink(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const src=fr.result;
  if(file.size<350000&&/png|gif|webp/.test(file.type)){res(src);return}
  const im=new Image();im.onerror=rej;im.onload=()=>{const M=1600,k=Math.min(1,M/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.85))};im.src=src};fr.readAsDataURL(file)})}
function lightbox(src){const d=$('#lightbox');d.innerHTML=`<img src="${src}" alt="Bild">`;d.onclick=()=>d.close();d.showModal()}
let edCur=null,edNav=false,curAC=null;
function openNote(sid,id,opt={}){
  const s=spaceById(sid),n=s&&byId(s,id);if(!n)return;const dlg=$('#dlg');
  if(dlg.open){if(opt.fromLink&&edCur&&edCur.id!==id)edStack.push(edCur);
    edNav=true;const f=dlg.onclose;dlg.onclose=null;if(f)f();edNav=false}
  else if(!opt.back)edStack=[];
  edCur={sid:s.id,id:n.id};
  const before0={v:n._new?null:snapOf(n)},origTitle=n.title;
  if(DB.active!==s.id&&SPACE_VIEWS.includes(DB.ui.view)){DB.active=s.id;render()}
  ui.edTab=n.body.trim()&&!n._new&&n._dailyFresh===undefined?'preview':'write';
  let saveT;const touch=()=>{n.updated=now();clearTimeout(saveT);saveT=setTimeout(()=>{save();renderContent();renderSide()},450)};
  const flushNow=()=>{clearTimeout(saveT);save();render()};
  const prev=edStack[edStack.length-1],prevN=prev&&spaceById(prev.sid)&&byId(spaceById(prev.sid),prev.id);
  dlg.innerHTML=`<div class="ed" id="ed" data-sid="${s.id}">
  ${prevN||n.daily?`<div class="ed-nav">${prevN?`<button type="button" class="btn sm ghost" data-back title="Zurück zu „${esc(noteLabel(prevN))}“">‹ ${esc(noteLabel(prevN).slice(0,40))}</button>`:''}<span class="spacer"></span>${n.daily?`<div class="day-nav"><button type="button" class="icon-btn sm" data-day="-1" title="Vortag" aria-label="Vortag">‹</button><button type="button" class="day-pick" data-daypick title="Anderen Tag wählen">${esc(WDL[dow(n.daily)])}, ${esc(fmtDate(n.daily))}</button><input type="date" class="day-in" data-dayjump value="${n.daily}" tabindex="-1" aria-hidden="true"><button type="button" class="icon-btn sm" data-day="1" title="Folgetag" aria-label="Folgetag">›</button>${n.daily!==today()?'<button type="button" class="btn sm" data-day="0">Heute</button>':''}</div>`:''}</div>`:''}
  <div class="ed-top"><div class="dots" role="radiogroup" aria-label="Farbe">${NCOL.map(c=>`<button type="button" class="dot${n.color===c.id?' on':''}" style="background:${c.d}" data-color="${c.id}" title="${c.n}" aria-label="${c.n}"></button>`).join('')}</div><span class="ed-loc">${esc(s.name)}</span>
    <span class="spacer"></span><button type="button" class="icon-btn fav${n.fav?' on':''}" data-fav title="${n.fav?'Aus Favoriten entfernen':'Zu Favoriten'}" aria-label="Favorit" aria-pressed="${n.fav}">${n.fav?SVG.starOn:SVG.star}</button><button type="button" class="icon-btn${n.pinned?' on':''}" data-pin title="${n.pinned?'Lösen':'Anheften'}" aria-label="Anheften">${SVG.pin}</button><button type="button" class="icon-btn" data-close title="Schliessen (Esc)" aria-label="Schliessen">✕</button></div>
  <div class="ed-body">
    ${n._new&&DB.settings.templates.length?`<div class="tplbar" id="tplbar">Vorlage: ${DB.settings.templates.map(t=>`<button type="button" data-tpl="${t.id}">${esc(t.name)}</button>`).join('')}</div>`:''}
    <input class="ed-title" id="edTitle" placeholder="Titel" value="${esc(n.title)}" maxlength="200" aria-label="Titel">
    <div class="seg"><button type="button" data-tab="write">Schreiben</button><button type="button" data-tab="preview">Vorschau</button><span class="spacer"></span><span class="hint" style="margin:0">**fett** · *kursiv* · - [ ] Aufgabe · # Titel · [[Notiz]] verlinken</span></div>
    <div id="edTextWrap"></div>
    <div class="ed-sec"><div class="ed-sec-h">Checkliste <span class="muted sm" id="ckCnt"></span><span class="spacer"></span><button type="button" class="link sm" id="ckClear" hidden>Erledigte entfernen</button></div><div id="ckList"></div><input class="ck-add" id="ckAdd" placeholder="+ Punkt hinzufügen (Enter)" aria-label="Checklistenpunkt hinzufügen"></div>
    <div class="ed-grid">
      <div class="fld"><label for="edCol">Spalte</label><select id="edCol">${s.columns.map(c=>`<option value="${c.id}"${c.id===n.colId?' selected':''}>${esc(c.name)}${c.done?' ✓':''}</option>`).join('')}</select></div>
      <div class="fld"><label for="edDue">Termin</label><input type="date" id="edDue" value="${esc(n.due)}"></div>
      <div class="fld"><label for="edTime">Uhrzeit (Erinnerung)</label><input type="time" id="edTime" value="${esc(n.dueTime)}"${n.due?'':' disabled'}></div>
      <div class="fld"><label for="edRep">Wiederholen</label><select id="edRep">${Object.entries(REPEAT).map(([k,v])=>`<option value="${k}"${n.repeat===k?' selected':''}>${v}</option>`).join('')}</select></div>
      <div class="fld full"><label>Priorität</label><div class="prio-sel" id="edPrio">${[['','Keine'],...PRIOS.map(p=>[p.id,p.n])].map(([k,nm])=>`<button type="button" data-p="${k}"${n.prio===k?' class="on"':''}>${k?prioIcon(k,14):''}${nm}</button>`).join('')}</div></div>
      <div class="fld full"><label for="edLbl">Labels</label><div class="lbl-pick" id="lblPick"></div><small>Klick auf ein Label setzt oder entfernt es. Farben änderst du unter Einstellungen → Labels.</small></div>
    </div>
    <div class="ed-sec"><div class="ed-sec-h">Zeiterfassung <span class="muted sm" id="tmTot"></span><span class="spacer"></span><button type="button" class="btn sm" id="tmBtn"></button></div><div id="tmList"></div>
      <div class="tm-add"><input type="date" id="tmDay" value="${today()}" aria-label="Datum"><input class="min" id="tmMin" placeholder="z. B. 30 oder 1:15" aria-label="Dauer"><input class="txt" id="tmText" placeholder="Was wurde gemacht? (optional)" aria-label="Beschreibung"><button type="button" class="btn sm" id="tmAdd">Erfassen</button></div></div>
    <div class="ed-sec"><div class="ed-sec-h">Bilder <span class="muted sm" id="imCnt"></span></div><div class="thumbs" id="thumbs"></div><div class="dropzone" style="margin-top:8px">Screenshot mit <kbd>Strg</kbd>+<kbd>V</kbd> einfügen, Bild hierher ziehen oder <button type="button" class="link" id="imPick">Datei wählen</button></div></div>
    <div class="ed-sec" id="blSec"></div>
    <div class="ed-info" id="edInfo"></div>
  </div>
  <div class="ed-foot"><button type="button" class="btn sm ghost" data-copy title="Als Text in die Zwischenablage, z. B. für Tickets oder Mails">Kopieren</button><button type="button" class="btn sm ghost" data-print title="Drucken oder als PDF speichern">Drucken</button><button type="button" class="btn sm ghost" data-hist title="Frühere Versionen dieser Notiz">${SVG.hist} Verlauf${DB.history[n.id]?` <span class="muted">${DB.history[n.id].length}</span>`:''}</button><button type="button" class="btn sm ghost" data-astpl>Als Vorlage</button><button type="button" class="btn sm ghost" data-dup>Duplizieren</button><button type="button" class="btn sm ghost" data-move>Verschieben …</button><button type="button" class="btn sm ghost" data-arch>${n.archived?'Wiederherstellen':'Archivieren'}</button><span class="spacer"></span><button type="button" class="btn sm danger" data-del>Löschen</button><button type="button" class="btn sm primary" data-close>Fertig</button></div></div>`;
  const ed=$('#ed',dlg),tw=$('#edTextWrap',dlg);
  const info=()=>{$('#edInfo',dlg).textContent=`Erstellt ${fmtTime(n.created)} · Geändert ${rel(n.updated)}`};info();
  const drawText=()=>{$$('[data-tab]',dlg).forEach(b=>b.classList.toggle('on',b.dataset.tab===ui.edTab));
    if(ui.edTab==='write'){tw.innerHTML=`<textarea class="ed-text" id="edBody" placeholder="Notiz schreiben …" aria-label="Text">${esc(n.body)}</textarea>`;const ta=$('#edBody',dlg);
      const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(Math.max(ta.scrollHeight+4,150),560)+'px'};requestAnimationFrame(grow);
      ta.addEventListener('input',()=>{n.body=ta.value;grow();touch()});
      const ac=linkAC(ta,n,s.id,()=>{n.body=ta.value;grow();touch()});curAC=ac;
      ta.addEventListener('keydown',e=>{if(ac.key(e))return;if(e.key==='Tab'){e.preventDefault();const p=ta.selectionStart;ta.setRangeText('  ',p,ta.selectionEnd,'end');n.body=ta.value;touch()}
        else if(e.key==='Enter'&&!e.shiftKey){const p=ta.selectionStart,ls=ta.value.lastIndexOf('\n',p-1)+1,line=ta.value.slice(ls,p),m=line.match(/^(\s*)([-*] \[[ xX]\] |[-*•] |(\d+)[.)] )(.*)$/);
          if(m){e.preventDefault();if(!m[4].trim()){ta.setRangeText('',ls,p,'end')}else{const nx=m[3]?`${+m[3]+1}${m[2].trim().slice(-1)} `:m[2].replace(/\[[xX]\]/,'[ ]');ta.setRangeText('\n'+m[1]+nx,p,ta.selectionEnd,'end')}n.body=ta.value;touch();grow()}}})}
    else{curAC=null;linkCtx=s.id;tw.innerHTML=`<div class="ed-prev md" id="edPrev" title="Klicken zum Bearbeiten">${n.body.trim()?md(n.body):'<span class="muted">Kein Text – klicke hier zum Schreiben.</span>'}</div>`;
      $('#edPrev',dlg).onclick=e=>{if(e.target.closest('a'))return;ui.edTab='write';drawText();$('#edBody',dlg).focus()}}};
  drawText();
  const drawBl=()=>{const bl=backlinks(n),el=$('#blSec',dlg);if(!bl.length){el.hidden=true;return}el.hidden=false;
    el.innerHTML=`<div class="ed-sec-h">Verweise auf diese Notiz <span class="muted sm">${bl.length}</span></div><div class="bl-list">${bl.slice(0,30).map(x=>`<button type="button" class="bl-it" data-bsid="${x.s.id}" data-bnid="${x.n.id}"><span class="bl-t">${esc(noteLabel(x.n))}</span><span class="muted sm">${esc(x.s.name)}</span><span class="bl-l">${esc(x.line.replace(/^[-*#>\s]+/,'').slice(0,140))}</span></button>`).join('')}</div>`;
    $$('.bl-it',el).forEach(b=>b.onclick=()=>openNote(b.dataset.bsid,b.dataset.bnid,{fromLink:true}))};
  drawBl();
  $$('[data-tab]',dlg).forEach(b=>b.onclick=()=>{ui.edTab=b.dataset.tab;drawText()});
  const drawCk=()=>{const dn=n.checklist.filter(c=>c.done).length;$('#ckCnt',dlg).textContent=n.checklist.length?`${dn}/${n.checklist.length}`:'';$('#ckClear',dlg).hidden=!dn;
    $('#ckList',dlg).innerHTML=n.checklist.map(c=>`<div class="ck-edit${c.done?' done':''}" data-cid="${c.id}"><input type="checkbox"${c.done?' checked':''} aria-label="Erledigt"><input type="text" value="${esc(c.text)}" aria-label="Punkt"><button type="button" class="icon-btn sm del" title="Entfernen" aria-label="Entfernen">✕</button></div>`).join('');
    $$('.ck-edit',dlg).forEach(row=>{const c=n.checklist.find(x=>x.id===row.dataset.cid);const[cb,tx]=$$('input',row);
      cb.onchange=()=>{c.done=cb.checked;row.classList.toggle('done',c.done);touch();drawCk()};
      tx.oninput=()=>{c.text=tx.value;touch()};
      tx.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#ckAdd',dlg).focus()}else if(e.key==='Backspace'&&!tx.value){e.preventDefault();n.checklist=n.checklist.filter(x=>x!==c);touch();drawCk();$('#ckAdd',dlg).focus()}};
      $('button',row).onclick=()=>{n.checklist=n.checklist.filter(x=>x!==c);touch();drawCk()}})};
  drawCk();
  $('#ckAdd',dlg).onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const v=e.target.value.trim();if(!v)return;
    v.split(/\n|;\s*/).map(x=>x.trim()).filter(Boolean).forEach(x=>n.checklist.push(ck(x)));e.target.value='';touch();drawCk()};
  $('#ckClear',dlg).onclick=()=>{n.checklist=n.checklist.filter(c=>!c.done);touch();drawCk()};
  $('#edTitle',dlg).addEventListener('input',e=>{n.title=e.target.value;touch();const tb=$('#tplbar',dlg);if(tb&&e.target.value)tb.remove()});
  $('#edTitle',dlg).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ui.edTab='write';drawText();$('#edBody',dlg).focus()}});
  $$('[data-tpl]',dlg).forEach(b=>b.onclick=()=>{const t=DB.settings.templates.find(x=>x.id===b.dataset.tpl);if(!t)return;const col=n.colId;applyTpl(n,t);n.colId=col;touch();n._new=true;openNote(s.id,n.id);const ti=$('#edTitle');if(ti){ti.focus();ti.setSelectionRange(ti.value.length,ti.value.length)}});
  $('#edCol',dlg).onchange=e=>{const wasDone=isDone(s,n);n.colId=e.target.value;n.order=maxOrder(s,n.colId)+1;afterDone(s,n,wasDone);touch();$('#edRep',dlg).value=n.repeat};
  $('#edDue',dlg).onchange=e=>{n.due=e.target.value;$('#edTime',dlg).disabled=!n.due;if(!n.due){n.dueTime='';$('#edTime',dlg).value=''}n.remindedFor='';touch()};
  $('#edTime',dlg).onchange=e=>{n.dueTime=isTime(e.target.value)?e.target.value:'';n.remindedFor='';touch();
    if(n.dueTime&&DB.settings.notify===false&&'Notification' in window&&Notification.permission==='default')toast('Tipp: Desktop-Benachrichtigungen unter Einstellungen aktivieren')};
  $('#edRep',dlg).onchange=e=>{n.repeat=e.target.value;if(n.repeat&&!n.due){n.due=today();$('#edDue',dlg).value=n.due;$('#edTime',dlg).disabled=false}touch()};
  const drawLbl=()=>{const all=[...new Set([...allTags(),...Object.keys(DB.settings.labels),...n.tags])].sort((a,b)=>a.localeCompare(b));
    $('#lblPick',dlg).innerHTML=all.map(t=>`<button type="button" class="nlbl${n.tags.includes(t)?'':' sel-off'}" data-l="${esc(t)}" style="background:${labelColor(t)}" aria-pressed="${n.tags.includes(t)}">${n.tags.includes(t)?'✓ ':''}${esc(t)}</button>`).join('')+'<input id="edLbl" placeholder="+ Neues Label (Enter)" maxlength="40" aria-label="Neues Label">';
    $$('[data-l]',dlg).forEach(b=>b.onclick=()=>{const t=b.dataset.l;n.tags=n.tags.includes(t)?n.tags.filter(x=>x!==t):[...n.tags,t];ensureLabel(t);touch();drawLbl()});
    const li=$('#edLbl',dlg);li.onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const v=li.value.trim().replace(/^#/,'');if(!v)return;
      const ex=all.find(x=>x.toLowerCase()===v.toLowerCase())||v;if(!n.tags.includes(ex))n.tags.push(ex);ensureLabel(ex);touch();drawLbl();$('#edLbl',dlg).focus()}};
  drawLbl();
  $$('[data-p]',dlg).forEach(b=>b.onclick=()=>{n.prio=b.dataset.p;$$('[data-p]',dlg).forEach(x=>x.classList.toggle('on',x===b));touch()});
  const drawTime=()=>{const run=!!n.timerStart,tot=timeTotal(n);
    const b=$('#tmBtn',dlg);b.className='btn sm'+(run?' ok':'');b.innerHTML=run?`■ Stoppen <span data-runclock="${n.id}" class="num">${clock(Date.now()-Date.parse(n.timerStart)).replace(/^00:/,'')}</span>`:'▶ Zeit starten';
    $('#tmTot',dlg).textContent=tot?'Total '+hShort(tot):'';
    $('#tmList',dlg).innerHTML=[...n.time].sort((a,b)=>b.day.localeCompare(a.day)||(b.start||'').localeCompare(a.start||'')).map(t=>`<div class="tm-row" data-tid="${t.id}"><span class="d">${fmtShort(t.day)}</span><span class="m">${hm(t.min)}</span><span class="t" title="${esc(t.text)}">${esc(t.text)||(t.start?new Date(t.start).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})+'–'+new Date(t.end).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}):'')}</span><button type="button" class="icon-btn sm" data-tedit title="Bearbeiten" aria-label="Bearbeiten">✎</button><button type="button" class="icon-btn sm del" data-tdel title="Löschen" aria-label="Löschen">✕</button></div>`).join('');
    $$('.tm-row',dlg).forEach(r=>{const t=n.time.find(x=>x.id===r.dataset.tid);
      $('[data-tdel]',r).onclick=()=>{n.time=n.time.filter(x=>x!==t);touch();drawTime()};
      $('[data-tedit]',r).onclick=async()=>{const v=await ask({title:'Zeiteintrag bearbeiten',fields:[{name:'day',label:'Datum',type:'date',value:t.day,required:true},{name:'min',label:'Dauer (Minuten oder h:mm)',value:hm(t.min),required:true},{name:'text',label:'Beschreibung',value:t.text}],ok:'Speichern'});
        if(!v)return;const m=parseMin(v.min);if(!m){toast('Bitte eine Dauer wie 45 oder 1:30 eingeben');return}t.day=v.day;t.min=m;t.text=v.text.trim();touch();drawTime()}})};
  drawTime();edRefresh=()=>{drawTime();info()};
  $('#tmBtn',dlg).onclick=()=>{toggleTimer(s,n);drawTime()};
  const addTime=()=>{const m=parseMin($('#tmMin',dlg).value);if(!m){toast('Dauer z. B. als 45, 1:30 oder 1,5h eingeben');$('#tmMin',dlg).focus();return}
    n.time.push({id:uid(),day:isDate($('#tmDay',dlg).value)?$('#tmDay',dlg).value:today(),min:m,text:$('#tmText',dlg).value.trim(),start:'',end:''});$('#tmMin',dlg).value='';$('#tmText',dlg).value='';touch();drawTime()};
  $('#tmAdd',dlg).onclick=addTime;$('#tmMin',dlg).onkeydown=$('#tmText',dlg).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addTime()}};
  const drawImg=()=>{$('#imCnt',dlg).textContent=n.images.length?String(n.images.length):'';
    $('#thumbs',dlg).innerHTML=n.images.map(i=>`<div class="thumb" data-iid="${i.id}"><img src="${i.data}" alt="${esc(i.name)}"><button type="button" title="Bild entfernen" aria-label="Bild entfernen">✕</button></div>`).join('');
    $$('.thumb',dlg).forEach(t=>{const im=n.images.find(x=>x.id===t.dataset.iid);$('img',t).onclick=()=>lightbox(im.data);$('button',t).onclick=()=>{n.images=n.images.filter(x=>x!==im);touch();drawImg()}})};
  drawImg();
  $('#imPick',dlg).onclick=()=>{const fi=$('#imgIn');fi.onchange=()=>{addImages([...fi.files],n,()=>{touch();drawImg()});fi.value=''};fi.click()};
  ed.addEventListener('paste',e=>{const fs=[...(e.clipboardData?.files||[])].filter(f=>/^image\//.test(f.type));if(!fs.length)return;e.preventDefault();addImages(fs,n,()=>{touch();drawImg();toast('Bild eingefügt')})});
  ed.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();ed.classList.add('dragover')}});
  ed.addEventListener('dragleave',e=>{if(!ed.contains(e.relatedTarget))ed.classList.remove('dragover')});
  ed.addEventListener('drop',e=>{const fs=[...e.dataTransfer.files];if(!fs.length)return;e.preventDefault();ed.classList.remove('dragover');addImages(fs,n,()=>{touch();drawImg()})});
  $$('[data-color]',dlg).forEach(b=>b.onclick=()=>{n.color=b.dataset.color;$$('[data-color]',dlg).forEach(x=>x.classList.toggle('on',x===b));touch()});
  $('[data-fav]',dlg).onclick=e=>{n.fav=!n.fav;const b=e.currentTarget;b.classList.toggle('on',n.fav);b.innerHTML=n.fav?SVG.starOn:SVG.star;b.title=n.fav?'Aus Favoriten entfernen':'Zu Favoriten';b.setAttribute('aria-pressed',n.fav);touch();toast(n.fav?'Zu Favoriten hinzugefügt':'Aus Favoriten entfernt')};
  const bk=$('[data-back]',dlg);if(bk)bk.onclick=()=>{const p=edStack.pop();openNote(p.sid,p.id,{back:true})};
  $$('[data-day]',dlg).forEach(b=>b.onclick=()=>{const k=+b.dataset.day;openDaily(k?addDays(n.daily,k):today(),{back:true})});
  const dj=$('[data-dayjump]',dlg);if(dj){dj.onchange=()=>{if(isDate(dj.value))openDaily(dj.value,{back:true})};$('[data-daypick]',dlg).onclick=()=>{try{dj.showPicker()}catch(e){dj.focus()}}}
  $('[data-hist]',dlg).onclick=()=>{clearTimeout(saveT);recordHistory(n,before0.v);before0.v=snapOf(n);showHistory(s,n,()=>{openNote(s.id,n.id,{back:true})})};
  $('[data-pin]',dlg).onclick=e=>{n.pinned=!n.pinned;e.currentTarget.classList.toggle('on',n.pinned);e.currentTarget.title=n.pinned?'Lösen':'Anheften';touch()};
  $$('[data-close]',dlg).forEach(b=>b.onclick=()=>dlg.close());
  $('[data-copy]',dlg).onclick=async()=>{const ok=await copyText(noteText(s,n));toast(ok?'Notiz als Text kopiert':'Kopieren nicht möglich')};
  $('[data-print]',dlg).onclick=()=>{flushNow();printNotes(noteLabel(n),[{s,n}],true)};
  $('[data-astpl]',dlg).onclick=async()=>{const r=await ask({title:'Als Vorlage speichern',text:'Titel, Text, Checkliste, Tags und Farbe werden übernommen. Platzhalter wie {datum} kannst du im Text verwenden.',fields:[{name:'name',label:'Name der Vorlage',value:noteLabel(n),required:true,maxlength:40}],ok:'Speichern'});
    if(!r)return;DB.settings.templates.push({id:uid(),name:r.name.trim(),color:n.color,title:n.title,body:n.body,tags:[...n.tags],checklist:n.checklist.map(c=>c.text)});save(true);toast('Vorlage „'+r.name.trim()+'“ gespeichert')};
  $('[data-dup]',dlg).onclick=()=>{const c=newNote(s,{title:n.title?n.title+' (Kopie)':'',body:n.body,color:n.color,tags:[...n.tags],colId:n.colId,checklist:n.checklist.map(x=>ck(x.text,x.done)),due:n.due,dueTime:n.dueTime,images:n.images.map(i=>({...i,id:uid()}))});save();openNote(s.id,c.id);toast('Kopie erstellt')};
  $('[data-arch]',dlg).onclick=()=>{const snap=JSON.stringify(DB),wasDone=isDone(s,n),hadRep=!!n.repeat;n.archived=!n.archived;if(!n.archived)n.order=maxOrder(s,n.colId)+1;n.updated=now();delete n._new;afterDone(s,n,wasDone);dlg.close();save();render();if(!(hadRep&&n.archived))toast(n.archived?'Notiz archiviert':'Notiz wiederhergestellt',{undo:snap})};
  $('[data-del]',dlg).onclick=async()=>{if(noteEmpty(n)){dlg.close();return}
    const snap=JSON.stringify(DB);recordHistory(n,before0.v);before0.v=null;n._gone=true;trashNote(s,n);dlg.close();save();render();toast('In den Papierkorb verschoben',{undo:snap,open:()=>setView('trash'),openLabel:'Papierkorb'})};
  $('[data-move]',dlg).onclick=async()=>{const others=DB.spaces.filter(x=>x!==s);if(!others.length){toast('Es gibt noch keinen anderen Space.');return}
    const r=await ask({title:'In anderen Space verschieben',fields:[{name:'to',label:'Ziel-Space',type:'select',options:others.map(x=>[x.id,x.name])}],ok:'Verschieben'});if(!r)return;
    const t=spaceById(r.to),snap=JSON.stringify(DB);s.notes=s.notes.filter(x=>x!==n);n.colId=firstOpenCol(t).id;n.order=maxOrder(t,n.colId)+1;n.updated=now();delete n._new;t.notes.push(n);n._gone=true;
    dlg.close();save();render();toast('Verschoben nach „'+t.name+'“',{undo:snap})};
  dlg.oncancel=e=>{if(curAC&&curAC.open()){e.preventDefault();curAC.close()}};
  dlg.onclose=()=>{clearTimeout(saveT);edRefresh=null;dlg.onclose=null;curAC=null;$$('.ac-pop').forEach(x=>x.remove());
    let removed=false;
    if(!n._gone&&(noteEmpty(n)||dailyUntouched(n))){const sp_=spaceById(edCur&&edCur.sid)||s;sp_.notes=sp_.notes.filter(x=>x!==n);removed=true;if(!n._new&&n._dailyFresh===undefined)toast('Leere Notiz entfernt')}
    if(!removed){recordHistory(n,before0.v);const c=relinkTitle(n,origTitle);if(c)toast(`${c} Verweis${c===1?'':'e'} auf „${n.title.trim()}“ aktualisiert`)}
    delete n._new;delete n._gone;delete n._dailyFresh;if(!edNav){edStack=[];edCur=null}save(true);render();applyExternal()};
  if(!dlg.open)dlg.showModal();
  if(n._new)$('#edTitle',dlg).focus();else $('.ed-body',dlg).scrollTop=0}
