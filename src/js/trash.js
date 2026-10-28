/* Kanban Notizen · Papierkorb und Versionsverlauf */
'use strict';

/* ---------- Papierkorb ---------- */
function trashNote(s,n){const c=colOf(s,n);s.notes=s.notes.filter(x=>x!==n);
  const note=JSON.parse(JSON.stringify(n));for(const k of Object.keys(note))if(k[0]==='_')delete note[k];
  if(note.timerStart){note.timerStart=''}
  DB.trash.unshift({id:uid(),note,sid:s.id,spaceName:s.name,colName:c?c.name:'',deletedAt:now()})}
const trashLeft=e=>Math.max(0,TRASH_DAYS-Math.floor((Date.now()-Date.parse(e.deletedAt))/864e5));
function purgeTrash(){const before=DB.trash.length;DB.trash=DB.trash.filter(e=>trashLeft(e)>0);
  const ids=new Set([...allNotes().map(x=>x.n.id),...DB.trash.map(e=>e.note.id)]);let h=0;
  for(const k of Object.keys(DB.history))if(!ids.has(k)){delete DB.history[k];h++}
  if(before!==DB.trash.length||h)save(true)}
setInterval(()=>{if(tv.loaded)purgeTrash()},36e5);
function restoreTrash(e){let s=spaceById(e.sid),moved=false;if(!s){s=e.note.daily?dailySpace():sp();moved=true}
  const n=normNote(e.note,s,0);if(!s.columns.some(c=>c.id===n.colId))n.colId=firstOpenCol(s).id;
  if(allNotes().some(x=>x.n.id===n.id))n.id=uid();
  n.order=maxOrder(s,n.colId)+1;s.notes.push(n);DB.trash=DB.trash.filter(x=>x!==e);return{s,n,moved}}
