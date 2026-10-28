/* Kanban Notizen · Spalten und Spaces */
'use strict';
/* ============ Spalten & Spaces ============ */
async function renameCol(s,c){if(!c)return;const r=await ask({title:'Spalte umbenennen',fields:[{name:'n',label:'Name',value:c.name,required:true,maxlength:40}],ok:'Speichern'});if(!r)return;c.name=r.n.trim()||c.name;save();render()}
async function addCol(){const s=sp();const r=await ask({title:'Spalte hinzufügen',fields:[{name:'n',label:'Name',required:true,maxlength:40,placeholder:'z. B. Warten auf Kunde'},{name:'c',label:'Farbe',type:'select',options:NCOL.map(c=>[c.id,c.n]),value:'grey'},{name:'d',label:'Notizen in dieser Spalte gelten als …',type:'select',options:[['0','offen'],['1','erledigt (zählt nicht als fällig, startet Wiederholungen)']]}],ok:'Hinzufügen'});
  if(!r)return;const nc={id:uid(),name:r.n.trim(),color:r.c,done:r.d==='1'};const di=s.columns.findIndex(c=>c.done);if(!nc.done&&di>=0)s.columns.splice(di,0,nc);else s.columns.push(nc);save();render()}
async function deleteCol(s,c){
  if(s.columns.length<2){toast('Ein Space braucht mindestens eine Spalte.');return}
  const aff=s.notes.filter(n=>n.colId===c.id),others=s.columns.filter(x=>x!==c);
  const r=await ask({title:`Spalte „${c.name}“ löschen?`,text:aff.length?`<b>${aff.length}</b> Notizen liegen in dieser Spalte. Wohin sollen sie?`:'Die Spalte ist leer.',fields:aff.length?[{name:'to',label:'Verschieben nach',type:'select',options:others.map(x=>[x.id,x.name])}]:[],ok:'Löschen',danger:true});
  if(!r)return;const snap=JSON.stringify(DB),to=r.to||others[0].id;let o=maxOrder(s,to)+1;aff.forEach(n=>{n.colId=to;n.order=o++});s.columns=others;save();render();toast(`Spalte „${c.name}“ gelöscht`,{undo:snap})}
async function createSpace(folder){
  if(typeof folder!=='string')folder='';
  const r=await ask({title:'Space erstellen',text:'Ein Space ist ein eigenes Board mit eigenen Spalten und Notizen – z. B. pro Kunde, Projekt oder für die Schule.',
    fields:[{name:'name',label:'Name',required:true,maxlength:60,placeholder:'z. B. Kunde Muster AG'},{name:'tpl',label:'Vorlage',type:'select',options:Object.entries(TEMPLATES).map(([k,t])=>[k,`${t.n} – ${t.d}`])},{name:'color',label:'Farbe',type:'select',options:SPCOL.map((c,k)=>[c,SPCOLN[k]]),value:SPCOL[DB.spaces.length%SPCOL.length]},{name:'folder',label:'Kategorie',type:'select',options:folderOptions(),value:folder}],ok:'Erstellen'});
  if(!r)return;const s=makeSpace(r.name.trim(),r.color,r.tpl);s.folder=r.folder;expandTo(s.folder);DB.spaces.push(s);DB.ui.view='board';goSpace(s.id);save();toast(`Space „${s.name}“ erstellt`)}
async function deleteSpace(s){
  if(DB.spaces.length<2){toast('Der letzte Space kann nicht gelöscht werden.');return}
  const r=await ask({title:`Space „${s.name}“ löschen?`,text:`Der Space wird gelöscht. Seine <b>${s.notes.length}</b> Notizen (auch archivierte) landen im Papierkorb und lassen sich dort ${TRASH_DAYS} Tage lang wiederherstellen. Tippe zur Bestätigung den Namen ein.`,fields:[{name:'k',label:'Name des Space',required:true}],ok:'Endgültig löschen',danger:true,
    init:f=>{const k=f.elements.k;const c=()=>k.setCustomValidity(k.value.trim()===s.name.trim()?'':'Name stimmt nicht überein');k.addEventListener('input',c);c()}});
  if(!r)return;const snap=JSON.stringify(DB);[...s.notes].filter(n=>!noteEmpty(n)).forEach(n=>trashNote(s,n));if(DB.settings.daily.space===s.id)DB.settings.daily.space='';DB.spaces=DB.spaces.filter(x=>x!==s);DB.active=DB.spaces[0].id;DB.ui.view='board';save();render();toast(`Space „${s.name}“ gelöscht`,{undo:snap})}
