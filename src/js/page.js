/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Kanban Notizen · Freie Seite wie in OneNote: Textkästen und Bilder frei platzieren, mit Stift zeichnen.
   Daten: n.kind='page', n.page={bg, items:[{id,t:'text',x,y,w,html}|{id,t:'img',x,y,w,src}], ink:[{id,c,w,a,p}]}
   n.body wird automatisch aus den Textkästen erzeugt – so funktionieren Suche, Vorschau, Links und Rückverweise weiter. */
'use strict';
const PAGE_BG=[['plain','Blanko'],['lines','Liniert'],['grid','Kariert'],['dots','Punkte']];
const PEN_COLORS=['#1d1f24','#2f5bd3','#d64545','#1e9e5a','#e6862a','#8a4fd6'];
const MARK_COLORS=['#ffe14d','#7cf29a','#7fd3ff','#ff9ad5','#ffb36b'];
const blankPage=()=>({bg:'plain',items:[],ink:[]});

/* ---------- Normalisieren und Sicherheit ---------- */
const num=(v,d=0,min=-1e5,max=1e5)=>{v=Math.round(+v);return isFinite(v)?Math.max(min,Math.min(max,v)):d};
function normPage(p){p=p&&typeof p==='object'?p:{};
  const items=arr(p.items).filter(x=>x&&(x.t==='text'||x.t==='img')).map(x=>x.t==='text'
      ?{id:okId(x.id)?String(x.id):uid(),t:'text',x:num(x.x,40,0),y:num(x.y,40,0),w:num(x.w,320,80,4000),html:String(x.html||'')}
      :{id:okId(x.id)?String(x.id):uid(),t:'img',x:num(x.x,40,0),y:num(x.y,40,0),w:num(x.w,320,30,4000),src:/^data:image\//.test(x.src||'')?String(x.src):''})
    .filter(x=>x.t!=='img'||x.src);
  const ink=arr(p.ink).filter(s=>s&&typeof s.p==='string'&&s.p.length<200000).map(s=>({id:okId(s.id)?String(s.id):uid(),c:/^#[0-9a-f]{6}$/i.test(s.c)?s.c:'#1d1f24',w:num(s.w,3,1,60),a:Math.max(.1,Math.min(1,+s.a||1)),p:s.p}));
  return{bg:PAGE_BG.some(b=>b[0]===p.bg)?p.bg:'plain',items,ink}}
const OK_TAGS=new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','UL','OL','LI','H1','H2','H3','SPAN','A','CODE','PRE','INPUT','MARK','BLOCKQUOTE']);
/* Nur harmloses HTML behalten (keine Skripte, Ereignisse, fremde Stile) */
function cleanHTML(html){const t=document.createElement('template');t.innerHTML=String(html||'');
  const walk=node=>{for(const el of[...node.children]){
    if(!OK_TAGS.has(el.tagName)||(el.tagName==='INPUT'&&el.type!=='checkbox')){el.replaceWith(...(el.tagName==='INPUT'?[]:[document.createTextNode(el.textContent)]));continue}
    const keep={};if(el.tagName==='A'&&/^https?:\/\//i.test(el.getAttribute('href')||''))keep.href=el.getAttribute('href');
    if(el.tagName==='INPUT'){keep.type='checkbox';if(el.hasAttribute('checked')||el.checked)keep.checked=''}
    const bg=el.style&&el.style.backgroundColor,fg=el.style&&el.style.color;
    for(const a of[...el.attributes])el.removeAttribute(a.name);
    for(const[k,v]of Object.entries(keep))el.setAttribute(k,v);
    if(el.tagName==='A'){el.setAttribute('target','_blank');el.setAttribute('rel','noopener')}
    if(bg&&/^(rgb|#)/.test(bg))el.style.backgroundColor=bg;if(fg&&/^(rgb|#)/.test(fg))el.style.color=fg;
    walk(el)}};
  walk(t.content);return t.innerHTML}
/* Text der Seite für Suche, Karten-Vorschau und Links */
function htmlToText(html){const t=document.createElement('template');t.innerHTML=html;const out=[];let line='';
  const flush=()=>{out.push(line.replace(/\s+$/,''));line=''};
  const walk=n=>{for(const c of n.childNodes){
    if(c.nodeType===3){line+=c.nodeValue.replace(/\s+/g,' ');continue}
    if(c.nodeType!==1)continue;const tg=c.tagName;
    if(tg==='BR'){flush();continue}
    if(tg==='INPUT'){line+=c.hasAttribute('checked')?'[x] ':'[ ] ';continue}
    const block=/^(DIV|P|LI|H1|H2|H3|PRE|BLOCKQUOTE)$/.test(tg);
    if(block&&line.trim())flush();
    if(tg==='LI')line+='- ';else if(/^H[123]$/.test(tg))line+='#'.repeat(+tg[1])+' ';
    walk(c);if(block)flush()}};
  walk(t.content);if(line)flush();return out.filter((l,i,a)=>l.trim()||(i&&a[i-1].trim())).join('\n').trim()}
function pageText(pg){return pg.items.filter(x=>x.t==='text').sort((a,b)=>a.y-b.y||a.x-b.x).map(x=>htmlToText(x.html)).filter(Boolean).join('\n\n')}
function pageFirstImage(pg){const i=pg&&pg.items.find(x=>x.t==='img');return i?i.src:''}

/* ---------- Glatte Linie aus Punkten ---------- */
function strokePath(p){const pts=p.split(' ').map(s=>s.split(',').map(Number));if(!pts.length)return'';
  if(pts.length<3){const[a]=pts,b=pts[pts.length-1];return`M${a[0]} ${a[1]}L${b[0]+.1} ${b[1]+.1}`}
  let d=`M${pts[0][0]} ${pts[0][1]}`;for(let i=1;i<pts.length-1;i++){const m=[(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2];d+=`Q${pts[i][0]} ${pts[i][1]} ${m[0]} ${m[1]}`}
  const l=pts[pts.length-1];return d+`L${l[0]} ${l[1]}`}

/* ---------- Seite bearbeiten ---------- */
function mountPage(host,n,onChange){
  if(!n.page)n.page=blankPage();const pg=n.page;
  const st={tool:'text',pen:PEN_COLORS[0],mark:MARK_COLORS[0],fg:'#d64545',hl:'#ffe14d',size:3,sel:null,undo:[],redo:[],last:{x:60,y:60}};
  host.innerHTML=`<div class="pg-bar" role="toolbar" aria-label="Seite">
      <div class="pg-grp" data-g="tools">
        <button type="button" data-tool="text" title="Text: irgendwo hinklicken und schreiben">${PG_IC.text}<span>Text</span></button>
        <button type="button" data-tool="pen" title="Stift">${PG_IC.pen}<span>Stift</span></button>
        <button type="button" data-tool="mark" title="Textmarker">${PG_IC.mark}<span>Marker</span></button>
        <button type="button" data-tool="erase" title="Radierer (Striche löschen)">${PG_IC.erase}<span>Radierer</span></button>
      </div>
      <div class="pg-grp pg-colors" id="pgColors"></div>
      <div class="pg-grp pg-sizes" id="pgSizes"></div>
      <div class="pg-grp pg-fmt" id="pgFmt">
        <button type="button" data-cmd="bold" title="Fett (Strg+B)"><b>B</b></button><button type="button" data-cmd="italic" title="Kursiv (Strg+I)"><i>I</i></button><button type="button" data-cmd="underline" title="Unterstrichen (Strg+U)"><u>U</u></button><button type="button" data-cmd="strikeThrough" title="Durchgestrichen"><s>S</s></button>
        <button type="button" data-cmd="h" title="Überschrift">H</button><button type="button" data-cmd="insertUnorderedList" title="Aufzählung">•</button><button type="button" data-cmd="insertOrderedList" title="Nummerierung">1.</button><button type="button" data-cmd="check" title="Aufgabe ☐">☐</button><span class="pg-split"><button type="button" data-cmd="fore" title="Textfarbe" class="pg-fg"><b>A</b><i id="pgFgBar"></i></button><button type="button" class="pg-more" data-pick="fore" title="Textfarbe wählen" aria-label="Textfarbe wählen">▾</button></span><span class="pg-split"><button type="button" data-cmd="hilite" title="Markieren" class="pg-hl">${PG_IC.mark}<i id="pgHlBar"></i></button><button type="button" class="pg-more" data-pick="hilite" title="Markierfarbe wählen" aria-label="Markierfarbe wählen">▾</button></span>
      </div>
      <div class="pg-grp">
        <button type="button" id="pgImg" title="Bild einfügen (oder Strg+V / hierher ziehen)">${PG_IC.img}<span>Bild</span></button>
        <select id="pgBg" title="Papier" aria-label="Papier">${PAGE_BG.map(([k,l])=>`<option value="${k}"${pg.bg===k?' selected':''}>${l}</option>`).join('')}</select>
        <button type="button" id="pgUndo" title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button><button type="button" id="pgRedo" title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button>
      </div></div>
    <div class="pg-scroll" id="pgScroll"><div class="pg-canvas bg-${pg.bg}" id="pgCanvas"><svg class="pg-ink" id="pgInk" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="pg-hint" id="pgHint">Irgendwo hinklicken und losschreiben · Bilder mit Strg+V einfügen oder hierher ziehen · ✎ Stift zum Zeichnen</div></div></div>
    <input type="file" id="pgFile" accept="image/*" multiple hidden>`;
  const cv=$('#pgCanvas',host),sc=$('#pgScroll',host),svg=$('#pgInk',host);
  const changed=()=>{n.body=pageText(pg);onChange()};
  const snap=()=>({bg:pg.bg,items:pg.items.map(x=>({...x})),ink:pg.ink.map(x=>({...x}))});
  const pushUndo=()=>{st.undo.push(snap());if(st.undo.length>40)st.undo.shift();st.redo=[]};
  const restore=s=>{pg.bg=s.bg;pg.items=s.items;pg.ink=s.ink;$('#pgBg',host).value=pg.bg;drawAll();changed()};

  /* Grösse der Fläche: wächst mit dem Inhalt */
  const fit=()=>{let W=0,H=0;
    $$('.pg-item',cv).forEach(e=>{W=Math.max(W,e.offsetLeft+e.offsetWidth);H=Math.max(H,e.offsetTop+e.offsetHeight)});
    for(const s of pg.ink)for(const q of s.p.split(' ')){const[x,y]=q.split(',').map(Number);if(x>W)W=x;if(y>H)H=y}
    cv.style.width=Math.max(sc.clientWidth-2,W+400,isPhone()?0:1100)+'px';cv.style.height=Math.max(sc.clientHeight-2,H+500,1200)+'px';
    svg.setAttribute('width',cv.offsetWidth);svg.setAttribute('height',cv.offsetHeight)};
  const pos=e=>{const r=cv.getBoundingClientRect();return{x:Math.round(e.clientX-r.left),y:Math.round(e.clientY-r.top)}};

  /* ---------- Elemente zeichnen ---------- */
  const itemEl=it=>{const d=document.createElement('div');d.className='pg-item pg-'+it.t;d.dataset.id=it.id;
    d.style.left=it.x+'px';d.style.top=it.y+'px';d.style.width=it.w+'px';
    if(it.t==='text')d.innerHTML=`<div class="pg-grip" title="Ziehen zum Verschieben" aria-label="Verschieben">⋯</div><div class="pg-edit" contenteditable="true" spellcheck="true">${cleanHTML(it.html)}</div><div class="pg-rs" title="Breite ändern"></div><button type="button" class="pg-del" title="Kasten löschen" aria-label="Löschen">✕</button>`;
    else d.innerHTML=`<img src="${it.src}" alt="" draggable="false"><div class="pg-rs corner" title="Grösse ändern"></div><button type="button" class="pg-del" title="Bild löschen" aria-label="Löschen">✕</button>`;
    bindItem(d,it);return d};
  const drawInk=()=>{svg.innerHTML=pg.ink.map(s=>`<path data-id="${s.id}" d="${strokePath(s.p)}" stroke="${s.c}" stroke-width="${s.w}" stroke-opacity="${s.a}" fill="none" stroke-linecap="round" stroke-linejoin="round"${s.a<1?' class="mk"':''}/>`).join('')};
  const drawAll=()=>{$$('.pg-item',cv).forEach(e=>e.remove());pg.items.forEach(it=>cv.appendChild(itemEl(it)));drawInk();
    cv.className='pg-canvas bg-'+pg.bg+' tool-'+st.tool;$('#pgHint',host).hidden=!!(pg.items.length||pg.ink.length);requestAnimationFrame(fit)};

  /* ---------- Ziehen (Maus, Finger, Stift) ---------- */
  const dragWith=(e,move,end)=>{e.preventDefault();e.stopPropagation();const tgt=e.currentTarget;try{tgt.setPointerCapture(e.pointerId)}catch(x){}
    const sx=e.clientX,sy=e.clientY;const mv=ev=>move(ev.clientX-sx,ev.clientY-sy,ev);
    const up=ev=>{tgt.removeEventListener('pointermove',mv);tgt.removeEventListener('pointerup',up);tgt.removeEventListener('pointercancel',up);end(ev.clientX-sx,ev.clientY-sy)};
    tgt.addEventListener('pointermove',mv);tgt.addEventListener('pointerup',up);tgt.addEventListener('pointercancel',up)};
  const select=d=>{$$('.pg-item.sel',cv).forEach(x=>x!==d&&x.classList.remove('sel'));if(d)d.classList.add('sel');st.sel=d?d.dataset.id:null};
  function bindItem(d,it){
    const move=e=>{if(st.tool!=='text')return;const x0=it.x,y0=it.y;let moved=false;
      dragWith(e,(dx,dy)=>{if(!moved&&Math.hypot(dx,dy)<4)return;if(!moved){moved=true;pushUndo()}it.x=Math.max(0,x0+dx);it.y=Math.max(0,y0+dy);d.style.left=it.x+'px';d.style.top=it.y+'px'},
        ()=>{if(moved){fit();changed()}else if(it.t==='img')select(d)})};
    $('.pg-rs',d).addEventListener('pointerdown',e=>{const w0=it.w;pushUndo();dragWith(e,dx=>{it.w=Math.max(it.t==='img'?40:120,w0+dx);d.style.width=it.w+'px'},()=>{fit();changed()})});
    $('.pg-del',d).addEventListener('click',e=>{e.stopPropagation();pushUndo();pg.items=pg.items.filter(x=>x!==it);d.remove();fit();changed()});
    if(it.t==='img'){const im=$('img',d);im.addEventListener('pointerdown',move);im.addEventListener('dblclick',()=>lightbox(it.src));return}
    $('.pg-grip',d).addEventListener('pointerdown',move);
    const ed=$('.pg-edit',d);let t=0;
    ed.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{it.html=cleanHTML(ed.innerHTML);changed()},300);requestAnimationFrame(fit)});
    ed.addEventListener('focus',()=>{select(d);d.classList.add('editing')});
    ed.addEventListener('blur',()=>{d.classList.remove('editing');clearTimeout(t);it.html=cleanHTML(ed.innerHTML);
      if(!ed.textContent.trim()&&!ed.querySelector('input')){pg.items=pg.items.filter(x=>x!==it);d.remove();$('#pgHint',host).hidden=!!(pg.items.length||pg.ink.length)}
      changed()});
    ed.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();ed.blur()}});
    ed.addEventListener('click',e=>{if(e.target.tagName==='INPUT'){const c=e.target;setTimeout(()=>{c.checked?c.setAttribute('checked',''):c.removeAttribute('checked');it.html=cleanHTML(ed.innerHTML);changed()},0)}});
    ed.addEventListener('paste',e=>{const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>/^image\//.test(f.type));
      e.preventDefault();if(files.length){addImgs(files,{x:it.x,y:it.y+d.offsetHeight+16});return}
      const txt=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';document.execCommand('insertText',false,txt)})}
  const addText=(x,y,html='')=>{pushUndo();const it={id:uid(),t:'text',x:Math.max(0,x-8),y:Math.max(0,y-14),w:isPhone()?Math.min(300,cv.offsetWidth-x-10):360,html};
    pg.items.push(it);const d=itemEl(it);cv.appendChild(d);$('#pgHint',host).hidden=true;const ed=$('.pg-edit',d);ed.focus();fit();return it};
  async function addImgs(files,at){for(const f of files){if(!/^image\//.test(f.type))continue;
    try{const src=await shrink(f);const im=new Image();im.src=src;await im.decode().catch(()=>{});
      pushUndo();const w=Math.min(im.naturalWidth||480,isPhone()?Math.max(160,sc.clientWidth-40):560);
      const it={id:uid(),t:'img',x:Math.max(0,at.x),y:Math.max(0,at.y),w,src};pg.items.push(it);cv.appendChild(itemEl(it));at={x:at.x+24,y:at.y+24}}
    catch(e){toast('Bild konnte nicht gelesen werden')}}
    $('#pgHint',host).hidden=true;fit();changed()}

  /* ---------- Klick auf die Fläche: neuer Textkasten ---------- */
  let penClick=false;
  cv.addEventListener('click',e=>{if(penClick){penClick=false;return}
    if(st.tool!=='text'||e.target!==cv&&e.target!==svg&&e.target.id!=='pgHint')return;
    const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))a.blur();
    select(null);const p=pos(e);st.last=p;addText(p.x,p.y)});

  /* ---------- Zeichnen und Radieren ---------- */
  let cur=null;
  const startInk=e=>{const p=pos(e);
    if(st.tool==='erase'){pushUndo();eraseAt(p);cv.setPointerCapture(e.pointerId);cur={erase:true};return}
    const mk=st.tool==='mark'||(st.tool==='text'&&false);
    cur={id:uid(),c:mk?st.mark:st.pen,w:mk?Math.max(10,st.size*4):st.size,a:mk?.38:1,pts:[[p.x,p.y]]};
    const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('stroke',cur.c);el.setAttribute('stroke-width',cur.w);el.setAttribute('stroke-opacity',cur.a);
    el.setAttribute('fill','none');el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');if(cur.a<1)el.setAttribute('class','mk');svg.appendChild(el);cur.el=el;
    try{cv.setPointerCapture(e.pointerId)}catch(x){}};
  const eraseAt=p=>{const before=pg.ink.length;pg.ink=pg.ink.filter(s=>{const r=s.w/2+10;return!s.p.split(' ').some(q=>{const[x,y]=q.split(',').map(Number);return Math.abs(x-p.x)<r&&Math.abs(y-p.y)<r})});
    if(pg.ink.length!==before)drawInk()};
  cv.addEventListener('pointerdown',e=>{const penInput=e.pointerType==='pen'&&st.tool==='text'&&(e.target===cv||e.target===svg);
    if(!(st.tool!=='text'||penInput))return;if(e.target.closest&&e.target.closest('.pg-item')&&!penInput&&st.tool==='text')return;
    e.preventDefault();if(penInput)penClick=true;startInk(e)});
  cv.addEventListener('pointermove',e=>{if(!cur)return;const p=pos(e);
    if(cur.erase){eraseAt(p);return}
    const l=cur.pts[cur.pts.length-1];if(Math.hypot(p.x-l[0],p.y-l[1])<1.5)return;cur.pts.push([p.x,p.y]);cur.el.setAttribute('d',strokePath(cur.pts.map(q=>q.join(',')).join(' ')))});
  const endInk=()=>{if(!cur)return;const c=cur;cur=null;if(c.erase){fit();changed();return}
    if(c.pts.length){pushUndo();pg.ink.push({id:c.id,c:c.c,w:c.w,a:c.a,p:c.pts.map(q=>q.join(',')).join(' ')});c.el.dataset.id=c.id;$('#pgHint',host).hidden=true;fit();changed()}};
  cv.addEventListener('pointerup',endInk);cv.addEventListener('pointercancel',endInk);

  /* ---------- Werkzeugleiste ---------- */
  const drawBar=()=>{$$('[data-tool]',host).forEach(b=>b.classList.toggle('on',b.dataset.tool===st.tool));
    const ink=st.tool==='pen'||st.tool==='mark';
    $('#pgColors',host).hidden=!ink;$('#pgSizes',host).hidden=st.tool!=='pen';$('#pgFmt',host).hidden=st.tool!=='text';
    const cols=st.tool==='mark'?MARK_COLORS:PEN_COLORS,curc=st.tool==='mark'?st.mark:st.pen;
    const extra=!cols.includes(curc);
    $('#pgColors',host).innerHTML=cols.map(c=>`<button type="button" class="pg-sw${c===curc?' on':''}" data-c="${c}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join('')+`<button type="button" class="pg-sw more${extra?' on':''}" id="pgColMore" style="${extra?'background:'+curc:''}" title="Weitere Farben …" aria-label="Weitere Farben"></button>`;
    $('#pgColMore',host).onclick=e=>colorPick(e.currentTarget,curc,c=>{if(!isHex(c))return;if(st.tool==='mark')st.mark=c;else st.pen=c;drawBar()},{title:st.tool==='mark'?'Farbe des Markers':'Farbe des Stifts'});
    $('#pgFgBar',host).style.background=st.fg;$('#pgHlBar',host).style.background=st.hl;
    $('#pgSizes',host).innerHTML=[[2,'Fein'],[3,'Mittel'],[6,'Dick']].map(([v,l])=>`<button type="button" data-sz="${v}" class="${st.size===v?'on':''}" title="${l}"><i style="width:${v+3}px;height:${v+3}px"></i></button>`).join('');
    $$('[data-c]',host).forEach(b=>b.onclick=()=>{if(st.tool==='mark')st.mark=b.dataset.c;else st.pen=b.dataset.c;drawBar()});
    $$('[data-sz]',host).forEach(b=>b.onclick=()=>{st.size=+b.dataset.sz;drawBar()});
    cv.className='pg-canvas bg-'+pg.bg+' tool-'+st.tool};
  $$('[data-tool]',host).forEach(b=>b.onclick=()=>{st.tool=b.dataset.tool;const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))a.blur();select(null);drawBar()});
  $$('[data-cmd]',host).forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const a=document.activeElement;
    if(!a||!a.classList||!a.classList.contains('pg-edit')){toast('Erst in einen Textkasten klicken');return}
    const c=b.dataset.cmd;
    if(c==='h'){const blk=document.queryCommandValue('formatBlock').toLowerCase();document.execCommand('formatBlock',false,blk==='h2'?'div':'h2')}
    else if(c==='check')document.execCommand('insertHTML',false,'<input type="checkbox">&nbsp;');
    else if(c==='hilite'||c==='fore')applyColor(c,c==='fore'?st.fg:st.hl)
    else document.execCommand(c,false,null);
    a.dispatchEvent(new Event('input'))}});
  /* Text- und Markierfarbe: Auswahl merken, damit sie beim Farbwähler nicht verloren geht */
  let savedRange=null;
  const applyColor=(cmd,col)=>{document.execCommand('styleWithCSS',false,true);document.execCommand(cmd==='fore'?'foreColor':'hiliteColor',false,col);document.execCommand('styleWithCSS',false,false)};
  $$('[data-pick]',host).forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();const sl=getSelection();savedRange=sl.rangeCount?sl.getRangeAt(0).cloneRange():null});
    b.onclick=()=>{const k=b.dataset.pick,ed=savedRange&&savedRange.startContainer&&(savedRange.startContainer.nodeType===1?savedRange.startContainer:savedRange.startContainer.parentElement).closest('.pg-edit');
      colorPick(b,k==='fore'?st.fg:st.hl,c=>{if(!isHex(c))return;if(k==='fore')st.fg=c;else st.hl=c;drawBar();
        if(ed&&savedRange){ed.focus();const sl=getSelection();sl.removeAllRanges();sl.addRange(savedRange);applyColor(k,c);ed.dispatchEvent(new Event('input'))}},
        {title:k==='fore'?'Textfarbe':'Markierfarbe',presets:k==='fore'?PEN_COLORS.map(c=>[c,c,c]):MARK_COLORS.map(c=>[c,c,c])})}});
  $('#pgBg',host).onchange=e=>{pushUndo();pg.bg=e.target.value;cv.className='pg-canvas bg-'+pg.bg+' tool-'+st.tool;changed()};
  $('#pgUndo',host).onclick=()=>{if(!st.undo.length)return;st.redo.push(snap());restore(st.undo.pop())};
  $('#pgRedo',host).onclick=()=>{if(!st.redo.length)return;st.undo.push(snap());restore(st.redo.pop())};
  const fileIn=$('#pgFile',host);$('#pgImg',host).onclick=()=>fileIn.click();
  fileIn.onchange=()=>{addImgs([...fileIn.files],{x:sc.scrollLeft+40,y:sc.scrollTop+40});fileIn.value=''};

  /* Einfügen und Ziehen von Bildern auf die Fläche */
  const onPaste=e=>{const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))return;if(!host.isConnected)return;
    const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>/^image\//.test(f.type));
    if(files.length){e.preventDefault();e.stopPropagation();addImgs(files,st.last)}
    else{const t=e.clipboardData&&e.clipboardData.getData('text/plain');if(t&&t.trim()){e.preventDefault();e.stopPropagation();const it=addText(st.last.x+8,st.last.y+14);setTimeout(()=>document.execCommand('insertText',false,t),0)}}};
  host.addEventListener('paste',onPaste,true);
  sc.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();sc.classList.add('drop')}});
  sc.addEventListener('dragleave',()=>sc.classList.remove('drop'));
  sc.addEventListener('drop',e=>{e.preventDefault();sc.classList.remove('drop');const f=[...e.dataTransfer.files];if(f.length)addImgs(f,pos(e))});
  cv.addEventListener('pointerdown',e=>{if(e.target===cv)st.last=pos(e)},true);

  /* Tastatur: Rückgängig und Löschen, wenn gerade kein Text bearbeitet wird */
  host.tabIndex=-1;
  ['pointerdown','keydown','input'].forEach(ev=>host.addEventListener(ev,()=>{window.__pgTouch=Date.now()},true));
  host.addEventListener('keydown',e=>{const a=document.activeElement,editing=a&&a.classList&&a.classList.contains('pg-edit');if(editing)return;
    const k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();$(e.shiftKey?'#pgRedo':'#pgUndo',host).click()}
    else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();$('#pgRedo',host).click()}
    else if((k==='delete'||k==='backspace')&&st.sel){const it=pg.items.find(x=>x.id===st.sel);if(it){e.preventDefault();pushUndo();pg.items=pg.items.filter(x=>x!==it);drawAll();changed();st.sel=null}}});

  drawBar();drawAll();
  const ro=new ResizeObserver(()=>fit());ro.observe(sc);
  return{destroy:()=>{ro.disconnect();host.removeEventListener('paste',onPaste,true)},
    focusText:()=>{st.tool='text';drawBar();const first=pg.items.filter(x=>x.t==='text').sort((a,b)=>a.y-b.y||a.x-b.x)[0];
      if(first){const e=$(`[data-id="${first.id}"] .pg-edit`,cv);if(e){e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const sl=getSelection();sl.removeAllRanges();sl.addRange(r)}}else addText(48,48)},
    flush:()=>{const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))a.blur()}}}

/* Verkleinertes Abbild der Seite für die Karte auf dem Board */
function pageMiniHTML(pg){if(!pg||!(pg.items.length||pg.ink.length))return'<div class="pg-mini empty">Leere Seite</div>';
  let x0=1e9,y0=1e9,x1=0,y1=0;const grow=(a,b,c,d)=>{x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,c);y1=Math.max(y1,d)};
  pg.items.forEach(it=>grow(it.x,it.y,it.x+it.w,it.y+(it.t==='img'?it.w*.75:Math.max(40,htmlToText(it.html).split('\n').length*24+12))));
  pg.ink.forEach(s=>s.p.split(' ').forEach(q=>{const[x,y]=q.split(',').map(Number);grow(x,y,x+1,y+1)}));
  const pad=16;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);const W=Math.max(200,x1-x0+pad),H=Math.max(120,y1-y0+pad);
  const k=Math.min(1,236/W);
  const items=pg.items.map(it=>`<div class="pg-mi" style="left:${it.x-x0}px;top:${it.y-y0}px;width:${it.w}px">${it.t==='img'?`<img src="${it.src}" alt="">`:cleanHTML(it.html).replace(/<input /g,'<input disabled ')}</div>`).join('');
  const ink=`<svg width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}">${pg.ink.map(s=>`<path d="${strokePath(s.p)}" stroke="${s.c}" stroke-width="${s.w}" stroke-opacity="${s.a}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  return`<div class="pg-mini bg-${pg.bg}" style="height:${Math.min(170,Math.round(H*k))}px"><div class="pg-mini-in" style="width:${W}px;height:${H}px;transform:scale(${k.toFixed(4)})">${items}${ink}</div></div>`}
const PG_IC={
  text:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3.5h10M8 3.5v9.5M6 13h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  pen:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M10.8 2.6l2.6 2.6-7.6 7.6-3.3.7.7-3.3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  mark:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M9.5 2.5l4 4-5 5H5.5v-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.5 14h11" stroke="#f5c400" stroke-width="2.5" stroke-linecap="round"/></svg>',
  erase:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 13.5h7.5M2.8 9.6l5.8-5.8a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L7.8 12.6a1.4 1.4 0 0 1-2 0l-3-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  img:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="6.6" r="1.3" fill="currentColor"/><path d="M2.5 12l3.6-3.4 2.4 2.2 2-1.8 3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'};
