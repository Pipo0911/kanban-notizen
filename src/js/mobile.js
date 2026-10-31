/* Kanban Notizen · Handy/iPhone: Spalten-Leiste, Format-Leiste, Tastatur, Wischgesten, App-Badge, Installationshinweis */
'use strict';
const isPhone=()=>matchMedia('(max-width:700px)').matches;

/* ---------- Spalten-Leiste über dem Board ---------- */
function colChipsHTML(s,notes){return`<div class="col-chips" id="colChips">${s.columns.map((c,k)=>{const n=notes.filter(x=>x.colId===c.id).length;
  return`<button class="cchip${k===0?' on':''}" data-cchip="${k}"><span class="col-dot" style="background:${NC[c.color].d}"></span>${esc(c.name)}<span class="cc-n">${n}</span></button>`}).join('')}</div>`}
function bindColChips(el){const bar=$('#colChips',el),bw=$('#bw',el);if(!bar||!bw)return;
  const cols=$$('.col',bw),chips=$$('.cchip',bar);
  const mark=()=>{const x=bw.scrollLeft+bw.clientWidth*0.35;let k=0;cols.forEach((c,i)=>{if(c.offsetLeft<=x)k=i});
    chips.forEach((b,i)=>b.classList.toggle('on',i===k));const on=chips[k];if(on){const r=on.offsetLeft-bar.clientWidth/2+on.clientWidth/2;bar.scrollTo({left:r,behavior:'smooth'})}};
  chips.forEach(b=>b.onclick=()=>{const c=cols[+b.dataset.cchip];if(c)bw.scrollTo({left:c.offsetLeft-16,behavior:'smooth'})});
  let t=0;bw.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(mark,60)},{passive:true});requestAnimationFrame(mark)}

/* ---------- Format-Leiste über der Tastatur ---------- */
const MD_BAR=[['b','<b>B</b>','Fett'],['i','<i>I</i>','Kursiv'],['h','H','Überschrift'],['ul','•','Liste'],['ck','☐','Aufgabe'],['link','[[ ]]','Notiz verlinken'],['code','&lt;/&gt;','Code'],['tab','⇥','Einrücken'],['done','Fertig','Tastatur schliessen']];
function mdBarHTML(){return`<div class="md-bar" role="toolbar" aria-label="Formatieren">${MD_BAR.map(([k,l,t])=>`<button type="button" data-md="${k}" title="${t}" aria-label="${t}">${l}</button>`).join('')}</div>`}
function bindMdBar(bar,ta,after){
  const wrap=(a,b,ph)=>{const s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.slice(s,e)||ph;ta.setRangeText(a+sel+b,s,e,'end');ta.setSelectionRange(s+a.length,s+a.length+sel.length)};
  const linePrefix=p=>{const s=ta.selectionStart,ls=ta.value.lastIndexOf('\n',s-1)+1,line=ta.value.slice(ls,ta.value.indexOf('\n',s)<0?ta.value.length:ta.value.indexOf('\n',s));
    if(line.startsWith(p)){ta.setRangeText('',ls,ls+p.length,'end')}else{const cur=line.match(/^(#{1,4} |[-*] \[[ xX]\] |[-*•] )/);ta.setRangeText(p,ls,ls+(cur?cur[0].length:0),'end')}};
  $$('[data-md]',bar).forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const k=b.dataset.md;
    if(k==='done'){ta.blur();return}
    if(k==='b')wrap('**','**','fett');else if(k==='i')wrap('*','*','kursiv');else if(k==='code')wrap('`','`','code');
    else if(k==='h')linePrefix('## ');else if(k==='ul')linePrefix('- ');else if(k==='ck')linePrefix('- [ ] ');
    else if(k==='tab'){const s=ta.selectionStart;ta.setRangeText('  ',s,ta.selectionEnd,'end')}
    else if(k==='link'){const s=ta.selectionStart,e=ta.selectionEnd;const sel=ta.value.slice(s,e);ta.setRangeText('[['+sel,s,e,'end');ta.dispatchEvent(new Event('input'));ta.focus();return}
    ta.focus();after()}})}

/* ---------- Tastatur: Editor auf sichtbare Höhe begrenzen ---------- */
if(window.visualViewport){const vv=window.visualViewport;
  const fit=()=>{const kb=innerHeight-vv.height>120;document.documentElement.style.setProperty('--vvh',vv.height+'px');document.documentElement.classList.toggle('kb-open',kb&&isPhone());
    if(kb&&isPhone()){const a=document.activeElement;if(a&&a.tagName==='TEXTAREA'&&a.closest('#dlg'))setTimeout(()=>a.scrollIntoView({block:'nearest'}),50)}};
  vv.addEventListener('resize',fit);vv.addEventListener('scroll',()=>{if(document.documentElement.classList.contains('kb-open'))window.scrollTo(0,0)});fit()}

/* ---------- Wischen: vom linken Rand öffnet das Menü, nach links schliesst es ---------- */
{let sx=0,sy=0,mode='';
  document.addEventListener('touchstart',e=>{if(!isPhone()||e.touches.length!==1||$('dialog[open]'))return;const t=e.touches[0];sx=t.clientX;sy=t.clientY;
    const open=$('.app').classList.contains('menu-open');mode=open?'close':(sx<24?'open':'')},{passive:true});
  document.addEventListener('touchend',e=>{if(!mode)return;const t=e.changedTouches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);
    if(dy<60){if(mode==='open'&&dx>60)$('.app').classList.add('menu-open');else if(mode==='close'&&dx<-60)$('.app').classList.remove('menu-open')}mode=''},{passive:true})}

/* ---------- Badge-Zahl am App-Icon (überfällig + heute fällig) ---------- */
let badgeT=0;
function updateBadge(){if(!WEB||!('setAppBadge' in navigator))return;clearTimeout(badgeT);badgeT=setTimeout(()=>{const n=countToday();(n?navigator.setAppBadge(n):navigator.clearAppBadge()).catch(()=>{})},300)}

/* ---------- Hinweis: auf dem iPhone als App installieren ---------- */
const INSTALL_KEY='kanban-notizen-install-hint';
function showInstallHint(){if(!WEB||!IOS||STANDALONE)return false;try{return!localStorage.getItem(INSTALL_KEY)}catch(e){return true}}
function installHintHTML(){return`<span>Als App nutzen: unten auf <b>Teilen</b> <span class="share-ic" aria-hidden="true">⬆︎</span> tippen, dann <b>Zum Home-Bildschirm</b>.</span><button class="btn sm ghost" id="instX">Ausblenden</button>`}
function bindInstallHint(){const x=$('#instX');if(x)x.onclick=()=>{try{localStorage.setItem(INSTALL_KEY,'1')}catch(e){}renderBanner()}}