function trashSpace(e){return spaceById(e.sid)||{id:'',name:e.spaceName||'Gelöschter Space',color:'#8a8f9c',columns:[{id:e.note.colId,name:e.colName||'',color:'grey',done:false}],notes:[]}}
function renderTrash(el){const L=DB.trash;
  el.innerHTML=`<div class="scroll wall-wrap" id="bw">${L.length?`<div class="row-btns" style="margin:4px 0 14px"><span class="muted">${L.length} gelöschte Notiz${L.length===1?'':'en'} · Einträge werden nach ${TRASH_DAYS} Tagen endgültig entfernt.</span><span class="spacer"></span><button class="btn sm danger" id="trEmpty">Papierkorb leeren …</button></div>
    <div class="wall">${L.map(e=>{const s=trashSpace(e),left=trashLeft(e);
      return`<div class="tr-wrap" data-tid="${e.id}">${cardHTML(s,e.note,{wall:true,ro:true}).replace('class="card ','class="card tr-card ').replace(/ data-sid="[^"]*"/,'')}
      <div class="tr-meta">Aus <b>${esc(e.spaceName||s.name)}</b>${e.colName?' · '+esc(e.colName):''} · gelöscht ${esc(rel(e.deletedAt))} · noch ${left} Tag${left===1?'':'e'}</div>
      <div class="arch-acts"><button class="btn sm" data-trest>Wiederherstellen</button><button class="btn sm danger" data-tdel>Endgültig löschen</button></div></div>`}).join('')}</div>`
    :'<div class="empty-big">Der Papierkorb ist leer. Gelöschte Notizen landen hier und lassen sich 30 Tage lang wiederherstellen.</div>'}</div>`;
  $$('.tr-wrap',el).forEach(w=>{const e=DB.trash.find(x=>x.id===w.dataset.tid);if(!e)return;
    const restore=()=>{const r=restoreTrash(e);save();render();toast(r.moved?`Wiederhergestellt in „${r.s.name}“ (ursprünglicher Space existiert nicht mehr)`:`Wiederhergestellt in „${r.s.name}“`,{open:()=>openNote(r.s.id,r.n.id)})};
    $('[data-trest]',w).onclick=restore;
    $('[data-tdel]',w).onclick=async()=>{const r=await ask({title:'Endgültig löschen?',text:`„${esc(noteLabel(e.note))}“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,ok:'Endgültig löschen',danger:true});if(!r)return;
      DB.trash=DB.trash.filter(x=>x!==e);delete DB.history[e.note.id];save();render();toast('Endgültig gelöscht')};
    $('.card',w).onclick=async ev=>{if(ev.target.closest('a,button,input'))return;const r=await ask({title:noteLabel(e.note),wide:true,cancel:'Schliessen',ok:'Wiederherstellen',
      text:`<div class="md tr-prev">${e.note.body.trim()?md(e.note.body):'<span class="muted">Kein Text</span>'}${e.note.checklist.length?'<ul class="pck">'+e.note.checklist.map(c=>`<li class="${c.done?'done':''}">${esc(c.text)}</li>`).join('')+'</ul>':''}</div>`});if(r)restore()}});
  const te=$('#trEmpty',el);if(te)te.onclick=async()=>{const r=await ask({title:'Papierkorb leeren?',text:`${L.length} Notiz${L.length===1?'':'en'} werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,ok:'Endgültig löschen',danger:true});if(!r)return;
    DB.trash.forEach(e=>delete DB.history[e.note.id]);DB.trash=[];save();render();toast('Papierkorb geleert')}}

/* ---------- Versionsverlauf ---------- */
const snapOf=n=>({at:n.updated,title:n.title,body:n.body,checklist:n.checklist.map(c=>({text:c.text,done:c.done}))});
const snapKey=x=>JSON.stringify([x.title,x.body,x.checklist.map(c=>[c.text,c.done])]);
/* Speichert den Stand vor der Bearbeitung, wenn sich etwas geändert hat */
function recordHistory(n,before){if(!before||snapKey(before)===snapKey(snapOf(n)))return;
  const l=DB.history[n.id]||(DB.history[n.id]=[]);if(l.length&&snapKey(l[l.length-1])===snapKey(before))return;
  l.push(before);while(l.length>HISTORY_MAX)l.shift()}
function diffStat(a,b){const A=new Set(a.split('\n')),B=new Set(b.split('\n'));let add=0,del=0;B.forEach(x=>{if(!A.has(x)&&x.trim())add++});A.forEach(x=>{if(!B.has(x)&&x.trim())del++});return{add,del}}
function showHistory(s,n,onRestore){const l=[...(DB.history[n.id]||[])].reverse();
  if(!l.length){ask({title:'Versionsverlauf',text:'Für diese Notiz gibt es noch keine früheren Versionen. Eine Version wird gespeichert, sobald du die Notiz bearbeitet und geschlossen hast (bis zu 20 pro Notiz).',ok:'OK',cancel:null});return}
  const d=$('#dlg2');d.style.width='min(900px,calc(100vw - 24px))';let sel=0;
  const cur=snapOf(n);
  const draw=()=>{const v=l[sel],st=diffStat(v.body,cur.body);
    d.innerHTML=`<div class="dh">Versionsverlauf · ${esc(noteLabel(n))}</div><div class="hist">
      <div class="hist-list">${l.map((v,k)=>`<button type="button" class="hist-it${k===sel?' on':''}" data-k="${k}"><b>${esc(fmtTime(v.at))}</b><span class="muted sm">${esc(rel(v.at))} · ${esc(v.title.trim()||'Ohne Titel')}</span></button>`).join('')}</div>
      <div class="hist-view"><div class="muted sm" style="margin-bottom:8px">Stand vom ${esc(fmtTime(v.at))} · im Vergleich zu jetzt: <span class="ok-t">+${st.add}</span> / <span class="del-t">−${st.del}</span> Zeilen</div>
        <h3 class="hist-t">${esc(v.title||'Ohne Titel')}</h3><div class="md">${v.body.trim()?md(v.body):'<span class="muted">Kein Text</span>'}</div>
        ${v.checklist.length?'<ul class="pck">'+v.checklist.map(c=>`<li class="${c.done?'done':''}">${esc(c.text)}</li>`).join('')+'</ul>':''}</div></div>
      <div class="df"><span class="muted sm">Der aktuelle Stand wird beim Wiederherstellen selbst als Version gesichert.</span><span class="spacer"></span><button type="button" class="btn ghost" data-x>Schliessen</button><button type="button" class="btn primary" data-restore>Diese Version wiederherstellen</button></div>`;
    $$('.hist-it',d).forEach(b=>b.onclick=()=>{sel=+b.dataset.k;draw()});
    $('[data-x]',d).onclick=()=>d.close();
    $('[data-restore]',d).onclick=()=>{const v=l[sel];recordHistory(n,snapOf(n));n.title=v.title;n.body=v.body;n.checklist=v.checklist.map(c=>ck(c.text,c.done));n.updated=now();save();d.close();onRestore();toast('Version vom '+fmtTime(v.at)+' wiederhergestellt')}};
  draw();d.onclose=()=>{d.style.width=''};d.showModal();$('.hist-it',d).focus()}
