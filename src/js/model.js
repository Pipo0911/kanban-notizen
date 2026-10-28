/* Kanban Notizen · Datenmodell, Normalisierung, Übernahme alter Versionen */
'use strict';
/* ============ Modell ============ */
const sp=()=>DB.spaces.find(s=>s.id===DB.active)||DB.spaces[0];
const spaceById=id=>DB.spaces.find(s=>s.id===id);
const folderById=id=>DB.folders.find(f=>f.id===id);
function folderChain(fid){const out=[];let f=folderById(fid),g=0;while(f&&g++<50){out.unshift(f);f=folderById(f.parent)}return out}
const spacePath=s=>folderChain(s.folder).map(f=>f.name);
const spaceLabel=s=>[...spacePath(s),s.name].join(' › ');
function isFolderInside(fid,ancestor){let f=folderById(fid),g=0;while(f&&g++<50){if(f.parent===ancestor)return true;f=folderById(f.parent)}return false}
function folderSpaces(fid){return DB.spaces.filter(s=>s.folder===fid||isFolderInside(s.folder,fid))}
function folderOptions(exclude){const out=[['','Oberste Ebene (keine Kategorie)']];
  const walk=(parent,depth)=>DB.folders.filter(f=>f.parent===parent&&f.id!==exclude).forEach(f=>{out.push([f.id,'\u00a0\u00a0\u00a0'.repeat(depth)+'▸ '+f.name]);walk(f.id,depth+1)});
  walk('',0);return out}
