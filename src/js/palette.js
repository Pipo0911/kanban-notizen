/* Kanban Notizen · Suche und Befehle (Strg+K) */
'use strict';
/* ============ Suche & Befehle (Strg+K) ============ */
function openPalette(){const d=$('#pal');let sel=0,items=[];
  d.innerHTML='<input class="pal-in" id="palIn" placeholder="Notizen durchsuchen oder Befehl eingeben …" autocomplete="off" aria-label="Suche"><div class="pal-list" id="palList" role="listbox"></div><div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> auswählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schliessen</span></div>';
  const inp=$('#palIn',d),list=$('#palList',d);
  const cmds=()=>{const s=sp();return[
    {sec:'Befehle',i:'+',t:`Neue Notiz in „${s.name}“`,run:()=>createNote(s.id)},
    ...DB.settings.templates.map(t=>({sec:'Befehle',i:'+',t:`Neue Notiz aus Vorlage: ${t.name}`,run:()=>createNote(s.id,null,t)})),
    {sec:'Befehle',i:'▦',t:'Tagesnotiz von heute',run:()=>openDaily(today())},{sec:'Befehle',i:'▦',t:'Tagesnotiz von gestern',run:()=>openDaily(addDays(today(),-1))},
    {sec:'Befehle',i:'⏱',t:runningTimer()?'Zeiterfassung stoppen':'Zeiterfassung öffnen',run:()=>{const r=runningTimer();r?stopTimer(r.s,r.n):setView('time')}},
    {sec:'Gehe zu',i:'›',t:'Heute & Termine',run:()=>setView('today')},{sec:'Gehe zu',i:'›',t:'Zeiterfassung',run:()=>setView('time')},{sec:'Gehe zu',i:'›',t:'Papierkorb',run:()=>setView('trash')},{sec:'Gehe zu',i:'›',t:'Einstellungen',run:()=>setView('settings')},
    ...DB.spaces.map(x=>({sec:'Gehe zu',i:'›',t:'Space: '+spaceLabel(x),run:()=>goSpace(x.id)})),
    {sec:'Befehle',i:'+',t:'Kategorie erstellen',run:()=>createFolder('')},
    {sec:'Befehle',i:'↓',t:'Backup speichern',run:()=>backupAll()},{sec:'Befehle',i:'⎙',t:`Space „${s.name}“ drucken / PDF`,run:()=>printSpace(s)}]};
  const draw=()=>{const q=inp.value.trim().toLowerCase();
    const notes=[];for(const{s,n}of allNotes()){const hay=[n.title,n.body,n.tags.join(' '),n.checklist.map(c=>c.text).join(' ')].join('\n').toLowerCase();if(!q||hay.includes(q))notes.push({s,n,score:(n.title.toLowerCase().includes(q)?2:0)+(n.archived?-3:0)+(isDone(s,n)?-1:0)})}
    notes.sort((a,b)=>b.score-a.score||b.n.updated.localeCompare(a.n.updated));
    const cm=cmds().filter(c=>!q||c.t.toLowerCase().includes(q));
    const favs=!q?favorites().slice(0,8).map(x=>({sec:'Favoriten',i:'★',t:noteLabel(x.n),sub:x.s.name,run:()=>openNote(x.s.id,x.n.id)})):[];
    items=[...favs,...(q?notes.slice(0,30).map(x=>({sec:'Notizen',i:'▤',t:noteLabel(x.n),sub:spaceLabel(x.s)+(x.n.archived?' · Archiv':isDone(x.s,x.n)?' · erledigt':''),run:()=>openNote(x.s.id,x.n.id)})):[]),...cm.slice(0,q?8:20),...(!q?notes.slice(0,8).map(x=>({sec:'Zuletzt geändert',i:'▤',t:noteLabel(x.n),sub:x.s.name,run:()=>openNote(x.s.id,x.n.id)})):[])];
    sel=Math.min(sel,Math.max(0,items.length-1));let last='';
    list.innerHTML=items.map((it,k)=>{const h=it.sec!==last?`<div class="pal-sec">${it.sec}</div>`:'';last=it.sec;return h+`<div class="pal-it${k===sel?' on':''}" data-k="${k}" role="option"><span class="pi">${it.i}</span><span class="pt">${esc(it.t)}</span>${it.sub?`<span class="ps">${esc(it.sub)}</span>`:''}</div>`}).join('')||'<div class="empty-big" style="padding:24px">Nichts gefunden.</div>';
    $$('.pal-it',list).forEach(x=>{x.onclick=()=>go(+x.dataset.k);x.onmousemove=()=>{if(sel!==+x.dataset.k){sel=+x.dataset.k;$$('.pal-it',list).forEach(y=>y.classList.toggle('on',y===x))}}})};
  const go=k=>{const it=items[k];if(!it)return;d.close();setTimeout(()=>it.run(),0)};
  inp.oninput=()=>{sel=0;draw()};
  inp.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(items.length-1,sel+1);draw();$('.pal-it.on',list)?.scrollIntoView({block:'nearest'})}
    else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);draw();$('.pal-it.on',list)?.scrollIntoView({block:'nearest'})}
    else if(e.key==='Enter'){e.preventDefault();go(sel)}};
  d.onclick=e=>{if(e.target===d)d.close()};
  draw();d.showModal();inp.focus()}
function showHelp(){const K=(...k)=>'<span>'+k.map(x=>`<kbd>${x}</kbd>`).join(' + ')+'</span>';
  const rows=[[K('N'),'Neue Notiz im aktuellen Space'],[K('Strg','K'),'Alles durchsuchen und Befehle'],[K('/'),'Im aktuellen Space suchen'],[K('D'),'Tagesnotiz von heute'],[K('H'),'Heute & Termine'],[K('Z'),'Zeiterfassung'],[K('T'),'Laufende Zeit stoppen'],
    [K('1')+' … '+K('4'),'Board · Alle Notizen · Archiv · Space-Einstellungen'],[K('Esc'),'Editor schliessen – gespeichert wird automatisch'],[K('Strg','V'),'Im Editor: Screenshot einfügen'],[K('Enter'),'Im Text: Liste automatisch fortsetzen'],['<span><kbd>[[</kbd></span>','Im Text: andere Notiz verlinken (mit Vorschlägen)'],[K('?'),'Diese Übersicht']];
  ask({title:'Tastenkürzel',ok:'Schliessen',cancel:null,text:`<div class="keys">${rows.map(([k,t])=>k+`<span>${esc(t)}</span>`).join('')}</div>`})}