function renderSpaceCfg(el){const s=sp(),tab=ui.stab;let body='';
  if(tab==='details')body=`<div class="panel"><h3>Space</h3><form id="sf" class="form">
    <div class="fld"><label for="sfName">Name</label><input id="sfName" name="name" required maxlength="60" value="${esc(s.name)}"></div>
    <div class="fld"><label>Farbe</label><div class="swatches">${SPCOL.map((c,k)=>`<button type="button" class="sw${c===s.color?' on':''}" style="background:${c}" data-c="${c}" title="${SPCOLN[k]}" aria-label="${SPCOLN[k]}"></button>`).join('')}</div></div>
    <div class="fld"><label for="sfFolder">Kategorie</label><select id="sfFolder" name="folder">${folderOptions().map(([v,l])=>`<option value="${v}"${v===s.folder?' selected':''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="fld"><label for="sfDesc">Beschreibung</label><textarea id="sfDesc" name="desc" rows="3">${esc(s.desc)}</textarea></div>
    <button class="btn primary">Speichern</button></form></div>
    <div class="panel"><h3>Exportieren</h3><p class="muted">Alle Notizen dieses Space als Dokument – zum Ablegen, Weitergeben oder als PDF.</p><div class="row-btns"><button class="btn" id="prSp">Drucken / PDF</button><button class="btn" id="mdSp">Markdown (.md)</button><button class="btn" id="jsSp">JSON</button></div></div>
    <div class="panel danger-zone"><h3>Space löschen</h3><p class="muted">Löscht den Space. Die ${s.notes.length} Notizen kommen in den Papierkorb.</p><button class="btn danger-solid" id="delSp">Space löschen …</button></div>`;
  else body=`<div class="panel"><h3>Spalten</h3><p class="muted">Jede Spalte ist eine Liste auf dem Board. Notizen in einer <b>Erledigt-Spalte</b> erscheinen nicht mehr bei „Heute &amp; Termine“, und Wiederholungen werden dort automatisch neu angelegt.</p>
    <div class="tbl-wrap"><table class="cfg"><thead><tr><th>Reihenfolge</th><th>Name</th><th>Farbe</th><th>Erledigt-Spalte</th><th>Notizen</th><th></th></tr></thead><tbody>${s.columns.map((c,k)=>`<tr data-cid="${c.id}"><td class="ord"><button class="icon-btn sm" data-up${k?'':' disabled'} aria-label="Nach links">↑</button><button class="icon-btn sm" data-down${k<s.columns.length-1?'':' disabled'} aria-label="Nach rechts">↓</button></td><td><input type="text" id="cn_${c.id}" value="${esc(c.name)}" maxlength="40" aria-label="Name"></td><td><select id="cc_${c.id}" aria-label="Farbe">${NCOL.map(x=>`<option value="${x.id}"${x.id===c.color?' selected':''}>${x.n}</option>`).join('')}</select></td><td><input type="checkbox" id="cd_${c.id}"${c.done?' checked':''} aria-label="Erledigt-Spalte"></td><td class="muted num">${s.notes.filter(n=>n.colId===c.id&&!n.archived).length}</td><td><button class="icon-btn sm del" data-del aria-label="Spalte löschen">✕</button></td></tr>`).join('')}</tbody></table></div>
    <button class="btn" data-act="addCol">+ Spalte hinzufügen</button></div>`;
  el.innerHTML=`<div class="scroll" id="bw"><div class="page"><nav class="subtabs">${[['details','Allgemein'],['cols','Spalten']].map(([k,n])=>`<button class="stab${tab===k?' on':''}" data-stab="${k}">${n}</button>`).join('')}</nav>${body}</div></div>`;
  $$('[data-stab]',el).forEach(b=>b.onclick=()=>{ui.stab=b.dataset.stab;renderContent()});
  if(tab==='details'){const f=$('#sf',el);let color=s.color;
    $$('.sw',f).forEach(b=>b.onclick=()=>{color=b.dataset.c;$$('.sw',f).forEach(x=>x.classList.toggle('on',x===b))});
    f.onsubmit=e=>{e.preventDefault();if(!f.checkValidity()){f.reportValidity();return}s.name=f.elements.name.value.trim()||s.name;s.desc=f.elements.desc.value.trim();s.color=color;s.folder=f.elements.folder.value;expandTo(s.folder);save();render();toast('Gespeichert')};
    $('#prSp',el).onclick=()=>printSpace(s);$('#mdSp',el).onclick=()=>exportMd(s);
    $('#jsSp',el).onclick=()=>download(`space-${safeName(s.name)}-${today()}.json`,JSON.stringify({app:'kanban-notizen',v:4,kind:'space',exported:now(),space:s},null,1));
    $('#delSp',el).onclick=()=>deleteSpace(s)}
  else $$('tr[data-cid]',el).forEach(tr=>{const c=s.columns.find(x=>x.id===tr.dataset.cid);
    $('input[type=text]',tr).onchange=e=>{const v=e.target.value.trim();if(!v){e.target.value=c.name;return}c.name=v;save();render()};
    $('select',tr).onchange=e=>{c.color=e.target.value;save();render()};
    $('input[type=checkbox]',tr).onchange=e=>{c.done=e.target.checked;save();render()};
    $('[data-up]',tr).onclick=()=>{moveArr(s.columns,c,-1);save();render()};
    $('[data-down]',tr).onclick=()=>{moveArr(s.columns,c,1);save();render()};
    $('[data-del]',tr).onclick=()=>deleteCol(s,c)})}