function expandTo(fid){folderChain(fid).forEach(f=>f.collapsed=false)}
const byId=(s,id)=>s.notes.find(n=>n.id===id);
const colOf=(s,n)=>s.columns.find(c=>c.id===n.colId)||s.columns[0];
const isDoneCol=(s,cid)=>!!(s.columns.find(c=>c.id===cid)||{}).done;
const isDone=(s,n)=>n.archived||isDoneCol(s,n.colId);
const live=s=>s.notes.filter(n=>!n.archived);
const tagsOf=s=>[...new Set(live(s).flatMap(n=>n.tags))].sort((a,b)=>a.localeCompare(b));
const allTags=()=>[...new Set(DB.spaces.flatMap(s=>live(s).flatMap(n=>n.tags)))].sort((a,b)=>a.localeCompare(b));
const maxOrder=(s,c)=>s.notes.filter(n=>n.colId===c).reduce((m,n)=>Math.max(m,n.order),-1);
const noteEmpty=n=>!n.title.trim()&&!n.body.trim()&&!n.checklist.length&&!n.images.length&&!n.time.length&&!n.timerStart;
const dispSort=(a,b)=>(b.pinned-a.pinned)||(a.order-b.order)||(a.created<b.created?-1:1);
function colSort(s){const m=s.sort||'manual';return(a,b)=>(b.pinned-a.pinned)||(m==='prio'?PRANK(a.prio)-PRANK(b.prio):m==='due'?(a.due||'9999').localeCompare(b.due||'9999')||(a.dueTime||'99').localeCompare(b.dueTime||'99'):m==='updated'?b.updated.localeCompare(a.updated):0)||dispSort(a,b)}
const noteLabel=n=>n.title.trim()||n.body.trim().split('\n')[0].replace(/^[#>*\-\s]+/,'').slice(0,70)||'Ohne Titel';
const timeTotal=n=>n.time.reduce((a,t)=>a+t.min,0);
const firstOpenCol=s=>s.columns.find(c=>!c.done)||s.columns[0];
function allNotes(){const out=[];DB.spaces.forEach(s=>s.notes.forEach(n=>out.push({s,n})));return out}
function runningTimer(){for(const{s,n}of allNotes())if(n.timerStart)return{s,n};return null}
function dueState(s,n){if(!n.due||isDone(s,n))return'';const t=today();if(n.due<t)return'late';if(n.due===t){if(n.dueTime&&new Date()>=new Date(n.due+'T'+n.dueTime))return'late';return'soon'}if(n.due===addDays(t,1))return'soon';return''}
function fillVars(t,d){d=d||today();return String(t||'').replace(/\{datum\}/g,fmtDate(d)).replace(/\{wochentag\}/g,['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][dow(d)]).replace(/\{kw\}/g,String(isoWeek(d)))}
function isoWeek(ds){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+3-(d.getDay()+6)%7);const w1=new Date(d.getFullYear(),0,4);return 1+Math.round(((d-w1)/864e5-3+(w1.getDay()+6)%7)/7)}

function makeSpace(name,color,tpl,desc=''){const t=TEMPLATES[tpl]||TEMPLATES.notizen;
  return{id:uid(),name,color,desc,created:now(),columns:t.cols.map(([n,c,done])=>({id:uid(),name:n,color:c,done:!!done})),notes:[]}}
function blankNote(){return{id:uid(),title:'',body:'',color:'default',prio:'',tags:[],colId:'',pinned:false,fav:false,daily:'',checklist:[],due:'',dueTime:'',repeat:'',remindedFor:'',time:[],timerStart:'',images:[],archived:false,created:now(),updated:now()}}
function newNote(s,d={}){
  const n=Object.assign(blankNote(),d);
  if(!s.columns.some(c=>c.id===n.colId))n.colId=firstOpenCol(s).id;
  n.order=maxOrder(s,n.colId)+1;s.notes.push(n);return n}
const ck=(text,done=false)=>({id:uid(),text,done});

function seedSpaces(){
  const s=makeSpace('Arbeit','#2f5bd3','arbeit','Beispiel-Space – lösche die Beispiel-Notizen einfach, wenn du loslegst.');
  const [c0,c1,c2,c3]=s.columns.map(c=>c.id);
  newNote(s,{colId:c0,pinned:true,color:'yellow',title:'So funktioniert das Board',tags:['beispiel'],
    body:'Jede Karte ist eine **Notiz** – klick drauf zum Bearbeiten, gespeichert wird automatisch.\n\n- `N` neue Notiz · `Strg`+`K` alles durchsuchen · `?` alle Tastenkürzel\n- Karten **ziehen**, um sie zu verschieben\n- **Vorlagen** für Telefonnotiz, Störung, Meeting beim Erstellen\n- **Zeit erfassen** mit ▶ auf der Karte\n- Screenshots mit `Strg`+`V` direkt in die Notiz einfügen\n\nMit `[[` verlinkst du andere Notizen, z. B. [[Telefonat Muster AG]]. Taste `D` öffnet die **Tagesnotiz** von heute.'});
  newNote(s,{colId:c0,prio:'medium',color:'yellow',title:'Telefonat Muster AG',tags:['beispiel','telefon'],due:addDays(today(),1),dueTime:'10:00',
    body:'**Kontakt:** Anna Muster\n**Anliegen:** Neuer Mitarbeiter ab 1. des Monats\n\n## Nächster Schritt\n- Konto und Laptop vorbereiten'});
  newNote(s,{colId:c1,prio:'high',color:'orange',title:'Störung: Drucker 2. OG',tags:['beispiel','störung'],checklist:[ck('Ticket erfasst',true),ck('Kunde informiert',true),ck('Ursache gefunden'),ck('Gelöst und dokumentiert')],
    body:'**Betroffen:** Druckerwarteschlange\n**Seit:** heute Morgen\n\n## Massnahmen\n- Spooler neu gestartet',time:[{id:uid(),day:today(),min:25,text:'Analyse vor Ort'}]});
  newNote(s,{colId:c1,color:'green',title:'Wochenrapport abgeben',tags:['beispiel'],repeat:'weekly',due:(()=>{let d=today();while(dow(d)!==5)d=addDays(d,1);return d})(),
    checklist:[ck('Zeiten kontrollieren'),ck('Rapport einreichen')]});
  newNote(s,{colId:c2,prio:'low',color:'grey',title:'Rückmeldung Lieferant zu Offerte',tags:['beispiel'],body:'Nachfragen, falls bis Ende Woche nichts kommt.'});
  newNote(s,{colId:c3,color:'blue',title:'Board eingerichtet',tags:['beispiel'],body:'Alles läuft offline, gespeichert wird in eine Datei auf deinem PC.'});
  return[s]}
/* ============ Normalisieren & Übernahme alter Versionen ============ */
function normNote(n,s,k){
  const cols=new Set(s.columns.map(c=>c.id));
  return{id:okId(n.id)?String(n.id):uid(),title:String(n.title||''),body:String(n.body||''),color:NC[n.color]?n.color:'default',
    tags:[...new Set(arr(n.tags).map(t=>String(t).trim()).filter(Boolean))],colId:cols.has(n.colId)?n.colId:s.columns[0].id,
    pinned:!!n.pinned,fav:!!n.fav,daily:isDate(n.daily)?n.daily:'',checklist:arr(n.checklist).filter(c=>c&&typeof c.text==='string').map(c=>({id:okId(c.id)?String(c.id):uid(),text:c.text,done:!!c.done})),
    due:isDate(n.due)?n.due:'',dueTime:isDate(n.due)&&isTime(n.dueTime)?n.dueTime:'',repeat:REPEAT[n.repeat]!==undefined?n.repeat:'',remindedFor:String(n.remindedFor||''),
    time:arr(n.time).filter(t=>t&&isDate(t.day)&&+t.min>0).map(t=>({id:okId(t.id)?String(t.id):uid(),day:t.day,min:Math.round(+t.min),text:String(t.text||''),start:t.start||'',end:t.end||''})),
    timerStart:n.timerStart&&!isNaN(Date.parse(n.timerStart))?n.timerStart:'',
    images:arr(n.images).filter(i=>i&&/^data:image\//.test(i.data||'')).map(i=>({id:okId(i.id)?String(i.id):uid(),data:i.data,name:String(i.name||'Bild')})),
    prio:PRIO[n.prio]?n.prio:'',archived:!!n.archived,order:isFinite(+n.order)?+n.order:k,created:n.created||now(),updated:n.updated||n.created||now()}}
function normSpace(s){
  const cols=arr(s.columns).filter(Boolean),hasFlag=cols.some(c=>'done' in c);
  const o={sort:SORTS[s.sort]?s.sort:'manual',id:okId(s.id)?String(s.id):uid(),folder:okId(s.folder)?String(s.folder):'',name:String(s.name||'Space'),color:/^#[0-9a-f]{6}$/i.test(s.color)?s.color:SPCOL[0],desc:String(s.desc||''),created:s.created||now(),
    columns:cols.map(c=>({id:okId(c.id)?String(c.id):uid(),name:String(c.name||'Spalte'),color:NC[c.color]?c.color:'grey',done:hasFlag?!!c.done:/erledigt|fertig|done|kann ich|abgeschlossen|gelöst/i.test(c.name||'')}))};
  if(!o.columns.length)o.columns=[{id:uid(),name:'Notizen',color:'yellow',done:false}];
  o.notes=arr(s.notes).filter(n=>n&&typeof n==='object').map((n,k)=>normNote(n,o,k));
  const seen=new Set();o.notes=o.notes.filter(n=>!seen.has(n.id)&&seen.add(n.id));
  return o}
function fromV2(s){
  const iss=arr(s.issues);
  if(/^Beispiel-Space/.test(s.desc||'')&&iss.every(i=>arr(i.history).length<=1&&!arr(i.comments).length))return null;
  const o={id:s.id,name:s.name,color:s.color,desc:s.desc,created:s.created,columns:arr(s.statuses).map(x=>({id:x.id,name:x.name,color:{todo:'grey',progress:'blue',done:'green'}[x.cat]||'grey',done:x.cat==='done'}))};
  o.notes=iss.map(i=>{let body=String(i.desc||'');const cm=arr(i.comments);
    if(cm.length)body+=(body?'\n\n':'')+'## Kommentare\n'+cm.map(c=>'- '+String(c.text).replace(/\n/g,' ')).join('\n');
    return{id:i.id,title:i.title,body,tags:i.labels,colId:i.statusId,due:i.due,order:i.order,created:i.created,updated:i.updated,prio:PRIO[i.prio]&&i.prio!=='medium'?i.prio:'',color:'default'}});
  return normSpace(o)}
function fromV1(d){return fromV2({id:uid(),name:d.project?.name||'Altes Board',statuses:arr(d.columns).map((c,k,a)=>({id:c.id,name:c.name,cat:k===a.length-1&&a.length>1?'done':'todo'})),
  issues:arr(d.issues).map(i=>({id:i.id,title:i.title,desc:i.desc,labels:i.labels,statusId:i.col,due:i.due,order:i.order,created:i.created,updated:i.updated,history:[1,2],comments:i.comments,prio:i.prio}))})}
function normSettings(x={}){return{theme:['system','light','dark'].includes(x.theme)?x.theme:'system',jiraUrl:typeof x.jiraUrl==='string'?x.jiraUrl.trim():'',
  templates:Array.isArray(x.templates)?x.templates.filter(t=>t&&t.name).map(t=>({id:okId(t.id)?t.id:uid(),name:String(t.name),color:NC[t.color]?t.color:'default',title:String(t.title||''),body:String(t.body||''),tags:arr(t.tags).map(String),checklist:arr(t.checklist).map(String).filter(Boolean)})):DEFAULT_TPL(),
  labels:(()=>{const o={};if(x.labels&&typeof x.labels==='object')for(const[k,v]of Object.entries(x.labels))if(LC[v]&&k.trim())o[k]=v;return o})(),notify:!!x.notify,lastBackup:x.lastBackup||'',
  daily:{space:okId(x.daily&&x.daily.space)?String(x.daily.space):'',tpl:x.daily&&typeof x.daily.tpl==='string'?x.daily.tpl:DAILY_TPL},round:[0,5,6,10,15,30].includes(+x.round)?+x.round:0}}
function normDB(d){
  d=d||{};
  let spaces=arr(d.spaces).filter(Boolean).map(s=>arr(s.columns).length||!arr(s.statuses).length?normSpace(s):fromV2(s)).filter(Boolean);
  if(!spaces.length)spaces=seedSpaces();
  const ui0=Object.assign({view:'board'},d.ui||{});if(![...SPACE_VIEWS,...GLOBAL_VIEWS].includes(ui0.view))ui0.view='board';
  const fl=arr(d.folders).filter(f=>f&&f.name).map(f=>({id:okId(f.id)?String(f.id):uid(),name:String(f.name).slice(0,60),parent:okId(f.parent)?String(f.parent):'',collapsed:!!f.collapsed}));
  const fids=new Set(fl.map(f=>f.id));fl.forEach(f=>{if(!fids.has(f.parent)||f.parent===f.id)f.parent=''});
  fl.forEach(f=>{let p=f.parent;const seen=new Set([f.id]);let g=0;while(p&&g++<100){if(seen.has(p)){f.parent='';break}seen.add(p);p=(fl.find(x=>x.id===p)||{}).parent}});
  spaces.forEach(s=>{if(!fids.has(s.folder))s.folder=''});
  const out={v:5,folders:fl,spaces,settings:normSettings(d.settings),trash:normTrash(d.trash),history:normHistory(d.history),active:d.active,ui:ui0};
  if(!spaces.some(s=>s.id===out.settings.daily.space))out.settings.daily.space='';
  if(!spaces.some(s=>s.id===out.active))out.active=spaces[0].id;
  return out}
/* Papierkorb: gelöschte Notizen mit Herkunft, werden nach 30 Tagen endgültig entfernt */
const TRASH_DAYS=30,HISTORY_MAX=20;
function normTrash(t){return arr(t).filter(e=>e&&e.note&&typeof e.note==='object').map(e=>{const n=normNote(e.note,{columns:[{id:e.note.colId||'x'}]},0);
    return{id:okId(e.id)?String(e.id):uid(),note:n,sid:okId(e.sid)?String(e.sid):'',spaceName:String(e.spaceName||''),colName:String(e.colName||''),deletedAt:isNaN(Date.parse(e.deletedAt))?now():e.deletedAt}})}
/* Versionsverlauf: bis zu 20 frühere Stände pro Notiz (ohne Bilder) */
function normHistory(h){const o={};if(!h||typeof h!=='object')return o;
  for(const[k,v]of Object.entries(h)){if(!okId(k))continue;const l=arr(v).filter(x=>x&&!isNaN(Date.parse(x.at))).map(x=>({at:x.at,title:String(x.title||''),body:String(x.body||''),checklist:arr(x.checklist).filter(c=>c&&typeof c.text==='string').map(c=>({text:c.text,done:!!c.done}))})).slice(-HISTORY_MAX);if(l.length)o[k]=l}
  return o}
function payload(){return{app:'kanban-notizen',v:5,saved:now(),folders:DB.folders,spaces:DB.spaces,settings:DB.settings,trash:DB.trash,history:DB.history}}
