/* Kanban Notizen · Wiederholungen, Zeiterfassung, Erinnerungen */
'use strict';
/* ============ Wiederholungen ============ */
function advance(d,r){
  if(r==='daily')return addDays(d,1);
  if(r==='weekdays'){let x=addDays(d,1);while(dow(x)===0||dow(x)===6)x=addDays(x,1);return x}
  if(r==='weekly')return addDays(d,7);if(r==='biweekly')return addDays(d,14);
  const[y,m,t]=d.split('-').map(Number);
  if(r==='monthly'){const ny=m===12?y+1:y,nm=m===12?1:m+1,last=new Date(ny,nm,0).getDate();return`${ny}-${String(nm).padStart(2,'0')}-${String(Math.min(t,last)).padStart(2,'0')}`}
  if(r==='yearly'){const last=new Date(y+1,m,0).getDate();return`${y+1}-${String(m).padStart(2,'0')}-${String(Math.min(t,last)).padStart(2,'0')}`}
  return d}
function spawnNext(s,n){
  if(!n.repeat)return null;
  let next=advance(n.due||today(),n.repeat);while(next<=today())next=advance(next,n.repeat);
  const c=newNote(s,{title:n.title,body:n.body,color:n.color,tags:[...n.tags],pinned:n.pinned,colId:firstOpenCol(s).id,checklist:n.checklist.map(x=>ck(x.text)),due:next,dueTime:n.dueTime,repeat:n.repeat});
  n.repeat='';return c}
function afterDone(s,n,wasDone){if(wasDone||!isDone(s,n))return;if(n.timerStart)stopTimer(s,n,true);
  const c=spawnNext(s,n);if(c)toast(`Wiederholung erstellt für ${fmtShort(c.due)}`,{open:()=>openNote(s.id,c.id)})}
/* ============ Zeiterfassung ============ */
function startTimer(s,n){const r=runningTimer();if(r&&r.n!==n)stopTimer(r.s,r.n,true);n.timerStart=now();n.updated=now();save();renderAll();toast('Zeit läuft: '+noteLabel(n))}
function stopTimer(s,n,quiet){if(!n.timerStart)return;const st=Date.parse(n.timerStart),en=Date.now(),raw=(en-st)/6e4;n.timerStart='';n.updated=now();
  let min=Math.round(raw);const rnd=DB.settings.round;if(rnd&&raw>=.5)min=Math.max(rnd,Math.ceil(raw/rnd)*rnd);
  if(raw<.5){save();renderAll();if(!quiet)toast('Unter einer Minute – nicht erfasst');return}
  n.time.push({id:uid(),day:isoDay(new Date(st)),min:Math.max(1,min),text:'',start:new Date(st).toISOString(),end:new Date(en).toISOString()});
  save();renderAll();if(!quiet)toast(`${hShort(Math.max(1,min))} erfasst bei „${noteLabel(n)}“`)}
function toggleTimer(s,n){n.timerStart?stopTimer(s,n):startTimer(s,n)}
function renderAll(){render();if($('#dlg').open&&edRefresh)edRefresh()}
let edRefresh=null;
setInterval(()=>{const r=runningTimer();const el=$('#timerTime');if(r&&el)el.textContent=clock(Date.now()-Date.parse(r.n.timerStart));
  $$('[data-runclock]').forEach(x=>{const nn=r&&r.n.id===x.dataset.runclock?r.n:null;if(nn)x.textContent=clock(Date.now()-Date.parse(nn.timerStart)).replace(/^00:/,'')})},1000);
/* ============ Erinnerungen ============ */
function checkReminders(){const nw=new Date();let changed=false;
  for(const{s,n}of allNotes()){if(isDone(s,n)||!n.due||!n.dueTime)continue;const key=n.due+' '+n.dueTime;if(n.remindedFor===key)continue;
    const at=new Date(n.due+'T'+n.dueTime);if(nw<at)continue;
    n.remindedFor=key;changed=true;
    if(nw-at<36e5*12){toast('Erinnerung: '+noteLabel(n),{open:()=>openNote(s.id,n.id)});
      if(DB.settings.notify&&'Notification' in window&&Notification.permission==='granted'){try{const no=new Notification('Erinnerung · '+noteLabel(n),{body:(n.dueTime?n.dueTime+' · ':'')+s.name,tag:n.id});no.onclick=()=>{window.focus();openNote(s.id,n.id)}}catch(e){}}}}
  if(changed){save(true);render()}}
setInterval(checkReminders,30000);
