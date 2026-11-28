/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Notara · Freie Seite wie in OneNote: Textkästen und Bilder frei platzieren, mit Stift zeichnen.
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
  const items=arr(p.items).filter(x=>x&&(x.t==='text'||x.t==='img'||x.t==='file')).map(x=>{const b={id:okId(x.id)?String(x.id):uid(),t:x.t,x:num(x.x,40,0),y:num(x.y,40,0)};
      if(x.t==='text')return{...b,w:num(x.w,320,80,4000),html:String(x.html||'')};
      if(x.t==='img')return{...b,w:num(x.w,320,30,4000),src:/^data:image\//.test(x.src||'')?String(x.src):''};
      return{...b,w:num(x.w,260,180,600),fid:okId(x.fid)?String(x.fid):'',name:String(x.name||'Datei').slice(0,200),size:num(x.size,0,0,1e9),mime:String(x.mime||'').slice(0,100)}})
    .filter(x=>(x.t!=='img'||x.src)&&(x.t!=='file'||x.fid));
  const ink=arr(p.ink).filter(s=>s&&typeof s.p==='string'&&s.p.length<200000).map(s=>({id:okId(s.id)?String(s.id):uid(),c:/^#[0-9a-f]{6}$/i.test(s.c)?s.c:'#1d1f24',w:num(s.w,3,1,60),a:Math.max(.1,Math.min(1,+s.a||1)),p:s.p}));
  return{bg:PAGE_BG.some(b=>b[0]===p.bg)?p.bg:'plain',items,ink}}
const OK_TAGS=new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','UL','OL','LI','H1','H2','H3','SPAN','A','CODE','PRE','INPUT','MARK','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TH','TD','SUB','SUP','HR']);
const PG_FONTS=[['','Standard'],['Calibri, Carlito, sans-serif','Calibri'],['Arial, Helvetica, sans-serif','Arial'],['"Segoe UI", system-ui, sans-serif','Segoe UI'],['Georgia, serif','Georgia'],['"Times New Roman", Times, serif','Times New Roman'],['Consolas, "Courier New", monospace','Consolas'],['"Segoe Print", "Comic Sans MS", cursive','Handschrift']];
const PG_SIZES=[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72];
const PG_STYLES=[['div','Normal'],['h1','Überschrift 1'],['h2','Überschrift 2'],['h3','Überschrift 3'],['blockquote','Zitat'],['pre','Code']];
const PG_TAGS=[['check','☐','Aufgabe (Strg+1)'],['imp','⭐','Wichtig'],['q','❓','Frage'],['idea','💡','Idee'],['pin','📌','Merken'],['warn','⚠️','Kritisch'],['call','📞','Anrufen'],['date','📅','Termin'],['learn','📚','Lernen'],['ok','✅','Erledigt']];
const okHref=h=>/^(https?:\/\/|mailto:)/i.test(h||'')||/^#doc:[A-Za-z0-9_-]{1,64}$/.test(h||'');
/* Nur harmloses HTML behalten (keine Skripte, Ereignisse, fremde Stile) */
function cleanHTML(html){const t=document.createElement('template');t.innerHTML=String(html||'');
  const walk=node=>{for(const el of[...node.children]){
    if(!OK_TAGS.has(el.tagName)||(el.tagName==='INPUT'&&el.type!=='checkbox')){el.replaceWith(...(el.tagName==='INPUT'?[]:[document.createTextNode(el.textContent)]));continue}
    const keep={};if(el.tagName==='A'&&okHref(el.getAttribute('href')))keep.href=el.getAttribute('href');
    if(el.tagName==='INPUT'){keep.type='checkbox';if(el.hasAttribute('checked')||el.checked)keep.checked=''}
    const bg=el.style&&el.style.backgroundColor,fg=el.style&&el.style.color,ff=el.style&&el.style.fontFamily,fs=el.style&&el.style.fontSize,ta=el.style&&el.style.textAlign,ml=el.style&&el.style.marginLeft;
    for(const a of[...el.attributes])el.removeAttribute(a.name);
    for(const[k,v]of Object.entries(keep))el.setAttribute(k,v);
    if(el.tagName==='A'&&!/^#doc:/.test(keep.href||'')){el.setAttribute('target','_blank');el.setAttribute('rel','noopener')}
    if(bg&&/^(rgb|#)/.test(bg))el.style.backgroundColor=bg;if(fg&&/^(rgb|#)/.test(fg))el.style.color=fg;
    if(ff&&/^[\w\s,"'-]{1,120}$/.test(ff))el.style.fontFamily=ff;if(fs&&/^\d{1,3}(\.\d+)?(pt|px)$/.test(fs))el.style.fontSize=fs;
    if(ta&&/^(left|center|right|justify)$/.test(ta))el.style.textAlign=ta;if(ml&&/^\d{1,3}px$/.test(ml))el.style.marginLeft=ml;
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
    const block=/^(DIV|P|LI|H1|H2|H3|PRE|BLOCKQUOTE|TR)$/.test(tg);if(tg==='TD'||tg==='TH'){if(c.previousElementSibling)line+=' | '}
    if(block&&line.trim())flush();
    if(tg==='LI')line+='- ';else if(/^H[123]$/.test(tg))line+='#'.repeat(+tg[1])+' ';
    walk(c);if(block)flush()}};
  walk(t.content);if(line)flush();return out.map(l=>/^[\s|]+$/.test(l)?'':l).filter((l,i,a)=>l.trim()||(i&&a[i-1].trim())).join('\n').trim()}
function pageText(pg){return pg.items.filter(x=>x.t==='text'||x.t==='file').sort((a,b)=>a.y-b.y||a.x-b.x).map(x=>x.t==='file'?'📎 '+x.name:htmlToText(x.html)).filter(Boolean).join('\n\n')}
function pageFirstImage(pg){const i=pg&&pg.items.find(x=>x.t==='img');return i?i.src:''}

/* ---------- Glatte Linie aus Punkten ---------- */
function strokePath(p){const pts=p.split(' ').map(s=>s.split(',').map(Number));if(!pts.length)return'';
  if(pts.length<3){const[a]=pts,b=pts[pts.length-1];return`M${a[0]} ${a[1]}L${b[0]+.1} ${b[1]+.1}`}
  let d=`M${pts[0][0]} ${pts[0][1]}`;for(let i=1;i<pts.length-1;i++){const m=[(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2];d+=`Q${pts[i][0]} ${pts[i][1]} ${m[0]} ${m[1]}`}
  const l=pts[pts.length-1];return d+`L${l[0]} ${l[1]}`}

/* ---------- Seite bearbeiten ---------- */
/* ---------- Nur mit dem Stift zeichnen (Handballen/Finger ignorieren) ----------
   'auto': sobald auf dem Gerät ein Apple Pencil benutzt wurde, zeichnet nur noch der Stift; Finger verschieben. */
const PENKEY='kanban-notizen-pen',HAS_TOUCH=(navigator.maxTouchPoints||0)>0;
const penMode=()=>{try{return localStorage.getItem(PENKEY)||'auto'}catch(e){return'auto'}};
const penSeen=()=>{try{return localStorage.getItem(PENKEY+'-seen')==='1'}catch(e){return false}};
const penOnly=()=>{const m=penMode();return m==='on'||(m==='auto'&&penSeen())};
function notePen(e){if(e.pointerType==='pen'&&!penSeen()){try{localStorage.setItem(PENKEY+'-seen','1')}catch(x){}document.dispatchEvent(new Event('kn-pen'))}}
function setPenOnly(v){try{localStorage.setItem(PENKEY,v?'on':'off')}catch(e){}toast(v?'Nur der Stift zeichnet. Mit dem Finger verschiebst du.':'Stift und Finger zeichnen.')}
const penOnlyBtn=()=>HAS_TOUCH?`<button type="button" class="pen-only${penOnly()?' on':''}" data-penonly aria-pressed="${penOnly()}" title="Nur mit dem Stift zeichnen, Finger und Handballen werden ignoriert">✍︎<span>Nur Stift</span></button>`:'';
/* Stift auf iPad: Scrollen verhindern, Finger dürfen weiter scrollen */
function stylusNoScroll(el,active){const h=e=>{if(active()&&[...e.changedTouches].some(t=>t.touchType==='stylus'))e.preventDefault()};
  el.addEventListener('touchstart',h,{passive:false});el.addEventListener('touchmove',h,{passive:false})}

function mountPage(host,n,onChange,opt={}){
  if(!n.page)n.page=blankPage();const pg=n.page;
  const st={tool:'text',pen:PEN_COLORS[0],mark:MARK_COLORS[0],fg:'#d64545',hl:'#ffe14d',size:3,sel:null,undo:[],redo:[],last:{x:60,y:60}};
  const rtab=(()=>{try{return localStorage.getItem('kanban-notizen-ribbon')||'start'}catch(e){return'start'}})();
  const B=(attrs,ic,label,title)=>`<button type="button" ${attrs} title="${esc(title||label)}" aria-label="${esc(title||label)}">${ic}${label?`<span>${label}</span>`:''}</button>`;
  host.innerHTML=`<div class="pg-ribbon">
    <div class="pg-tabs" role="tablist">${[['start','Start'],['insert','Einfügen'],['draw','Zeichnen'],['view','Seite']].map(([k,l])=>`<button type="button" role="tab" data-rtab="${k}" class="${k===rtab?'on':''}">${l}</button>`).join('')}
      <span class="spacer"></span><button type="button" id="pgUndo" title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button><button type="button" id="pgRedo" title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button></div>
    <div class="pg-bar" data-rp="start" role="toolbar" aria-label="Start">
      <div class="pg-grp" id="pgFmt">
        <select id="pgFont" title="Schriftart" aria-label="Schriftart">${PG_FONTS.map(([v,l])=>`<option value="${esc(v)}">${l}</option>`).join('')}</select>
        <select id="pgSize" title="Schriftgrösse" aria-label="Schriftgrösse"><option value="">Grösse</option>${PG_SIZES.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div>
      <div class="pg-grp">${B('data-cmd="bold"','<b>F</b>','','Fett (Strg+B)')}${B('data-cmd="italic"','<i>K</i>','','Kursiv (Strg+I)')}${B('data-cmd="underline"','<u>U</u>','','Unterstrichen (Strg+U)')}${B('data-cmd="strikeThrough"','<s>ab</s>','','Durchgestrichen')}
        <span class="pg-split"><button type="button" data-cmd="fore" title="Textfarbe" class="pg-fg"><b>A</b><i id="pgFgBar"></i></button><button type="button" class="pg-more" data-pick="fore" title="Textfarbe wählen" aria-label="Textfarbe wählen">▾</button></span><span class="pg-split"><button type="button" data-cmd="hilite" title="Markieren" class="pg-hl">${PG_IC.mark}<i id="pgHlBar"></i></button><button type="button" class="pg-more" data-pick="hilite" title="Markierfarbe wählen" aria-label="Markierfarbe wählen">▾</button></span>
        ${B('data-cmd="subscript"','x<sub>2</sub>','','Tiefgestellt')}${B('data-cmd="superscript"','x<sup>2</sup>','','Hochgestellt')}${B('data-cmd="clear"',PG_IC.clear,'','Formatierung löschen')}</div>
      <div class="pg-grp">${B('data-cmd="insertUnorderedList"',PG_IC.ul,'','Aufzählung')}${B('data-cmd="insertOrderedList"',PG_IC.ol,'','Nummerierung')}${B('data-cmd="outdent"',PG_IC.outdent,'','Einzug verkleinern')}${B('data-cmd="indent"',PG_IC.indent,'','Einzug vergrössern')}
        ${B('data-cmd="justifyLeft"',PG_IC.al,'','Linksbündig')}${B('data-cmd="justifyCenter"',PG_IC.ac,'','Zentriert')}${B('data-cmd="justifyRight"',PG_IC.ar,'','Rechtsbündig')}</div>
      <div class="pg-grp">${B('data-cmd="check"','☐','','Aufgabe (Strg+1)')}${B('id="pgTagBtn"',PG_IC.tag,'Markierungen','Markierung vor die Zeile setzen')}${opt.onFindTags?B('id="pgTagFind"',PG_IC.tagfind,'','Markierungen suchen'):''}</div>
      <div class="pg-grp"><select id="pgStyle" title="Formatvorlagen" aria-label="Formatvorlagen"><option value="">Formatvorlagen</option>${PG_STYLES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
    </div>
    <div class="pg-bar" data-rp="insert" role="toolbar" aria-label="Einfügen">
      <div class="pg-grp">${B('data-ins="table"',PG_IC.table,'Tabelle')}${B('data-ins="code"',PG_IC.code,'Code','Code-Block für Befehle und Code')}${B('data-ins="link"',PG_IC.link,'Link','Link oder Seitenlink (Strg+K)')}${B('data-ins="date"',PG_IC.date,'Datum','Datum und Uhrzeit einfügen')}</div>
      <div class="pg-grp">${B('id="pgImg"',PG_IC.img,'Bild','Bild einfügen (oder Strg+V / hierher ziehen)')}${TAURI?B('id="pgClip"',PG_IC.clip,'Bildschirmausschnitt','Bildschirmausschnitt aufnehmen und einfügen'):''}${B('id="pgAtt"',PG_IC.att,'Datei','Datei anhängen (PDF, Word, … bis 5 MB)')}${B('id="pgPdf"',PG_IC.pdf,'PDF-Ausdruck','PDF-Seiten als Bilder auf die Seite legen – darauf kannst du schreiben')}${B('id="pgRec"',PG_IC.mic,'Audio','Audio aufnehmen')}</div>
      <div class="pg-grp" id="pgRecBox" hidden></div>
    </div>
    <div class="pg-bar" data-rp="draw" role="toolbar" aria-label="Zeichnen">
      <div class="pg-grp" data-g="tools">${B('data-tool="text"',PG_IC.text,'Eingabe','Text: irgendwo hinklicken und schreiben')}${B('data-tool="pen"',PG_IC.pen,'Stift')}${B('data-tool="mark"',PG_IC.mark,'Marker','Textmarker')}${B('data-tool="erase"',PG_IC.erase,'Radierer','Radierer (Striche löschen)')}</div>
      <div class="pg-grp pg-colors" id="pgColors"></div>
      <div class="pg-grp pg-sizes" id="pgSizes"></div><div class="pg-grp" id="pgPenOnly"></div>
    </div>
    <div class="pg-bar" data-rp="view" role="toolbar" aria-label="Seite">
      <div class="pg-grp"><label class="pg-lbl" for="pgBg">Papier</label><select id="pgBg" title="Papier" aria-label="Papier">${PAGE_BG.map(([k,l])=>`<option value="${k}"${pg.bg===k?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="pg-grp">${B('id="pgPrint"',PG_IC.print,'Drucken / PDF','Seite drucken oder als PDF speichern')}${opt.onPrintSection?B('id="pgPrintSec"',PG_IC.print,'Abschnitt drucken','Alle Seiten des Abschnitts drucken oder als PDF speichern'):''}</div>
      ${opt.onHistory||opt.onSaveTpl?`<div class="pg-grp">${opt.onHistory?B('id="pgHist"',PG_IC.hist,'Seitenversionen','Frühere Versionen der Seite'):''}${opt.onSaveTpl?B('id="pgTpl"',PG_IC.tpl,'Als Vorlage speichern','Diese Seite als Vorlage für neue Seiten speichern'):''}</div>`:''}
    </div>
    <div class="pg-bar pg-ctxbar" id="pgCtxBar" hidden><div class="pg-grp pg-ctx" id="pgCtx"></div></div></div>
    <div class="pg-scroll" id="pgScroll"><div class="pg-canvas bg-${pg.bg}" id="pgCanvas"><svg class="pg-ink" id="pgInk" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="pg-hint" id="pgHint">Irgendwo hinklicken und losschreiben · Bilder mit Strg+V einfügen oder hierher ziehen · Zeichnen unter „Zeichnen“</div></div></div>
    <input type="file" id="pgFile" accept="image/*" multiple hidden><input type="file" id="pgAttIn" multiple hidden><input type="file" id="pgPdfIn" accept="application/pdf,.pdf" hidden>`;
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
    else if(it.t==='file')d.innerHTML=attHTML(it)+`<button type="button" class="pg-del" title="Anhang entfernen" aria-label="Entfernen">✕</button>`;
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
        ()=>{if(moved){fit();changed()}else if(it.t!=='text')select(d)})};
    if(it.t==='file'){const body=$('.att',d);body.addEventListener('pointerdown',e=>{if(e.target.closest('[data-att]'))return;move(e)});
      $$('[data-att]',d).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const k=b.dataset.att;k==='play'?playAttachment(it,b):k==='open'?openAttachment(it):saveAttachment(it)}));
      body.addEventListener('dblclick',()=>openAttachment(it));
      $('.pg-del',d).addEventListener('click',e=>{e.stopPropagation();pushUndo();pg.items=pg.items.filter(x=>x!==it);d.remove();fit();changed()});return}
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
    ed.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();ed.blur();return}
      const sn=selNode(),pre=sn&&sn.closest('pre'),cell=sn&&sn.closest('td,th');
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopPropagation();insLink();return}
      if((e.ctrlKey||e.metaKey)&&e.key==='1'&&!e.altKey){e.preventDefault();e.stopPropagation();toggleTag('check');return}
      if(wordKeys(e,ed,pre,cell))return;
      if(pre&&e.key==='Enter'){e.preventDefault();if(e.ctrlKey||e.shiftKey||e.metaKey)leavePre(pre);else document.execCommand('insertLineBreak');return}
      if(pre&&e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'  ');return}
      if(cell&&e.key==='Tab'){e.preventDefault();const cells=$$('td,th',cell.closest('table'));let i=cells.indexOf(cell)+(e.shiftKey?-1:1);
        if(i>=cells.length){tblOp('row');i=cells.length}const nc=$$('td,th',cell.closest('table'))[Math.max(0,i)];if(nc)caretIn(nc,true);return}});
    ed.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&(e.ctrlKey||e.metaKey)){e.preventDefault();openLink(a.getAttribute('href'))}});
    ed.addEventListener('click',e=>{if(e.target.tagName==='INPUT'){const c=e.target;setTimeout(()=>{c.checked?c.setAttribute('checked',''):c.removeAttribute('checked');it.html=cleanHTML(ed.innerHTML);changed()},0)}});
    ed.addEventListener('paste',e=>{const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>/^image\//.test(f.type));
      e.preventDefault();if(files.length){addImgs(files,{x:it.x,y:it.y+d.offsetHeight+16});return}
      const html=e.clipboardData&&e.clipboardData.getData('text/html'),txt=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
      const inPre=selNode()&&selNode().closest('pre');
      if(html&&!plainPaste&&!inPre){document.execCommand('insertHTML',false,pasteHTML(html))}else document.execCommand('insertText',false,txt);plainPaste=false;inputOf(ed)})}
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
  stylusNoScroll(cv,()=>['pen','mark','erase'].includes(st.tool)&&penOnly());
  cv.addEventListener('pointerdown',e=>{notePen(e);if(e.pointerType==='touch'&&['pen','mark','erase'].includes(st.tool)&&penOnly())return;const penInput=e.pointerType==='pen'&&st.tool==='text'&&(e.target===cv||e.target===svg);
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
    $('#pgColors',host).hidden=!ink;$('#pgSizes',host).hidden=st.tool!=='pen';
    const cols=st.tool==='mark'?MARK_COLORS:PEN_COLORS,curc=st.tool==='mark'?st.mark:st.pen;
    const extra=!cols.includes(curc);
    $('#pgColors',host).innerHTML=cols.map(c=>`<button type="button" class="pg-sw${c===curc?' on':''}" data-c="${c}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join('')+`<button type="button" class="pg-sw more${extra?' on':''}" id="pgColMore" style="${extra?'background:'+curc:''}" title="Weitere Farben …" aria-label="Weitere Farben"></button>`;
    $('#pgColMore',host).onclick=e=>colorPick(e.currentTarget,curc,c=>{if(!isHex(c))return;if(st.tool==='mark')st.mark=c;else st.pen=c;drawBar()},{title:st.tool==='mark'?'Farbe des Markers':'Farbe des Stifts'});
    $('#pgFgBar',host).style.background=st.fg;$('#pgHlBar',host).style.background=st.hl;
    $('#pgSizes',host).innerHTML=[[2,'Fein'],[3,'Mittel'],[6,'Dick']].map(([v,l])=>`<button type="button" data-sz="${v}" class="${st.size===v?'on':''}" title="${l}"><i style="width:${v+3}px;height:${v+3}px"></i></button>`).join('');
    $$('[data-c]',host).forEach(b=>b.onclick=()=>{if(st.tool==='mark')st.mark=b.dataset.c;else st.pen=b.dataset.c;drawBar()});
    $$('[data-sz]',host).forEach(b=>b.onclick=()=>{st.size=+b.dataset.sz;drawBar()});
    const po=$('#pgPenOnly',host);po.hidden=!(HAS_TOUCH&&(ink||st.tool==='erase'));po.innerHTML=penOnlyBtn();
    const pb=$('[data-penonly]',po);if(pb)pb.onclick=()=>{setPenOnly(!penOnly());drawBar()};
    cv.className='pg-canvas bg-'+pg.bg+' tool-'+st.tool+(penOnly()?' pen-only':'')};
  const onPen=()=>{if(host.isConnected)drawBar()};document.addEventListener('kn-pen',onPen);
  $$('[data-tool]',host).forEach(b=>b.onclick=()=>{st.tool=b.dataset.tool;const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))a.blur();select(null);drawBar()});
  $$('[data-cmd]',host).forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const a=document.activeElement;
    if(!a||!a.classList||!a.classList.contains('pg-edit')){toast('Erst in einen Textkasten klicken');return}
    const c=b.dataset.cmd;
    if(c==='clear'){document.execCommand('removeFormat');document.execCommand('formatBlock',false,'div');$$('[style*="font"]',a).forEach(e=>{if(getSelection().containsNode(e,true)){e.style.fontFamily='';e.style.fontSize=''}})}
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
  fileIn.onchange=()=>{const at=freeSpot();addImgs([...fileIn.files],at);fileIn.value='';requestAnimationFrame(()=>{sc.scrollTop=Math.max(0,at.y-80)})};

  /* Einfügen und Ziehen von Bildern auf die Fläche */
  const onPaste=e=>{const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))return;if(!host.isConnected)return;
    const files=[...(e.clipboardData&&e.clipboardData.files||[])];
    if(files.length){e.preventDefault();e.stopPropagation();addFiles(files,st.last)}
    else{const t=e.clipboardData&&e.clipboardData.getData('text/plain');if(t&&t.trim()){e.preventDefault();e.stopPropagation();const it=addText(st.last.x+8,st.last.y+14);setTimeout(()=>document.execCommand('insertText',false,t),0)}}};
  host.addEventListener('paste',onPaste,true);
  sc.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();sc.classList.add('drop')}});
  sc.addEventListener('dragleave',()=>sc.classList.remove('drop'));
  sc.addEventListener('drop',e=>{e.preventDefault();sc.classList.remove('drop');const f=[...e.dataTransfer.files];if(f.length)addFiles(f,pos(e))});
  cv.addEventListener('pointerdown',e=>{if(e.target===cv)st.last=pos(e)},true);

  /* Tastatur: Rückgängig und Löschen, wenn gerade kein Text bearbeitet wird */
  host.tabIndex=-1;
  ['pointerdown','keydown','input'].forEach(ev=>host.addEventListener(ev,()=>{window.__pgTouch=Date.now()},true));
  host.addEventListener('keydown',e=>{const a=document.activeElement,editing=a&&a.classList&&a.classList.contains('pg-edit');if(editing)return;
    const k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();$(e.shiftKey?'#pgRedo':'#pgUndo',host).click()}
    else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();$('#pgRedo',host).click()}
    else if((k==='delete'||k==='backspace')&&st.sel){const it=pg.items.find(x=>x.id===st.sel);if(it){e.preventDefault();pushUndo();pg.items=pg.items.filter(x=>x!==it);drawAll();changed();st.sel=null}}});

  /* ---------- Tabellen, Code-Blöcke, Links ---------- */
  function selNode(){const s=getSelection();if(!s.rangeCount)return null;let n=s.getRangeAt(0).startContainer;if(n.nodeType!==1)n=n.parentElement;return n&&n.closest('.pg-edit')?n:null}
  function caretIn(el,select){const r=document.createRange();r.selectNodeContents(el);if(!select)r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)}
  /* Aktiven Textkasten holen oder einen neuen anlegen */
  function activeEdit(){const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit')&&cv.contains(a))return a;
    const it=addText(Math.max(48,st.last.x+8),Math.max(48,st.last.y+14));const d=$(`[data-id="${it.id}"] .pg-edit`,cv);return d}
  const inputOf=ed=>ed&&ed.dispatchEvent(new Event('input'));
  function insTable(){const ed=activeEdit();if(!ed)return;st.tool='text';drawBar();
    const row=n=>'<tr>'+'<td><br></td>'.repeat(n)+'</tr>';
    document.execCommand('insertHTML',false,`<table data-new="1"><tbody>${row(3).repeat(3)}</tbody></table><div><br></div>`);
    const t=$('table[data-new]',ed);if(t){t.removeAttribute('data-new');caretIn(t.querySelector('td'),true)}inputOf(ed);ctx()}
  function insCode(){const ed=activeEdit();if(!ed)return;const s=getSelection(),txt=s.rangeCount&&!s.isCollapsed?s.toString():'';
    document.execCommand('insertHTML',false,`<pre data-new="1"><code>${txt?esc(txt).replace(/\n/g,'<br>'):'<br>'}</code></pre><div><br></div>`);
    const p=$('pre[data-new]',ed);if(p){p.removeAttribute('data-new');caretIn(p.querySelector('code')||p,false)}inputOf(ed);ctx()}
  function leavePre(pre){let nx=pre.nextElementSibling;if(!nx){nx=document.createElement('div');nx.innerHTML='<br>';pre.after(nx)}caretIn(nx,false);inputOf(pre.closest('.pg-edit'));ctx()}
  async function insLink(){const ed0=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('pg-edit')?document.activeElement:null;
    const sl=getSelection(),range=ed0&&sl.rangeCount?sl.getRangeAt(0).cloneRange():null,txt=range?range.toString():'';
    const pages=typeof docLinkTargets==='function'?docLinkTargets():[];
    const r=await ask({title:'Link einfügen',fields:[{name:'url',label:'Web-Adresse',placeholder:'https://…'},
      ...(pages.length?[{name:'pid',label:'oder Seite aus einem Notizbuch',type:'select',options:[['','–'],...pages]}]:[]),
      {name:'text',label:'Angezeigter Text',value:txt,placeholder:'leer = Adresse bzw. Seitentitel'}],ok:'Einfügen'});
    if(!r)return;let href='',label=r.text.trim();
    if(r.pid){href='#doc:'+r.pid;if(!label)label=(pages.find(p=>p[0]===r.pid)||['',''])[1].replace(/^.* › /,'')}
    else{let u=r.url.trim();if(!u){toast('Bitte eine Adresse eingeben oder eine Seite wählen');return}if(!/^(https?:|mailto:)/i.test(u))u=(/@/.test(u)&&!/\//.test(u)?'mailto:':'https://')+u;href=u;if(!label)label=u}
    let ed=ed0;if(!ed||!ed.isConnected)ed=activeEdit();else{ed.focus();if(range){sl.removeAllRanges();sl.addRange(range)}}
    document.execCommand('insertHTML',false,`<a href="${esc(href)}">${esc(label)}</a>&nbsp;`);inputOf(ed)}
  function tblOp(op){const n=selNode(),cell=n&&n.closest('td,th');if(!cell)return;const tr=cell.parentElement,tb=cell.closest('table'),i=cell.cellIndex,ed=tb.closest('.pg-edit');
    if(op==='row'){const nr=document.createElement('tr');for(let k=0;k<tr.cells.length;k++){const c=document.createElement('td');c.innerHTML='<br>';nr.appendChild(c)}tr.after(nr);caretIn(nr.cells[Math.min(i,nr.cells.length-1)],true)}
    else if(op==='col'){[...tb.rows].forEach(r=>{const c=document.createElement(r.cells[i]&&r.cells[i].tagName==='TH'?'th':'td');c.innerHTML='<br>';(r.cells[i]||r.lastElementChild).after(c)});caretIn(tr.cells[i+1],true)}
    else if(op==='delrow'){if(tb.rows.length<=1){tb.remove()}else{const nx=tr.nextElementSibling||tr.previousElementSibling;tr.remove();if(nx)caretIn(nx.cells[Math.min(i,nx.cells.length-1)],true)}}
    else if(op==='delcol'){if(tr.cells.length<=1){tb.remove()}else{[...tb.rows].forEach(r=>r.cells[i]&&r.cells[i].remove());caretIn(tr.cells[Math.min(i,tr.cells.length-1)],true)}}
    else if(op==='head'){const first=tb.rows[0];[...first.cells].forEach(c=>{const n2=document.createElement(c.tagName==='TH'?'td':'th');n2.innerHTML=c.innerHTML;c.replaceWith(n2)})}
    else if(op==='del')tb.remove();
    inputOf(ed);ctx()}
  /* Kontextleiste: je nachdem, wo der Cursor steht (Tabelle, Code, Link) */
  function ctx(){const g=$('#pgCtx',host);if(!g)return;const n=selNode();let h='';
    if(n){const cell=n.closest('td,th'),pre=n.closest('pre'),a=n.closest('a');
      if(cell)h+=`<span class="pg-ctx-l">Tabelle</span><button type="button" data-tb="row" title="Zeile darunter einfügen">+ Zeile</button><button type="button" data-tb="col" title="Spalte rechts einfügen">+ Spalte</button><button type="button" data-tb="delrow" title="Zeile löschen">− Zeile</button><button type="button" data-tb="delcol" title="Spalte löschen">− Spalte</button><button type="button" data-tb="head" title="Erste Zeile als Kopfzeile ein/aus">Kopfzeile</button><button type="button" data-tb="del" title="Tabelle löschen">🗑</button>`;
      if(pre)h+=`<span class="pg-ctx-l">Code</span><button type="button" data-cx="copy" title="Code in die Zwischenablage kopieren">⧉ Kopieren</button><button type="button" data-cx="leave" title="Unter dem Code weiterschreiben (Strg+Enter)">↵ Verlassen</button>`;
      if(a)h+=`<span class="pg-ctx-l">Link</span><button type="button" data-cx="open" title="Link öffnen (Strg+Klick)">↗ Öffnen</button><button type="button" data-cx="unlink" title="Link entfernen">Entfernen</button>`}
    syncFmt(n);const bar=$('#pgCtxBar',host);if(bar)bar.hidden=!h;if(g.innerHTML!==h)g.innerHTML=h;if(!h)return;
    $$('[data-tb]',g).forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>tblOp(b.dataset.tb)});
    $$('[data-cx]',g).forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{const n2=selNode();if(!n2)return;const k=b.dataset.cx;
      if(k==='copy'){const t=n2.closest('pre').innerText.replace(/\n$/,'');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Code kopiert'),()=>toast('Kopieren nicht möglich'))}
      else if(k==='leave')leavePre(n2.closest('pre'));
      else if(k==='open')openLink(n2.closest('a').getAttribute('href'));
      else if(k==='unlink'){const a=n2.closest('a'),ed=a.closest('.pg-edit');a.replaceWith(...a.childNodes);inputOf(ed);ctx()}}})}
  let lastRange=null;const onSel=()=>{if(!host.isConnected)return;const n2=selNode();if(n2&&cv.contains(n2)){const s2=getSelection();if(s2.rangeCount)lastRange=s2.getRangeAt(0).cloneRange()}ctx()};document.addEventListener('selectionchange',onSel);
  $$('[data-ins]',host).forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const k=b.dataset.ins;if(k==='table')insTable();else if(k==='code')insCode();else insLink()}});
  /* ---------- Dateien anhängen ---------- */
  async function addFiles(files,at){let any=false;
    for(const f of files){if(/^image\//.test(f.type)){await addImgs([f],at);at={x:at.x+24,y:at.y+24};continue}
      const fid=await storeAttachment(f);if(!fid)continue;if(!any)pushUndo();any=true;
      const it={id:uid(),t:'file',x:Math.max(0,at.x),y:Math.max(0,at.y),w:260,fid,name:f.name||'Datei',size:f.size,mime:f.type||''};pg.items.push(it);cv.appendChild(itemEl(it));at={x:at.x+24,y:at.y+70}}
    if(any){$('#pgHint',host).hidden=true;fit();changed()}}
  /* Freie Stelle unter dem bisherigen Inhalt */
  const freeSpot=()=>{let y=24;$$('.pg-item',cv).forEach(e=>{y=Math.max(y,e.offsetTop+e.offsetHeight+20)});return{x:48,y}};
  const attIn=$('#pgAttIn',host);$('#pgAtt',host).onclick=()=>attIn.click();
  attIn.onchange=()=>{const at=freeSpot();addFiles([...attIn.files],at);attIn.value='';requestAnimationFrame(()=>{sc.scrollTop=Math.max(0,at.y-80)})};

  /* ---------- Word-Funktionen im Textkasten ---------- */
  let plainPaste=false;
  const blockOf=(n2,ed)=>{let b=n2;while(b&&b!==ed&&!/^(DIV|P|LI|H1|H2|H3|BLOCKQUOTE|TD|TH|PRE)$/.test(b.tagName))b=b.parentElement;return b||ed};
  const textBefore=(blk)=>{const s2=getSelection();if(!s2.rangeCount)return'';const r=document.createRange();r.setStart(blk,0);r.setEnd(s2.anchorNode,s2.anchorOffset);return r.toString()};
  /* die letzten n Zeichen vor dem Cursor markieren (nur innerhalb eines Textknotens) */
  const selBack=n=>{const s2=getSelection(),an=s2.anchorNode,o=s2.anchorOffset;if(!an||an.nodeType!==3||o<n)return false;const r=document.createRange();r.setStart(an,o-n);r.setEnd(an,o);s2.removeAllRanges();s2.addRange(r);return true};
  const AUTOCORR=[['->','→'],['<-','←'],['=>','⇒'],['<=>','⇔'],['(c)','©'],['(r)','®'],['(tm)','™'],['...','…'],['--','–'],[':-)','🙂'],[':)','🙂'],['<3','❤️']];
  function wordKeys(e,ed,pre,cell){const mod=e.ctrlKey||e.metaKey,k=e.key,kl=k.toLowerCase();
    const stop=()=>{e.preventDefault();e.stopPropagation();return true},cmd=(c,v)=>{document.execCommand(c,false,v);inputOf(ed);ctx();return stop()};
    if(mod&&e.shiftKey&&kl==='v'){plainPaste=true;return false}
    if(mod&&!e.altKey){
      if(e.shiftKey&&kl==='f')return cmd('bold');if(e.shiftKey&&kl==='k')return cmd('italic');if(e.shiftKey&&kl==='u')return cmd('underline');
      if(!e.shiftKey&&kl==='e')return cmd('justifyCenter');if(!e.shiftKey&&kl==='l')return cmd('justifyLeft');if(!e.shiftKey&&kl==='r')return cmd('justifyRight');if(!e.shiftKey&&kl==='j')return cmd('justifyFull');
      if(e.shiftKey&&kl==='l')return cmd('insertUnorderedList');if(e.shiftKey&&(kl==='n'))return cmd('insertOrderedList');
      if(k==='>'||(e.shiftKey&&k==='.')||k===']'){stepSize(1);return stop()}if(k==='<'||(e.shiftKey&&k===',')||k==='['){stepSize(-1);return stop()}
      if(k===' '){document.execCommand('removeFormat');inputOf(ed);return stop()}
      if(k==='='||k==='+')return cmd(e.shiftKey||k==='+'?'superscript':'subscript');
      if(k==='m')return cmd(e.shiftKey?'outdent':'indent')}
    if(mod&&e.altKey&&/^[0-3]$/.test(k))return cmd('formatBlock',k==='0'?'div':'h'+k);
    if(pre||mod||e.altKey)return false;
    const n2=selNode();if(!n2)return false;const blk=blockOf(n2,ed),li=n2.closest('li');
    /* Tab: in Listen einrücken, sonst Tabulator */
    if(k==='Tab'&&!cell){if(li)return cmd(e.shiftKey?'outdent':'indent');if(e.shiftKey)return cmd('outdent');document.execCommand('insertText',false,'    ');inputOf(ed);return stop()}
    const s2=getSelection();if(!s2.isCollapsed)return false;
    /* Leertaste: Aufzählung, Nummerierung, Aufgabe, Überschrift, Zitat, Code wie in Word; AutoKorrektur */
    if(k===' '&&!cell){const tb=textBefore(blk).replace(/ /g,' ');
      const auto=[[/^[-*•]$/,()=>document.execCommand('insertUnorderedList')],[/^(1|a)[.)]$/i,()=>document.execCommand('insertOrderedList')],[/^\[ ?\]$/,()=>document.execCommand('insertHTML',false,'<input type="checkbox">&nbsp;')],
        [/^#{1,3}$/,m=>document.execCommand('formatBlock',false,'h'+m.length)],[/^>$/,()=>document.execCommand('formatBlock',false,'blockquote')]];
      if(!li)for(const[re,fn]of auto){if(re.test(tb)&&selBack(tb.length)){document.execCommand('delete');fn(tb);inputOf(ed);ctx();return stop()}}
      for(const[a,b2]of AUTOCORR){if(tb.endsWith(a)&&(a!=='--'||/\S--$/.test(tb))&&selBack(a.length)){document.execCommand('insertText',false,b2);break}}
      return false}
    /* Enter: --- wird zur Linie, ``` zum Code-Block */
    if(k==='Enter'&&!e.shiftKey&&!cell){const tb=textBefore(blk).trim();
      if(/^(---|___|\*\*\*)$/.test(tb)&&selBack(textBefore(blk).length)){document.execCommand('delete');document.execCommand('insertHTML',false,'<hr><div><br></div>');inputOf(ed);return stop()}
      if(tb==='```'&&selBack(textBefore(blk).length)){document.execCommand('delete');insCode();return stop()}}
    return false}
  /* Mini-Symbolleiste über markiertem Text, wie in Word */
  if(getComputedStyle(host).position==='static')host.style.position='relative';
  const mini=document.createElement('div');mini.className='pg-minibar';mini.hidden=true;
  mini.innerHTML=`<button type="button" data-mb="smaller" title="Schrift kleiner (Strg+<)">A<sup>−</sup></button><button type="button" data-mb="bigger" title="Schrift grösser (Strg+>)">A<sup>+</sup></button><i class="sep"></i>
    <button type="button" data-mb="bold" title="Fett"><b>F</b></button><button type="button" data-mb="italic" title="Kursiv"><i>K</i></button><button type="button" data-mb="underline" title="Unterstrichen"><u>U</u></button>
    <button type="button" data-mb="fore" title="Textfarbe"><b class="mb-fg">A</b></button><button type="button" data-mb="hilite" title="Markieren">${PG_IC.mark}</button><i class="sep"></i>
    <button type="button" data-mb="insertUnorderedList" title="Aufzählung">${PG_IC.ul}</button><button type="button" data-mb="link" title="Link (Strg+K)">${PG_IC.link}</button><button type="button" data-mb="clear" title="Formatierung löschen">${PG_IC.clear}</button>`;
  host.appendChild(mini);
  $$('[data-mb]',mini).forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const k=b.dataset.mb,n2=selNode();if(!n2)return;const ed=n2.closest('.pg-edit');
    if(k==='bigger'||k==='smaller')stepSize(k==='bigger'?1:-1);else if(k==='fore'||k==='hilite')applyColor(k,k==='fore'?st.fg:st.hl);
    else if(k==='link'){insLink();mini.hidden=true;return}else if(k==='clear')document.execCommand('removeFormat');else document.execCommand(k);inputOf(ed);placeMini()}});
  function placeMini(){const s2=getSelection(),n2=selNode();if(!n2||s2.isCollapsed||!s2.rangeCount||!cv.contains(n2)){mini.hidden=true;return}
    const r=s2.getRangeAt(0).getBoundingClientRect(),h=host.getBoundingClientRect();if(!r.width&&!r.height){mini.hidden=true;return}
    mini.hidden=false;$('.mb-fg',mini).style.borderBottomColor=st.fg;const w=mini.offsetWidth;
    mini.style.left=Math.max(4,Math.min(h.width-w-4,r.left-h.left+r.width/2-w/2))+'px';const top=r.top-h.top-mini.offsetHeight-8;mini.style.top=(top<($('.pg-ribbon',host).offsetHeight)?r.bottom-h.top+8:top)+'px'}
  let mt=0;const onMini=()=>{clearTimeout(mt);mt=setTimeout(placeMini,120)};
  host.addEventListener('mouseup',onMini);host.addEventListener('keyup',e=>{if(e.shiftKey||e.key==='Shift')onMini();else mini.hidden=true});
  sc.addEventListener('scroll',()=>{mini.hidden=true});
  document.addEventListener('selectionchange',()=>{if(host.isConnected&&getSelection().isCollapsed)mini.hidden=true});

  /* ---------- Menüband: Reiter ---------- */
  const rib=$('.pg-ribbon',host);
  const showTab=t=>{rib.dataset.tab=t;$$('[data-rtab]',host).forEach(b=>b.classList.toggle('on',b.dataset.rtab===t));try{localStorage.setItem('kanban-notizen-ribbon',t)}catch(e){}
    if(t==='draw'){if(st.tool==='text'){st.tool='pen';drawBar()}}else if(st.tool!=='text'){st.tool='text';select(null);drawBar()}};
  $$('[data-rtab]',host).forEach(b=>b.onclick=()=>showTab(b.dataset.rtab));
  showTab(rtab==='draw'?'start':rtab);

  /* ---------- Schriftart, Grösse, Formatvorlagen (Auswahl merken, weil das Auswahlfeld den Fokus nimmt) ---------- */
  let fmtRange=null;const keepSel=()=>{const s2=getSelection();const n2=selNode();fmtRange=n2&&s2.rangeCount?s2.getRangeAt(0).cloneRange():null};
  const backSel=()=>{if(!fmtRange&&lastRange&&lastRange.startContainer.isConnected)fmtRange=lastRange;if(!fmtRange)return null;const ed=(fmtRange.startContainer.nodeType===1?fmtRange.startContainer:fmtRange.startContainer.parentElement).closest('.pg-edit');if(!ed)return null;ed.focus();const s2=getSelection();s2.removeAllRanges();s2.addRange(fmtRange);return ed};
  ['pgFont','pgSize','pgStyle'].forEach(id=>{const el=$('#'+id,host);el.addEventListener('pointerdown',keepSel);el.addEventListener('focus',()=>{if(!fmtRange)keepSel()})});
  $('#pgFont',host).onchange=e=>{const ed=backSel();if(!ed){toast('Erst Text auswählen oder in einen Textkasten klicken');return}
    document.execCommand('styleWithCSS',false,true);document.execCommand('fontName',false,e.target.value||PG_FONTS[0][0]);document.execCommand('styleWithCSS',false,false);inputOf(ed);fmtRange=null};
  function applySize(v,ed){document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');
    $$('font[size="7"]',ed).forEach(f=>{const sp=document.createElement('span');sp.style.fontSize=v+'pt';sp.append(...f.childNodes);f.replaceWith(sp)});
    $$('span',ed).forEach(x=>{if(/xxx-large/.test(x.style.fontSize))x.style.fontSize=v+'pt'});inputOf(ed)}
  function stepSize(k){const n2=selNode();if(!n2)return;const ed=n2.closest('.pg-edit'),pt=Math.round(parseFloat(getComputedStyle(n2).fontSize)*.75);
    const v=k>0?PG_SIZES.find(x=>x>pt)||PG_SIZES[PG_SIZES.length-1]:[...PG_SIZES].reverse().find(x=>x<pt)||PG_SIZES[0];applySize(v,ed);ctx()}
  $('#pgSize',host).onchange=e=>{const v=e.target.value,ed=backSel();if(!v||!ed){if(!ed)toast('Erst Text auswählen oder in einen Textkasten klicken');return}
    applySize(v,ed);fmtRange=null};
  $('#pgStyle',host).onchange=e=>{const v=e.target.value;e.target.value='';const ed=backSel();if(!v)return;if(!ed){toast('Erst in einen Textkasten klicken');return}
    if(v==='pre'){insCode()}else document.execCommand('formatBlock',false,v);inputOf(ed);fmtRange=null};
  /* Auswahlfelder zeigen Schrift und Grösse an der Cursorposition */
  function syncFmt(n2){const f=$('#pgFont',host),z=$('#pgSize',host);if(!f||document.activeElement===f||document.activeElement===z)return;
    if(!n2){f.value=PG_FONTS[0][0];z.value='';return}const cs=getComputedStyle(n2),fam=(cs.fontFamily.split(',')[0]||'').replace(/["']/g,'').trim().toLowerCase();
    const m=PG_FONTS.find(([v])=>v&&v.split(',')[0].replace(/["']/g,'').trim().toLowerCase()===fam);f.value=m?m[0]:PG_FONTS[0][0];
    const pt=Math.round(parseFloat(cs.fontSize)*.75);z.value=PG_SIZES.includes(pt)?String(pt):''}

  /* ---------- Markierungen (Tags) wie in OneNote ---------- */
  function lineBlock(){const n2=selNode();if(!n2)return null;const ed=n2.closest('.pg-edit');let b=n2;while(b&&b!==ed&&!/^(DIV|P|LI|H1|H2|H3|BLOCKQUOTE|TD|TH)$/.test(b.tagName))b=b.parentElement;
    if(!b||b===ed){/* Text direkt im Kasten: in einen Absatz packen */document.execCommand('formatBlock',false,'div');const n3=selNode();b=n3&&n3.closest('div:not(.pg-edit),p,li,h1,h2,h3,blockquote,td,th')}return b}
  function toggleTag(key){const ed=activeEdit();if(!ed)return;const b=lineBlock();if(!b)return;
    if(key==='check'){const cb=b.querySelector(':scope > input[type=checkbox]');if(cb){cb.remove();if(b.firstChild&&b.firstChild.nodeType===3)b.firstChild.nodeValue=b.firstChild.nodeValue.replace(/^ /,'')}else b.insertAdjacentHTML('afterbegin','<input type="checkbox">&nbsp;');inputOf(ed);return}
    const t=PG_TAGS.find(x=>x[0]===key);if(!t)return;const txt=b.textContent,cur=PG_TAGS.find(x=>x[0]!=='check'&&txt.startsWith(x[1]));
    const strip=()=>{const w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let tn;while((tn=w.nextNode())){if(tn.nodeValue.trim()){const re=new RegExp('^\\s*'+cur[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s?');tn.nodeValue=tn.nodeValue.replace(re,'');break}}};
    if(cur)strip();if(!cur||cur[0]!==key){const tn=document.createTextNode(t[1]+' ');const cb=b.querySelector(':scope > input[type=checkbox]');cb?cb.after(tn):b.prepend(tn)}
    inputOf(ed)}
  $('#pgTagBtn',host).addEventListener('pointerdown',e=>{e.preventDefault();keepSel()});
  $('#pgTagBtn',host).onclick=e=>{const[x,y]=menuAt(e.currentTarget);showMenu(x,y,[{cap:'Markierung vor die Zeile'},...PG_TAGS.map(([k,i,l])=>({t:`${k==='check'?'☐':i}  ${l}`,run:()=>{backSel();toggleTag(k)}}))])};
  const tf=$('#pgTagFind',host);if(tf)tf.onclick=()=>opt.onFindTags();

  /* ---------- Einfügen: Datum, PDF-Ausdruck, Bildschirmausschnitt, Audio ---------- */
  $('[data-ins="date"]',host).onclick=()=>{const ed=activeEdit();if(!ed)return;const d=new Date();document.execCommand('insertText',false,d.toLocaleDateString('de-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+', '+d.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}));inputOf(ed)};
  const pdfIn=$('#pgPdfIn',host);$('#pgPdf',host).onclick=()=>pdfIn.click();
  pdfIn.onchange=()=>{const f=pdfIn.files[0];pdfIn.value='';if(f)insertPdf(f)};
  async function insertPdf(f){const btn=$('#pgPdf',host);btn.disabled=true;const old=btn.innerHTML;btn.innerHTML=`${PG_IC.pdf}<span>Lese PDF …</span>`;
    try{await loadVendor('pdf');const lib=window.pdfjsLib;lib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.js';
      const doc=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false,disableFontFace:false}).promise;
      const N=Math.min(doc.numPages,40);if(doc.numPages>40)toast(`Nur die ersten 40 von ${doc.numPages} Seiten werden eingefügt`);
      let at=freeSpot();pushUndo();
      if(f.size<=ATT_MAX){const fid=await storeAttachment(f);if(fid){const it={id:uid(),t:'file',x:at.x,y:at.y,w:260,fid,name:f.name||'Dokument.pdf',size:f.size,mime:'application/pdf'};pg.items.push(it);cv.appendChild(itemEl(it));at={x:at.x,y:at.y+76}}}
      const W=isPhone()?Math.max(300,sc.clientWidth-60):780;
      for(let i=1;i<=N;i++){btn.innerHTML=`${PG_IC.pdf}<span>Seite ${i}/${N} …</span>`;const p2=await doc.getPage(i),vp0=p2.getViewport({scale:1}),k=Math.min(2,1500/vp0.width),vp=p2.getViewport({scale:k});
        const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);
        await p2.render({canvasContext:cx,viewport:vp}).promise;const src=c.toDataURL('image/jpeg',.8);
        const it={id:uid(),t:'img',x:at.x,y:at.y,w:W,src};pg.items.push(it);cv.appendChild(itemEl(it));at={x:at.x,y:at.y+Math.round(W*c.height/c.width)+16}}
      $('#pgHint',host).hidden=true;fit();changed();toast(`${N} PDF-Seite${N===1?'':'n'} eingefügt – unter „Zeichnen“ kannst du darauf schreiben`)}
    catch(e){console.warn(e);toast('PDF konnte nicht gelesen werden')}
    finally{btn.disabled=false;btn.innerHTML=old}}
  const clipBtn=$('#pgClip',host);if(clipBtn)clipBtn.onclick=async()=>{
    const sig=async()=>{try{const it=(await navigator.clipboard.read()).find(x=>x.types.some(t=>t.startsWith('image/')));if(!it)return'';const bl=await it.getType(it.types.find(t=>t.startsWith('image/')));return bl.size+':'+bl.type}catch(e){return'?'}};
    const before=await sig();try{await TAURI.core.invoke('screen_clip')}catch(e){toast('Ausschnitt-Werkzeug konnte nicht gestartet werden');return}
    toast('Bereich auswählen – das Bild kommt danach automatisch auf die Seite');const t0=Date.now();
    const poll=async()=>{if(!host.isConnected||Date.now()-t0>90000)return;if(document.hasFocus()){
        try{const items=await navigator.clipboard.read(),it=items.find(x=>x.types.some(t=>t.startsWith('image/')));
          if(it){const ty=it.types.find(t=>t.startsWith('image/')),bl=await it.getType(ty);if(bl.size+':'+bl.type!==before){await addImgs([new File([bl],'Ausschnitt.png',{type:ty})],freeSpot());return}}}
        catch(e){if(Date.now()-t0>3000){toast('Bild ist in der Zwischenablage – mit Strg+V einfügen');return}}}
      setTimeout(poll,700)};setTimeout(poll,1200)};
  let rec=null;$('#pgRec',host).onclick=async()=>{if(rec)return;
    if(!navigator.mediaDevices||!window.MediaRecorder){toast('Audio-Aufnahme wird hier nicht unterstützt');return}
    let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast('Kein Zugriff auf das Mikrofon');return}
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
    const mr=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000}),chunks=[],t0=Date.now(),box=$('#pgRecBox',host);let cancel=false,iv=0;
    rec={mr,stop:c=>{cancel=!!c;if(mr.state!=='inactive')mr.stop()}};
    mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    mr.onstop=async()=>{clearInterval(iv);stream.getTracks().forEach(t=>t.stop());box.hidden=true;box.innerHTML='';rec=null;if(cancel||!chunks.length)return;
      const type=(mr.mimeType||mime||'audio/webm').split(';')[0],ext=type.includes('mp4')?'m4a':'webm',d=new Date();
      const f=new File(chunks,`Aufnahme ${d.toLocaleDateString('de-CH')} ${d.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}).replace(':','.')}.${ext}`,{type});addFiles([f],freeSpot())};
    box.hidden=false;const tick=()=>{const s2=Math.floor((Date.now()-t0)/1000);box.innerHTML=`<span class="pg-rec">● ${String(Math.floor(s2/60)).padStart(2,'0')}:${String(s2%60).padStart(2,'0')}</span><button type="button" data-rs="stop">■ Stopp</button><button type="button" data-rs="x">Abbrechen</button>`;
      $('[data-rs=stop]',box).onclick=()=>rec&&rec.stop();$('[data-rs=x]',box).onclick=()=>rec&&rec.stop(true);if(s2>=20*60&&rec)rec.stop()};
    tick();iv=setInterval(tick,1000);mr.start(1000)};

  /* ---------- Seite: Drucken, Versionen, Vorlage ---------- */
  $('#pgPrint',host).onclick=()=>{flushEdit();printPages([{title:opt.title?opt.title():n.title||'',page:pg,date:opt.date?opt.date():''}])};
  const ps=$('#pgPrintSec',host);if(ps)ps.onclick=()=>{flushEdit();opt.onPrintSection()};
  const ph=$('#pgHist',host);if(ph)ph.onclick=()=>{flushEdit();opt.onHistory()};
  const pt=$('#pgTpl',host);if(pt)pt.onclick=()=>{flushEdit();opt.onSaveTpl()};
  function flushEdit(){const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))a.blur()}

  drawBar();drawAll();
  const ro=new ResizeObserver(()=>fit());ro.observe(sc);
  return{destroy:()=>{ro.disconnect();host.removeEventListener('paste',onPaste,true);document.removeEventListener('selectionchange',onSel);if(rec)rec.stop(true)},
    focusText:()=>{st.tool='text';drawBar();const first=pg.items.filter(x=>x.t==='text').sort((a,b)=>a.y-b.y||a.x-b.x)[0];
      if(first){const e=$(`[data-id="${first.id}"] .pg-edit`,cv);if(e){e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const sl=getSelection();sl.removeAllRanges();sl.addRange(r)}}else addText(48,48)},
    flush:()=>{const a=document.activeElement;if(a&&a.classList&&a.classList.contains('pg-edit'))a.blur()}}}

/* Verkleinertes Abbild der Seite für die Karte auf dem Board */
function pageMiniHTML(pg){if(!pg||!(pg.items.length||pg.ink.length))return'<div class="pg-mini empty">Leere Seite</div>';
  let x0=1e9,y0=1e9,x1=0,y1=0;const grow=(a,b,c,d)=>{x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,c);y1=Math.max(y1,d)};
  pg.items.forEach(it=>grow(it.x,it.y,it.x+it.w,it.y+(it.t==='img'?it.w*.75:it.t==='file'?56:Math.max(40,htmlToText(it.html).split('\n').length*24+12))));
  pg.ink.forEach(s=>s.p.split(' ').forEach(q=>{const[x,y]=q.split(',').map(Number);grow(x,y,x+1,y+1)}));
  const pad=16;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);const W=Math.max(200,x1-x0+pad),H=Math.max(120,y1-y0+pad);
  const k=Math.min(1,236/W);
  const items=pg.items.map(it=>`<div class="pg-mi" style="left:${it.x-x0}px;top:${it.y-y0}px;width:${it.w}px">${it.t==='img'?`<img src="${it.src}" alt="">`:it.t==='file'?`<div class="att mini">📎 ${esc(it.name)}</div>`:cleanHTML(it.html).replace(/<input /g,'<input disabled ')}</div>`).join('');
  const ink=`<svg width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}">${pg.ink.map(s=>`<path d="${strokePath(s.p)}" stroke="${s.c}" stroke-width="${s.w}" stroke-opacity="${s.a}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  return`<div class="pg-mini bg-${pg.bg}" style="height:${Math.min(170,Math.round(H*k))}px"><div class="pg-mini-in" style="width:${W}px;height:${H}px;transform:scale(${k.toFixed(4)})">${items}${ink}</div></div>`}
const PG_IC={
  clear:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 3.5h8M8 3.5L6 12.5M3 13.5l10-10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  ul:'<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="4" r="1.2" fill="currentColor"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="3" cy="12" r="1.2" fill="currentColor"/><path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  ol:'<svg width="16" height="16" viewBox="0 0 16 16"><text x="1" y="5.5" font-size="5" fill="currentColor" font-family="sans-serif">1</text><text x="1" y="9.5" font-size="5" fill="currentColor" font-family="sans-serif">2</text><text x="1" y="13.5" font-size="5" fill="currentColor" font-family="sans-serif">3</text><path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  outdent:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 3h12M7 6.5h7M7 9.5h7M2 13h12M4.5 6L2 8l2.5 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  indent:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 3h12M7 6.5h7M7 9.5h7M2 13h12M2 6l2.5 2L2 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  al:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  ac:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 3h12M4 6.5h8M2 10h12M4 13.5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  ar:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 3h12M6 6.5h8M2 10h12M6 13.5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  tag:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1.8" y="2.8" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 6.3l1.5 1.5 2.6-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 7.5l1.1 2.2 2.4.3-1.8 1.6.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="#f5b400"/></svg>',
  tagfind:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1.8" y="2.3" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="10.5" cy="10.5" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12.7 12.7L15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  date:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  clip:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 5V2.5h2.5M11.5 2.5H14V5M14 11v2.5h-2.5M4.5 13.5H2V11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5.5 6.5h5v3h-5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.5 1.2"/></svg>',
  pdf:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 1.8h5.2L12.5 5v9.2H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 1.8V5h3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><text x="4.6" y="12" font-size="4.2" font-weight="700" fill="#d64545" font-family="sans-serif">PDF</text></svg>',
  mic:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="5.5" y="1.8" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  print:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4.5 6V2h7v4M4.5 11.5H2.5V6h11v5.5h-2M4.5 9.5h7v4.5h-7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  hist:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.8h2.8M8 5v3.2l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tpl:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 5.5h12M6 5.5V14" stroke="currentColor" stroke-width="1.3"/></svg>',
  table:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.2h12M2 9.8h12M6.2 2.5v11M9.8 2.5v11" stroke="currentColor" stroke-width="1.1"/></svg>',
  code:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6.8 9.2l2.4-2.4M6 5.5l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7L9.7 9.2M10 10.5l-1.3 1.3a2.6 2.6 0 0 1-3.7-3.7L6.3 6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  att:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M10.5 4.5l-5 5a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a3 3 0 0 0-4.2-4.2L3.6 7.6a4.3 4.3 0 0 0 6.1 6.1l3.8-3.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  text:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3.5h10M8 3.5v9.5M6 13h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  pen:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M10.8 2.6l2.6 2.6-7.6 7.6-3.3.7.7-3.3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  mark:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M9.5 2.5l4 4-5 5H5.5v-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.5 14h11" stroke="#f5c400" stroke-width="2.5" stroke-linecap="round"/></svg>',
  erase:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 13.5h7.5M2.8 9.6l5.8-5.8a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L7.8 12.6a1.4 1.4 0 0 1-2 0l-3-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  img:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="6.6" r="1.3" fill="currentColor"/><path d="M2.5 12l3.6-3.4 2.4 2.2 2-1.8 3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'};

/* ---------- Anhänge (PDF, Word, …): in DB.files, auf Seiten als Kärtchen ---------- */
const ATT_MAX=5*1024*1024,ATT_EXEC=/\.(exe|msi|bat|cmd|com|scr|ps1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|reg|cpl|jar)$/i;
const fmtSize=b=>b<1024?b+' B':b<1048576?Math.round(b/1024)+' KB':(b/1048576).toFixed(1).replace('.',',')+' MB';
const attExt=n=>((String(n).match(/\.([a-z0-9]{1,5})$/i)||[])[1]||'').toUpperCase();
const attColor=x=>({PDF:'#d64545',DOC:'#2f5bd3',DOCX:'#2f5bd3',XLS:'#1e9e5a',XLSX:'#1e9e5a',CSV:'#1e9e5a',PPT:'#e6862a',PPTX:'#e6862a',ZIP:'#8a4fd6',TXT:'#646b76',MD:'#646b76'})[x]||'#646b76';
function attHTML(it){const f=DB.files&&DB.files[it.fid],x=attExt(it.name);
  return`<div class="att${f?'':' missing'}" title="${esc(it.name)}${f?'':' – wird noch synchronisiert'}"><span class="att-ic" style="--c:${attColor(x)}">${esc(x||'DATEI')}</span><span class="att-t"><b>${esc(it.name)}</b><small>${fmtSize(it.size)}${f?'':' · nicht verfügbar'}</small></span><span class="att-b">${/^audio\//.test(it.mime)&&f?'<button type="button" data-att="play" title="Abspielen">▶</button>':''}<button type="button" data-att="open" title="Öffnen">↗</button><button type="button" data-att="save" title="Speichern unter …">↓</button></span></div>`}
const readDataURL=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});
async function storeAttachment(f){if(f.size>ATT_MAX){toast(`„${f.name}“ ist zu gross (max. 5 MB)`);return null}
  try{const u=await readDataURL(f),fid=uid();DB.files[fid]={name:String(f.name||'Datei').slice(0,200),mime:String(f.type||'').slice(0,100),size:f.size,data:u.slice(u.indexOf(',')+1),created:now()};return fid}
  catch(e){toast('Datei konnte nicht gelesen werden');return null}}
function attBytes(it){const f=DB.files&&DB.files[it.fid];if(!f){toast('Diese Datei ist auf diesem Gerät noch nicht da. Bitte kurz synchronisieren.');return null}
  return Uint8Array.from(atob(f.data),c=>c.charCodeAt(0))}
const hexOf=s=>[...new TextEncoder().encode(s)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function saveAttachment(it){const b=attBytes(it);if(!b)return;
  if(TAURI&&TAURI.dialog){const p=await TAURI.dialog.save({defaultPath:it.name});if(!p)return;
    try{await TAURI.core.invoke('write_bin_file',b,{headers:{'x-path':hexOf(p)}});toast('Gespeichert: '+p)}catch(e){toast('Speichern fehlgeschlagen: '+e)}return}
  const blob=new Blob([b],{type:it.mime||'application/octet-stream'});
  if(IOS&&navigator.canShare){try{const f=new File([blob],it.name,{type:blob.type});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:it.name});return}}catch(e){if(e&&e.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=it.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
async function openAttachment(it){const b=attBytes(it);if(!b)return;
  if(TAURI){if(ATT_EXEC.test(it.name)){toast('Programme werden aus Sicherheitsgründen nicht geöffnet – bitte speichern');saveAttachment(it);return}
    try{await TAURI.core.invoke('open_file',b,{headers:{'x-name':hexOf(it.name)}})}catch(e){toast('Öffnen fehlgeschlagen: '+e)}return}
  if(/^(application\/pdf|image\/|text\/plain)/.test(it.mime)&&!IOS){const u=URL.createObjectURL(new Blob([b],{type:it.mime}));window.open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000);return}
  saveAttachment(it)}
/* Links aus Seiten öffnen: #doc:ID → Notizbuch-Seite, sonst im Browser */
function openLink(href){if(!href)return;const m=/^#doc:([A-Za-z0-9_-]+)$/.exec(href);
  if(m){if(typeof openDocPage==='function'&&openDocPage(m[1]))return;toast('Diese Seite gibt es nicht mehr');return}
  if(!/^(https?:|mailto:)/i.test(href))return;
  if(TAURI){TAURI.core.invoke('open_url',{url:href}).catch(e=>toast('Öffnen fehlgeschlagen: '+e));return}
  window.open(href,'_blank','noopener')}

/* Audio-Anhang direkt abspielen */
let attAudio=null;
function playAttachment(it,btn){if(attAudio&&attAudio.it===it.id){attAudio.a.pause();URL.revokeObjectURL(attAudio.u);attAudio=null;btn.textContent='▶';return}
  if(attAudio){attAudio.a.pause();URL.revokeObjectURL(attAudio.u);if(attAudio.btn)attAudio.btn.textContent='▶';attAudio=null}
  const b=attBytes(it);if(!b)return;const u=URL.createObjectURL(new Blob([b],{type:it.mime})),a=new Audio(u);attAudio={a,u,it:it.id,btn};btn.textContent='❚❚';
  a.onended=()=>{btn.textContent='▶';URL.revokeObjectURL(u);attAudio=null};a.play().catch(()=>{toast('Abspielen nicht möglich');btn.textContent='▶';attAudio=null})}

/* ---------- Seiten drucken / als PDF speichern ---------- */
function pageBox(pg){let W=200,H=80;
  for(const it of pg.items){W=Math.max(W,it.x+it.w);H=Math.max(H,it.y+(it.t==='img'?it.w*1.42:it.t==='file'?60:Math.max(30,htmlToText(it.html).split('\n').length*26+20)))}
  for(const s of pg.ink)for(const q of s.p.split(' ')){const[x,y]=q.split(',').map(Number);W=Math.max(W,x+10);H=Math.max(H,y+10)}return{W,H}}
function printPageHTML(x){const pg=x.page,{W,H}=pageBox(pg),k=Math.min(1,700/W);
  const items=pg.items.map(it=>`<div class="pp-it" style="left:${it.x}px;top:${it.y}px;width:${it.w}px">${it.t==='img'?`<img src="${it.src}" alt="">`:it.t==='file'?`<div class="pp-att">📎 ${esc(it.name)} <small>(${fmtSize(it.size)})</small></div>`:`<div class="pg-edit">${cleanHTML(it.html)}</div>`}</div>`).join('');
  const ink=`<svg class="pp-ink" width="${W}" height="${H}">${pg.ink.map(s=>`<path d="${strokePath(s.p)}" stroke="${s.c}" stroke-width="${s.w}" stroke-opacity="${s.a}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  return`<section class="pp"><h1>${esc(x.title||'Ohne Titel')}</h1>${x.date?`<div class="pmeta">${esc(x.date)}</div>`:''}<div class="pp-wrap" style="height:${Math.ceil(H*k)+10}px"><div class="pp-can" style="width:${W}px;height:${H}px;transform:scale(${k.toFixed(4)})">${items}${ink}</div></div></section>`}
function printPages(list){doPrint(list.map(printPageHTML).join(''))}

/* HTML aus der Zwischenablage (z. B. aus Word oder dem Web) bereinigen: Formatierung behalten, Ballast entfernen */
function pasteHTML(html){html=String(html).replace(/<!--[\s\S]*?-->/g,'');const t=document.createElement('template');t.innerHTML=html;
  t.content.querySelectorAll('style,script,meta,link,title,xml,head,noscript,iframe,object,svg,img,video,audio,canvas,button,select,textarea,form').forEach(x=>x.remove());
  t.content.querySelectorAll('*').forEach(el=>{const tn=el.tagName;
    if(/^O:P$/i.test(tn)){el.replaceWith(document.createTextNode(el.textContent||''));return}
    if(tn==='FONT'){const sp=document.createElement('span');if(el.getAttribute('color'))sp.style.color=el.getAttribute('color');if(el.getAttribute('face'))sp.style.fontFamily=el.getAttribute('face');sp.append(...el.childNodes);el.replaceWith(sp);return}
    if(/^(P|DIV)$/.test(tn)&&/MsoList/.test(el.className||''))el.style.marginLeft='24px';
    if(tn==='H4'||tn==='H5'||tn==='H6'){const h=document.createElement('h3');h.append(...el.childNodes);el.replaceWith(h)}
    if(el.style&&/bold|[6-9]00/.test(el.style.fontWeight||'')&&tn==='SPAN'){const b=document.createElement('b');b.append(...el.childNodes);el.append(b)}
    if(el.style&&el.style.fontStyle==='italic'&&tn==='SPAN'){const i=document.createElement('i');i.append(...el.childNodes);el.append(i)}});
  return cleanHTML(t.innerHTML).replace(/(<p>(\s|&nbsp;)*<\/p>\s*){2,}/g,'<p><br></p>')}
