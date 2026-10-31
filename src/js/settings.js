/* Kanban Notizen · Globale Einstellungen und Import */
'use strict';
/* ============ Globale Einstellungen ============ */
async function backupAll(){if(await download(`kanban-notizen-backup-${today()}.json`,JSON.stringify(payload(),null,1))){DB.settings.lastBackup=now();save(true)}}
function renderSettings(el){const S=DB.settings,tab=ui.gtab;let body='';
  if(tab==='general'){
    body=`${WEB?webStoreHTML():tauriStoreHTML()}
    <div class="panel"><h3>Darstellung</h3><div class="row-btns">${[['system',WEB?'Wie System':'Wie Windows'],['light','Hell'],['dark','Dunkel']].map(([k,n])=>`<button class="stab${S.theme===k?' on':''}" data-theme="${k}">${n}</button>`).join('')}</div></div>
    <div class="panel"><h3>Tagesnotiz</h3><p>Mit der Taste <kbd>D</kbd> oder „Tagesnotiz“ in der Seitenleiste öffnest du die Notiz für heute. Im Editor blätterst du zum Vor- oder Folgetag. Verlinken kannst du einen Tag mit <code>[[2026-10-28]]</code>.</p>
      <div class="fld" style="max-width:420px"><label for="sDailySp">Space für Tagesnotizen</label><select id="sDailySp"><option value="">Automatisch: Space „Tagesnotizen“</option>${DB.spaces.map(x=>`<option value="${x.id}"${S.daily.space===x.id?' selected':''}>${esc(spaceLabel(x))}</option>`).join('')}</select></div>
      <div class="fld"><label for="sDailyTpl">Vorlage für neue Tagesnotizen</label><textarea id="sDailyTpl" rows="6">${esc(S.daily.tpl)}</textarea><small>Platzhalter: {datum}, {wochentag}, {kw}. Unveränderte Tagesnotizen werden beim Schliessen nicht gespeichert.</small></div>
      <div class="row-btns"><button class="btn" id="sDailySave">Speichern</button><button class="btn ghost" id="sDailyReset">Standardvorlage</button></div></div>
    <div class="panel"><h3>Erinnerungen</h3><p>Hat eine Notiz einen Termin mit Uhrzeit, erinnert dich die App zur gewählten Zeit, solange sie läuft.</p>
    <label class="chk"${'Notification' in window?'':' hidden'}><input type="checkbox" id="sNotify"${S.notify?' checked':''}> Zusätzlich als Windows-Benachrichtigung anzeigen</label>${'Notification' in window&&Notification.permission==='denied'?'<small style="color:var(--danger)">Benachrichtigungen sind blockiert. Erlaube sie in den Windows-Einstellungen unter Benachrichtigungen.</small>':''}</div>
    <div class="panel"><h3>Zeiterfassung</h3><div class="fld" style="max-width:320px;margin:0"><label for="sRound">Beim Stoppen aufrunden auf</label><select id="sRound">${[[0,'Nicht runden'],[5,'5 Minuten'],[6,'6 Minuten (0,1 h)'],[10,'10 Minuten'],[15,'15 Minuten'],[30,'30 Minuten']].map(([v,n])=>`<option value="${v}"${S.round===v?' selected':''}>${n}</option>`).join('')}</select></div></div>
    <div class="panel"><h3>Jira-Verknüpfung</h3><p>Vorgangsschlüssel wie <code>SUP-123</code> im Text werden automatisch zu Links.</p><div class="inline-add" style="max-width:560px"><input id="sJira" placeholder="https://firma.atlassian.net/browse/" value="${esc(S.jiraUrl)}" aria-label="Jira-Adresse"><button class="btn" id="sJiraSave">Speichern</button></div><small>Leer lassen, um die Verknüpfung auszuschalten.</small></div>`}
  else if(tab==='labels'){const all=[...new Set([...allTags(),...Object.keys(S.labels)])].sort((a,b)=>a.localeCompare(b));
    const used=t=>DB.spaces.reduce((a,x)=>a+x.notes.filter(n=>n.tags.includes(t)).length,0);
    body=`<div class="panel"><h3>Labels</h3><p>Labels gelten für alle Spaces. Hier legst du ihre Farbe fest, benennst sie um oder entfernst sie. Umbenennen und Löschen wirkt auf alle Notizen.</p>
    ${all.length?all.map((t,k)=>`<div class="lb-row" data-k="${k}">${lblHTML(t)}<input type="text" value="${esc(t)}" maxlength="40" aria-label="Name"><select aria-label="Farbe">${LCOL.map(c=>`<option value="${c.id}"${labelColorId(t)===c.id?' selected':''}>${c.n}</option>`).join('')}</select><span class="muted sm num">${used(t)} Notiz${used(t)===1?'':'en'}</span><span class="spacer"></span><button class="icon-btn sm del" data-del aria-label="Label löschen">✕</button></div>`).join(''):'<p class="muted">Noch keine Labels. Du setzt sie im Editor einer Notiz.</p>'}
    <div class="inline-add" style="margin-top:12px"><input id="lbNew" placeholder="Neues Label" maxlength="40" aria-label="Neues Label"><button class="btn" id="lbAdd">+ Hinzufügen</button></div></div>`;
    setTimeout(()=>{const el2=$('#bw');if(!el2)return;
      $$('.lb-row',el2).forEach(r=>{const t=all[+r.dataset.k];
        $('select',r).onchange=e=>{S.labels[t]=e.target.value;save();setTimeout(render,0)};
        $('input',r).onchange=e=>{const v=e.target.value.trim();if(!v||v===t){e.target.value=t;return}
          DB.spaces.forEach(x=>x.notes.forEach(n=>{if(n.tags.includes(t))n.tags=[...new Set(n.tags.map(y=>y===t?v:y))]}));S.templates.forEach(tp=>tp.tags=tp.tags.map(y=>y===t?v:y));
          if(!S.labels[v])S.labels[v]=S.labels[t]||'';delete S.labels[t];ensureLabel(v);save();setTimeout(render,0);toast(`Label umbenannt in „${v}“`)};
        $('[data-del]',r).onclick=async()=>{const u=used(t);if(u){const q=await ask({title:`Label „${t}“ löschen?`,text:`Das Label wird bei ${u} Notiz${u===1?'':'en'} entfernt. Die Notizen selbst bleiben erhalten.`,ok:'Löschen',danger:true});if(!q)return}
          const snap=JSON.stringify(DB);DB.spaces.forEach(x=>x.notes.forEach(n=>{n.tags=n.tags.filter(y=>y!==t)}));delete S.labels[t];save();render();toast('Label gelöscht',{undo:snap})}});
      const add=()=>{const v=$('#lbNew',el2).value.trim();if(!v)return;ensureLabel(v);save(true);renderContent();toast(`Label „${v}“ angelegt`)};
      $('#lbAdd',el2).onclick=add;$('#lbNew',el2).onkeydown=e=>{if(e.key==='Enter')add()}},0)}
  else if(tab==='tpl'){body=`<div class="panel"><h3>Vorlagen</h3><p>Vorlagen erscheinen beim Erstellen einer neuen Notiz. Platzhalter: <code>{datum}</code>, <code>{wochentag}</code>, <code>{kw}</code>.</p>
    ${S.templates.length?S.templates.map((t,k)=>`<div class="tpl-row" data-tid="${t.id}"><span class="tpl-sw" style="background:var(--n-${t.color})"></span><span class="sp-n"><b>${esc(t.name)}</b> <span class="muted sm">${esc(fillVars(t.title))}${t.checklist.length?' · '+t.checklist.length+' Checklistenpunkte':''}</span></span><button class="icon-btn sm" data-up${k?'':' disabled'} aria-label="Nach oben">↑</button><button class="icon-btn sm" data-down${k<S.templates.length-1?'':' disabled'} aria-label="Nach unten">↓</button><button class="btn sm" data-edit>Bearbeiten</button><button class="icon-btn sm del" data-del aria-label="Löschen">✕</button></div>`).join(''):'<p class="muted">Keine Vorlagen vorhanden.</p>'}
    <div class="row-btns" style="margin-top:12px"><button class="btn primary" id="tplNew">+ Vorlage erstellen</button><button class="btn" id="tplReset">Standardvorlagen wiederherstellen</button></div></div>`}
  else{body=`<div class="panel"><h3>Backup</h3><p>Die App sichert deine Datei jeden Tag automatisch im Ordner <b>Backups</b> neben der Datendatei. Zusätzlich kannst du hier jederzeit ein vollständiges Backup mit allen Spaces, Notizen, Bildern, Zeiten und Vorlagen herunterladen. ${DB.settings.lastBackup?'Letztes Backup: '+fmtTime(DB.settings.lastBackup)+'.':'Noch kein Backup erstellt.'}</p>
    <div class="row-btns"><button class="btn primary" id="bAll">Backup speichern …</button><button class="btn" id="bRestore">Backup wiederherstellen …</button></div>
    <small>Wiederherstellen ersetzt alle aktuellen Notizen – du kannst es direkt danach rückgängig machen.</small></div>
    <div class="panel"><h3>Import</h3><p>Fügt Spaces aus einer Datei <b>zusätzlich</b> hinzu: Backups dieses Tools, Space-Exporte sowie Backups aus den früheren Versionen (Ticket-Board und Online-Notizen).</p><button class="btn" id="bImport">Datei importieren …</button></div>
    <div class="panel danger-zone"><h3>Alles zurücksetzen</h3><p class="muted">Löscht alle Spaces, Notizen, Zeiten und den Papierkorb und startet mit den Beispiel-Notizen neu. Die täglichen Sicherungen im Ordner Backups bleiben erhalten.</p><button class="btn danger-solid" id="bReset">Alles zurücksetzen …</button></div>`}
  el.innerHTML=`<div class="scroll" id="bw"><div class="page"><nav class="subtabs">${[['general','Allgemein'],['labels','Labels'],['tpl','Vorlagen'],['data','Backup & Import']].map(([k,n])=>`<button class="stab${tab===k?' on':''}" data-gtab="${k}">${n}</button>`).join('')}</nav>${body}</div></div>`;
  $$('[data-gtab]',el).forEach(b=>b.onclick=()=>{ui.gtab=b.dataset.gtab;renderContent()});
  const on=(id,f)=>{const x=$('#'+id,el);if(x)x.onclick=f};
  if(tab==='general'){on('uCheck',()=>checkUpdate(true));on('uInstall',installUpdate);on('tReveal',()=>tInvoke('reveal_data').catch(e=>toast('Ordner konnte nicht geöffnet werden: '+e)));on('tNew',tauriNewFile);on('tOpen',tauriOpenFile);on('tReset',tauriResetPath);
    $$('[data-theme]',el).forEach(b=>b.onclick=()=>{S.theme=b.dataset.theme;applyTheme();save(true);renderContent()});
    $('#sNotify',el).onchange=async e=>{if(e.target.checked&&'Notification' in window){let p=Notification.permission;if(p==='default')p=await Notification.requestPermission();if(p!=='granted'){e.target.checked=false;toast('Benachrichtigungen wurden nicht erlaubt');return}}S.notify=e.target.checked;save(true);toast(S.notify?'Benachrichtigungen aktiviert':'Benachrichtigungen aus')};
    $('#sDailySp',el).onchange=e=>{S.daily.space=e.target.value;save(true);toast('Gespeichert')};
    on('sDailySave',()=>{S.daily.tpl=$('#sDailyTpl',el).value;save(true);toast('Vorlage für Tagesnotizen gespeichert')});
    on('sDailyReset',()=>{$('#sDailyTpl',el).value=DAILY_TPL;S.daily.tpl=DAILY_TPL;save(true);toast('Standardvorlage wiederhergestellt')});
    $('#sRound',el).onchange=e=>{S.round=+e.target.value;save(true);toast('Gespeichert')};
    on('sJiraSave',()=>{let v=$('#sJira',el).value.trim();if(v&&!/^https?:\/\//i.test(v)){toast('Bitte eine Adresse mit https:// eingeben');return}S.jiraUrl=v;save();render();toast(v?'Jira-Verknüpfung gespeichert':'Jira-Verknüpfung ausgeschaltet')})}
  else if(tab==='tpl'){$$('.tpl-row',el).forEach(r=>{const t=S.templates.find(x=>x.id===r.dataset.tid);
      $('[data-edit]',r).onclick=()=>editTpl(t);$('[data-up]',r).onclick=()=>{moveArr(S.templates,t,-1);save(true);renderContent()};$('[data-down]',r).onclick=()=>{moveArr(S.templates,t,1);save(true);renderContent()};
      $('[data-del]',r).onclick=()=>{const snap=JSON.stringify(DB);S.templates=S.templates.filter(x=>x!==t);save(true);renderContent();toast('Vorlage gelöscht',{undo:snap})}});
    on('tplNew',()=>editTpl(null));
    on('tplReset',()=>{const have=new Set(S.templates.map(t=>t.name));const add=DEFAULT_TPL().filter(t=>!have.has(t.name));S.templates.push(...add);save(true);renderContent();toast(add.length?add.length+' Vorlagen ergänzt':'Alle Standardvorlagen sind schon vorhanden')})}
  else{on('bAll',backupAll);on('bRestore',()=>{fileMode='all';$('#fileIn').click()});on('bImport',()=>{fileMode='add';$('#fileIn').click()});
    on('bReset',async()=>{const r=await ask({title:'Alles zurücksetzen?',text:'Tippe <b>LÖSCHEN</b> ein, um alle Notizen zu entfernen.',fields:[{name:'k',label:'Bestätigung',required:true}],ok:'Alles löschen',danger:true,init:f=>{const k=f.elements.k;const c=()=>k.setCustomValidity(k.value.trim().toUpperCase()==='LÖSCHEN'?'':'Bitte LÖSCHEN eingeben');k.addEventListener('input',c);c()}});
      if(!r)return;const snap=JSON.stringify(DB);DB=normDB({ui:{view:'board'},settings:DB.settings});ui.filters=blankF();save();render();toast('Alles zurückgesetzt',{undo:snap})})}}
async function editTpl(t){const isNew=!t;t=t||{id:uid(),name:'',color:'default',title:'',body:'',tags:[],checklist:[]};
  const r=await ask({title:isNew?'Vorlage erstellen':'Vorlage bearbeiten',wide:true,fields:[{name:'name',label:'Name',value:t.name,required:true,maxlength:40},{name:'title',label:'Titel der Notiz',value:t.title,placeholder:'z. B. Kundentermin {datum}'},
    {name:'body',label:'Text',type:'textarea',rows:8,value:t.body},{name:'ck',label:'Checkliste (ein Punkt pro Zeile)',type:'textarea',rows:4,value:t.checklist.join('\n')},{name:'tags',label:'Labels (mit Komma trennen)',value:t.tags.join(', ')},{name:'color',label:'Farbe',type:'select',options:NCOL.map(c=>[c.id,c.n]),value:t.color}],ok:'Speichern'});
  if(!r)return;Object.assign(t,{name:r.name.trim(),title:r.title,body:r.body,checklist:r.ck.split('\n').map(x=>x.trim()).filter(Boolean),tags:r.tags.split(',').map(x=>x.trim()).filter(Boolean),color:r.color});t.tags.forEach(ensureLabel);
  if(isNew)DB.settings.templates.push(t);save(true);renderContent();toast('Vorlage gespeichert')}
/* ============ Import ============ */
let fileMode='all';
$('#fileIn').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;
  let d;try{d=JSON.parse(await file.text())}catch(_){toast('Die Datei ist kein gültiges JSON.');return}
  const snap=JSON.stringify(DB);
  try{
    let spaces;
    if(d&&d.kind==='space'&&d.space)spaces=[d.space];
    else if(d&&Array.isArray(d.columns)&&Array.isArray(d.issues))spaces=[fromV1(d)].filter(Boolean);
    else if(d&&Array.isArray(d.spaces))spaces=d.spaces.map(s=>arr(s.columns).length||!arr(s.statuses).length?normSpace(s):fromV2(Object.assign({},s,{desc:''}))).filter(Boolean);
    else throw new Error('Unbekanntes Dateiformat');
    if(!spaces.length)throw new Error('Die Datei enthält keine Notizen');
    const conv=spaces.map(normSpace);
    if(fileMode==='all'){const r=await ask({title:'Backup wiederherstellen?',text:`Die Datei enthält ${conv.length} Space${conv.length===1?'':'s'} mit ${conv.reduce((a,s)=>a+s.notes.length,0)} Notizen. Alle aktuellen Notizen werden ersetzt.`,ok:'Wiederherstellen',danger:true});if(!r)return;
      DB=normDB({folders:d.folders,spaces:conv.map((x,k)=>Object.assign(x,{folder:(spaces[k]||{}).folder||''})),settings:d.settings||DB.settings,trash:d.trash,history:d.history,ui:{view:'board'}});applyTheme();toast('Backup wiederhergestellt',{undo:snap})}
    else{conv.forEach(s=>{s.id=uid();s.folder='';s.notes.forEach(n=>n.id=uid());DB.spaces.push(s)});DB.active=conv[conv.length-1].id;DB.ui.view='board';toast(`${conv.length} Space${conv.length===1?'':'s'} importiert`,{undo:snap})}
    ui.filters=blankF();save();render()}
  catch(err){DB=normDB(JSON.parse(snap));toast('Import fehlgeschlagen: '+err.message)}};
