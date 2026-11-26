/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Notara · Whiteboard pro Kategorie (Ordner): unendliche Fläche zum Zeichnen mit Stift, Finger oder Maus,
   dazu Haftnotizen, Text, Formen und Pfeile, Sticker und Bilder. Zwei Finger verschieben und zoomen.
   Daten: DB.boards[folderId]={updated,bg,items:[…],ink:[{id,c,w,a,p}]} – alle Koordinaten in Weltpunkten.
   Ansicht (Verschiebung/Zoom) wird pro Gerät gemerkt, nicht synchronisiert. */
'use strict';
const WB_BG=[['dots','Punkte'],['grid','Kariert'],['plain','Blanko'],['lines','Liniert']];
const WB_STICKY=['#fff1a8','#ffd8a8','#ffc9d9','#c9f2d8','#cfe6ff','#e3d6ff','#ececec'];
const WB_SHAPES=[['rect','Rechteck'],['ellipse','Kreis'],['diamond','Raute'],['line','Linie'],['arrow','Pfeil']];
const WB_TEXT_SIZES=[[16,'S'],[24,'M'],[36,'L'],[56,'XL']];
const WB_STICKERS=['⭐','✅','❌','❗','❓','💡','🔥','❤️','👍','👎','📌','📍','🎯','🚀','📅','⏰','⚠️','✏️','📚','📝','🧠','💬','🎉','🏆','💯','🏁','😀','😎','🤔','😅','🙌','👀','➡️','⬅️','⬆️','⬇️','🔁','🟢','🟡','🔴'];
const WB_KINDS=['sticky','text','img','sticker','shape'];
const WB_KEYS={v:'select',h:'hand',p:'pen',m:'mark',e:'erase',t:'text',s:'sticky',r:'shape'};
const blankBoard=()=>({updated:'',bg:'dots',items:[],ink:[]});

/* ---------- Normalisieren ---------- */
function normBoard(b){b=b&&typeof b==='object'?b:{};
  const hx=(c,d)=>isHex(c)?c:d,W=v=>num(v,0,-1e6,1e6);
  const items=arr(b.items).filter(x=>x&&WB_KINDS.includes(x.t)).map(x=>{const o={id:okId(x.id)?String(x.id):uid(),t:x.t,x:W(x.x),y:W(x.y)};
    if(x.t==='sticky'){o.w=num(x.w,200,60,3000);o.h=num(x.h,200,40,3000);o.c=hx(x.c,WB_STICKY[0]);o.html=String(x.html||'')}
    else if(x.t==='text'){o.w=num(x.w,280,40,6000);o.c=hx(x.c,'');o.fs=num(x.fs,24,8,200);o.html=String(x.html||'')}
    else if(x.t==='img'){o.w=num(x.w,320,20,8000);o.src=/^data:image\//.test(x.src||'')?String(x.src):''}
    else if(x.t==='sticker'){o.w=num(x.w,96,16,2000);o.e=String(x.e||'⭐').slice(0,16)}
    else{o.k=WB_SHAPES.some(s=>s[0]===x.k)?x.k:'rect';o.w=num(x.w,160,-1e5,1e5);o.h=num(x.h,100,-1e5,1e5);o.c=hx(x.c,'#1d1f24');o.f=hx(x.f,'');o.sw=num(x.sw,3,1,60)}
    return o}).filter(x=>x.t!=='img'||x.src);
  const ink=arr(b.ink).filter(s=>s&&typeof s.p==='string'&&s.p&&s.p.length<400000).map(s=>({id:okId(s.id)?String(s.id):uid(),c:hx(s.c,'#1d1f24'),w:Math.max(.3,Math.min(120,+s.w||3)),a:Math.max(.1,Math.min(1,+s.a||1)),p:s.p}));
  return{updated:isNaN(Date.parse(b.updated))?'':String(b.updated),bg:WB_BG.some(x=>x[0]===b.bg)?b.bg:'dots',items,ink}}
function normBoards(o,fids){const out={};if(o&&typeof o==='object')for(const[k,v]of Object.entries(o))if(fids.has(k))out[k]=normBoard(v);return out}
const wbCount=fid=>{const b=DB.boards&&DB.boards[fid];return b?b.items.length+b.ink.length:0};

/* ---------- Öffnen ---------- */
let wbCtl=null;
const WBVKEY='kanban-notizen-wb-view';
const wbViews=(()=>{try{return JSON.parse(localStorage.getItem(WBVKEY)||'{}')||{}}catch(e){return{}}})();
const wbSaveView=()=>{try{localStorage.setItem(WBVKEY,JSON.stringify(wbViews))}catch(e){}};
const wbPrefs={tool:'select',size:4,shape:'rect',col:{pen:PEN_COLORS[0],mark:MARK_COLORS[0],shape:'#2f5bd3',sticky:WB_STICKY[0],text:'#1d1f24'}};
function openWB(fid){if(!folderById(fid))return;DB.ui.wb=fid;expandTo(fid);setView('wb')}
function renderWB(el){const fid=DB.ui.wb;
  if(!folderById(fid)){if(!tv.loaded){el.innerHTML='<div class="empty" style="padding:40px">Lade …</div>';return}DB.ui.view='board';render();return}
  if(wbCtl){wbCtl.destroy();wbCtl=null}
  if(!DB.boards[fid])DB.boards[fid]=blankBoard();
  wbCtl=mountWB(el,fid)}

/* ---------- Form als SVG ---------- */
function wbShapeSVG(it,W,H){const s=it.sw,h=s/2,c=it.c,f=it.f||'transparent';let g='';
  const st=`stroke="${c}" stroke-width="${s}" stroke-linejoin="round" stroke-linecap="round"`;
  if(it.k==='rect')g=`<rect x="${h}" y="${h}" width="${Math.max(0,W-s)}" height="${Math.max(0,H-s)}" rx="10" fill="${f}" ${st}/>`;
  else if(it.k==='ellipse')g=`<ellipse cx="${W/2}" cy="${H/2}" rx="${Math.max(0,W/2-h)}" ry="${Math.max(0,H/2-h)}" fill="${f}" ${st}/>`;
  else if(it.k==='diamond')g=`<polygon points="${W/2},${h} ${W-h},${H/2} ${W/2},${H-h} ${h},${H/2}" fill="${f}" ${st}/>`;
  else{const sx=it.w<0?W:0,sy=it.h<0?H:0,ex=it.w<0?0:W,ey=it.h<0?0:H;
    g=`<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="transparent" stroke-width="${s+18}" stroke-linecap="round"/><line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" ${st}/>`;
    if(it.k==='arrow'){const a=Math.atan2(ey-sy,ex-sx),L=10+s*2.6,p=d=>`${(ex-L*Math.cos(a+d)).toFixed(1)},${(ey-L*Math.sin(a+d)).toFixed(1)}`;
      g+=`<polygon points="${ex},${ey} ${p(.42)} ${p(-.42)}" fill="${c}" ${st}/>`}}
  return`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" aria-hidden="true">${g}</svg>`}

/* ---------- Whiteboard einbauen ---------- */
function mountWB(host,fid){
  const b=DB.boards[fid],P=wbPrefs,v=wbViews[fid]||(wbViews[fid]={x:60,y:60,z:1});
  const st={sel:null,undo:[],redo:[],space:false};
  const tb=(t,ic,l,k)=>`<button type="button" data-wt="${t}" title="${l} (${k})" aria-label="${l}">${ic}<span>${l}</span></button>`;
  host.innerHTML=`<div class="wb" id="wb" tabindex="-1">
    <div class="pg-bar wb-bar" role="toolbar" aria-label="Whiteboard">
      <div class="pg-grp">${tb('select',WB_IC.select,'Auswählen','V')}${tb('hand',WB_IC.hand,'Verschieben','H')}${tb('pen',PG_IC.pen,'Stift','P')}${tb('mark',PG_IC.mark,'Marker','M')}${tb('erase',PG_IC.erase,'Radierer','E')}</div>
      <div class="pg-grp">${tb('text',PG_IC.text,'Text','T')}${tb('sticky',WB_IC.sticky,'Haftnotiz','S')}${tb('shape',WB_IC.shape,'Form','R')}
        <button type="button" id="wbStk" title="Sticker" aria-label="Sticker">${WB_IC.sticker}<span>Sticker</span></button><button type="button" id="wbImg" title="Bild einfügen (oder Strg+V / hierher ziehen)" aria-label="Bild">${PG_IC.img}<span>Bild</span></button></div>
      <div class="pg-grp" id="wbOpts"></div>
      <div class="pg-grp"><select id="wbBg" title="Hintergrund" aria-label="Hintergrund">${WB_BG.map(([k,l])=>`<option value="${k}"${b.bg===k?' selected':''}>${l}</option>`).join('')}</select>
        <button type="button" id="wbUndo" title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button><button type="button" id="wbRedo" title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button></div>
      <div class="pg-grp"><button type="button" id="wbZo" title="Verkleinern" aria-label="Verkleinern">−</button><button type="button" id="wbZr" class="wb-zv" title="Auf 100 % setzen">100 %</button><button type="button" id="wbZi" title="Vergrössern" aria-label="Vergrössern">+</button><button type="button" id="wbFit" title="Alles zeigen">${WB_IC.fit}<span>Alles</span></button></div>
    </div>
    <div class="wb-stage" id="wbStage">
      <div class="wb-world" id="wbWorld"><div class="wb-items" id="wbItems"></div><svg class="wb-ink" id="wbInk" width="1" height="1" overflow="visible" xmlns="http://www.w3.org/2000/svg"></svg></div>
      <div class="wb-hint" id="wbHint"><b>Whiteboard</b><br>Mit Stift, Finger oder Maus zeichnen · Haftnotizen, Text, Formen, Sticker und Bilder oben in der Leiste<br>Zwei Finger verschieben und zoomen · am PC Mausrad und Strg + Mausrad</div>
      <div class="wb-selbar" id="wbSel" hidden></div>
    </div>
    <input type="file" id="wbFile" accept="image/*" multiple hidden></div>`;
  const wb=$('#wb',host),stage=$('#wbStage',host),world=$('#wbWorld',host),itemsEl=$('#wbItems',host),svg=$('#wbInk',host),selBar=$('#wbSel',host);
  let vt=0,ct=0,alive=true;

  /* ---------- Speichern und Rückgängig ---------- */
  const changed=()=>{b.updated=now();clearTimeout(ct);ct=setTimeout(()=>{ct=0;save();renderSide()},300);hint()};
  const snap=()=>({bg:b.bg,items:b.items.map(x=>({...x})),ink:b.ink.slice()});
  const pushSnap=s=>{st.undo.push(s);if(st.undo.length>50)st.undo.shift();st.redo=[]};
  const pushUndo=()=>pushSnap(snap());
  const restore=s=>{b.bg=s.bg;b.items=s.items;b.ink=s.ink;$('#wbBg',host).value=b.bg;st.sel=null;drawAll();applyView();changed()};
  const undo=()=>{if(!st.undo.length)return;st.redo.push(snap());restore(st.undo.pop())};
  const redo=()=>{if(!st.redo.length)return;st.undo.push(snap());restore(st.redo.pop())};

  /* ---------- Ansicht: verschieben und zoomen ---------- */
  const R=()=>stage.getBoundingClientRect();
  const toW=(cx,cy)=>{const r=R();return{x:(cx-r.left-v.x)/v.z,y:(cy-r.top-v.y)/v.z}};
  const center=()=>{const r=R();return toW(r.left+r.width/2,r.top+r.height/2)};
  const applyView=()=>{world.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`;
    const g=(b.bg==='dots'?22:b.bg==='lines'?32:24)*v.z;stage.className='wb-stage bg-'+b.bg+' t-'+P.tool+(st.space?' panning':'');
    stage.style.backgroundSize=`${g}px ${g}px`;stage.style.backgroundPosition=`${v.x}px ${v.y}px`;stage.style.setProperty('--iz',(1/v.z).toFixed(4));
    $('#wbZr',host).textContent=Math.round(v.z*100)+' %';posSel();clearTimeout(vt);vt=setTimeout(wbSaveView,400)};
  const zoomAt=(cx,cy,nz)=>{const r=R();nz=Math.max(.1,Math.min(5,nz));const wx=(cx-r.left-v.x)/v.z,wy=(cy-r.top-v.y)/v.z;
    v.z=nz;v.x=cx-r.left-wx*nz;v.y=cy-r.top-wy*nz;applyView()};
  const zoomBy=k=>{const r=R();zoomAt(r.left+r.width/2,r.top+r.height/2,v.z*k)};
  const bbox=()=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const g=(a,c,d,e)=>{x0=Math.min(x0,a);y0=Math.min(y0,c);x1=Math.max(x1,d);y1=Math.max(y1,e)};
    for(const it of b.items){const d=elOf(it.id);if(it.t==='shape')g(Math.min(it.x,it.x+it.w),Math.min(it.y,it.y+it.h),Math.max(it.x,it.x+it.w),Math.max(it.y,it.y+it.h));
      else g(it.x,it.y,it.x+it.w,it.y+(d?d.offsetHeight:it.h||it.w))}
    for(const s of b.ink)for(const q of s.p.split(' ')){const[x,y]=q.split(',').map(Number);g(x,y,x,y)}
    return x1<x0?null:{x0,y0,x1,y1}};
  const fitAll=()=>{const bb=bbox(),r=R();if(!bb){v.x=60;v.y=60;v.z=1;applyView();return}
    const W=Math.max(40,bb.x1-bb.x0),H=Math.max(40,bb.y1-bb.y0);v.z=Math.max(.1,Math.min(1.5,Math.min((r.width-80)/W,(r.height-80)/H)));
    v.x=(r.width-W*v.z)/2-bb.x0*v.z;v.y=(r.height-H*v.z)/2-bb.y0*v.z;applyView()};

  /* ---------- Elemente zeichnen ---------- */
  const elOf=id=>itemsEl.querySelector(`[data-id="${id}"]`);
  const cur=()=>st.sel?b.items.find(x=>x.id===st.sel):null;
  const addHandles=(d,it)=>{$$('.wb-h',d).forEach(h=>h.remove());
    if(it.t==='shape'&&(it.k==='line'||it.k==='arrow')){const W=Math.abs(it.w),H=Math.abs(it.h);
      d.insertAdjacentHTML('beforeend',`<div class="wb-h pt" data-h="s" style="left:${it.w<0?W:0}px;top:${it.h<0?H:0}px"></div><div class="wb-h pt" data-h="e" style="left:${it.w<0?0:W}px;top:${it.h<0?0:H}px"></div>`)}
    else d.insertAdjacentHTML('beforeend','<div class="wb-h" data-h="e"></div>')};
  const place=(d,it)=>{
    if(it.t==='shape'){const W=Math.max(1,Math.abs(it.w)),H=Math.max(1,Math.abs(it.h));
      d.style.left=Math.min(it.x,it.x+it.w)+'px';d.style.top=Math.min(it.y,it.y+it.h)+'px';d.style.width=W+'px';d.style.height=H+'px';
      d.innerHTML=wbShapeSVG(it,W,H);if(st.sel===it.id)addHandles(d,it);return}
    d.style.left=it.x+'px';d.style.top=it.y+'px';d.style.width=it.w+'px';
    if(it.t==='sticky')d.style.minHeight=it.h+'px';
    if(it.t==='sticker'){d.style.height=it.w+'px';d.style.fontSize=Math.round(it.w*.8)+'px'}};
  const itemEl=it=>{const d=document.createElement('div');d.className='wb-it wb-'+it.t+(st.sel===it.id?' sel':'');d.dataset.id=it.id;
    if(it.t==='sticky'){d.style.background=it.c;d.innerHTML=`<div class="wb-tx">${cleanHTML(it.html)}</div>`}
    else if(it.t==='text')d.innerHTML=`<div class="wb-tx" style="font-size:${it.fs}px${it.c?';color:'+it.c:''}">${cleanHTML(it.html)}</div>`;
    else if(it.t==='img')d.innerHTML=`<img src="${it.src}" alt="" draggable="false">`;
    else if(it.t==='sticker')d.innerHTML=`<span>${esc(it.e)}</span>`;
    place(d,it);if(st.sel===it.id&&it.t!=='shape')addHandles(d,it);return d};
  const refresh=it=>{const o=elOf(it.id);if(o)o.replaceWith(itemEl(it))};
  const inkPath=s=>`<path data-id="${s.id}" d="${strokePath(s.p)}" stroke="${s.c}" stroke-width="${s.w}" stroke-opacity="${s.a}" fill="none" stroke-linecap="round" stroke-linejoin="round"${s.a<1?' class="mk"':''}/>`;
  const drawInk=()=>{svg.innerHTML=b.ink.map(inkPath).join('')};
  const hint=()=>{$('#wbHint',host).hidden=!!(b.items.length||b.ink.length)};
  const drawAll=()=>{itemsEl.innerHTML='';const f=document.createDocumentFragment();b.items.forEach(it=>f.appendChild(itemEl(it)));itemsEl.appendChild(f);drawInk();hint();drawSelBar()};

  /* ---------- Auswahl ---------- */
  const select=id=>{if(st.sel===id&&id){drawSelBar();return}
    $$('.wb-it.sel',itemsEl).forEach(x=>{x.classList.remove('sel');$$('.wb-h',x).forEach(h=>h.remove())});
    st.sel=id||null;const it=cur();if(it){const d=elOf(it.id);if(d){d.classList.add('sel');addHandles(d,it)}}drawSelBar()};
  const sw=(c,on,a)=>`<button type="button" class="pg-sw${on?' on':''}" ${a}="${c}" style="background:${c}" aria-label="Farbe ${c}"></button>`;
  function drawSelBar(){const it=cur();if(!it){selBar.hidden=true;return}let h='';
    const more=(on,c)=>`<button type="button" class="pg-sw more${on?' on':''}" data-sm style="${on?'background:'+c:''}" title="Weitere Farben …" aria-label="Weitere Farben"></button>`;
    if(it.t==='sticky')h+=WB_STICKY.map(c=>sw(c,c===it.c,'data-sc')).join('')+more(!WB_STICKY.includes(it.c),it.c);
    if(it.t==='text'){const c=it.c||'#1d1f24';h+=PEN_COLORS.map(x=>sw(x,x===c,'data-sc')).join('')+more(!PEN_COLORS.includes(c),c)+'<i class="sep"></i>'+WB_TEXT_SIZES.map(([s,l])=>`<button type="button" data-fs="${s}" class="${it.fs===s?'on':''}" title="Schriftgrösse ${l}">${l}</button>`).join('')}
    if(it.t==='shape'){h+=PEN_COLORS.map(x=>sw(x,x===it.c,'data-sc')).join('')+more(!PEN_COLORS.includes(it.c),it.c);
      if(it.k!=='line'&&it.k!=='arrow')h+=`<button type="button" data-fill title="Füllung" aria-label="Füllung"><i class="wb-fill" style="background:${it.f||'transparent'}"></i></button>`;
      h+='<i class="sep"></i>'+[[2,'Fein'],[4,'Mittel'],[8,'Dick']].map(([s,l])=>`<button type="button" data-sw="${s}" class="${it.sw===s?'on':''}" title="${l}"><i class="wb-dot" style="width:${s+3}px;height:${s+3}px"></i></button>`).join('')}
    if(h)h+='<i class="sep"></i>';
    if(it.t==='text'||it.t==='sticky')h+=`<button type="button" data-a="edit" title="Bearbeiten (Enter)">✎</button>`;
    if(it.t==='img')h+=`<button type="button" data-a="view" title="Gross anzeigen">⤢</button>`;
    h+=`<button type="button" data-a="dup" title="Duplizieren (Strg+D)">⧉</button><button type="button" data-a="front" title="Nach vorne">⤒</button><button type="button" data-a="back" title="Nach hinten">⤓</button><button type="button" data-a="del" class="danger" title="Löschen (Entf)">🗑</button>`;
    selBar.innerHTML=h;selBar.hidden=false;
    const setC=c=>{if(!isHex(c))return;pushUndo();it.c=c;refresh(it);changed();drawSelBar()};
    $$('[data-sc]',selBar).forEach(x=>x.onclick=()=>setC(x.dataset.sc));
    $$('[data-sm]',selBar).forEach(x=>x.onclick=()=>colorPick(x,it.c||'#1d1f24',setC,{title:it.t==='sticky'?'Farbe der Haftnotiz':it.t==='text'?'Textfarbe':'Farbe der Form'}));
    $$('[data-fs]',selBar).forEach(x=>x.onclick=()=>{pushUndo();it.fs=+x.dataset.fs;refresh(it);changed();drawSelBar()});
    $$('[data-sw]',selBar).forEach(x=>x.onclick=()=>{pushUndo();it.sw=+x.dataset.sw;refresh(it);changed();drawSelBar()});
    $$('[data-fill]',selBar).forEach(x=>x.onclick=()=>colorPick(x,it.f,c=>{pushUndo();it.f=isHex(c)?c:'';refresh(it);changed();drawSelBar()},{title:'Füllung',none:'Keine Füllung',noneValue:''}));
    $$('[data-a]',selBar).forEach(x=>x.onclick=()=>{const a=x.dataset.a;
      if(a==='edit')edit(it);else if(a==='view')lightbox(it.src);else if(a==='dup')dup();else if(a==='del')delSel();
      else{pushUndo();b.items=b.items.filter(y=>y!==it);if(a==='front')b.items.push(it);else b.items.unshift(it);const d=elOf(it.id);if(d){a==='front'?itemsEl.appendChild(d):itemsEl.prepend(d)}changed()}});
    posSel()}
  function posSel(){const it=cur();if(!it||selBar.hidden)return;const d=elOf(it.id);if(!d)return;
    const r=R(),q=d.getBoundingClientRect(),bw=selBar.offsetWidth,bh=selBar.offsetHeight;
    let x=q.left-r.left+q.width/2-bw/2,y=q.top-r.top-bh-14;if(y<6)y=q.bottom-r.top+14;
    x=Math.max(6,Math.min(r.width-bw-6,x));y=Math.max(6,Math.min(r.height-bh-6,y));selBar.style.left=x+'px';selBar.style.top=y+'px'}
  const delSel=()=>{const it=cur();if(!it)return;pushUndo();b.items=b.items.filter(x=>x!==it);const d=elOf(it.id);if(d)d.remove();select(null);changed()};
  const dup=()=>{const it=cur();if(!it)return;pushUndo();const c={...it,id:uid(),x:it.x+24,y:it.y+24};b.items.push(c);itemsEl.appendChild(itemEl(c));select(c.id);changed()};

  /* ---------- Text bearbeiten (Haftnotiz und Text) ---------- */
  const isEditing=()=>{const a=document.activeElement;return!!(a&&a.classList&&a.classList.contains('wb-tx')&&a.isContentEditable&&host.contains(a))};
  function edit(it){const d=elOf(it.id);if(!d)return;select(it.id);const tx=$('.wb-tx',d);if(!tx)return;
    const s0=snap(),h0=it.html;tx.contentEditable='true';tx.spellcheck=true;d.classList.add('editing');tx.focus({preventScroll:true});
    const rg=document.createRange();rg.selectNodeContents(tx);rg.collapse(false);const sl=getSelection();sl.removeAllRanges();sl.addRange(rg);
    let t=0;const inp=()=>{window.__pgTouch=Date.now();clearTimeout(t);t=setTimeout(()=>{it.html=cleanHTML(tx.innerHTML);changed()},350);posSel()};
    const pst=e=>{e.preventDefault();const txt=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';document.execCommand('insertText',false,txt)};
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();tx.blur()}};
    const end=()=>{clearTimeout(t);tx.removeEventListener('input',inp);tx.removeEventListener('blur',end);tx.removeEventListener('paste',pst);tx.removeEventListener('keydown',key);
      tx.contentEditable='false';d.classList.remove('editing');const html=cleanHTML(tx.innerHTML);
      if(it.t==='text'&&!tx.textContent.trim()){b.items=b.items.filter(x=>x!==it);d.remove();if(st.sel===it.id)select(null);changed();return}
      it.html=html;if(html!==h0){pushSnap(s0);changed()}posSel()};
    tx.addEventListener('input',inp);tx.addEventListener('blur',end);tx.addEventListener('paste',pst);tx.addEventListener('keydown',key)}
  const addText=w=>{pushUndo();const it={id:uid(),t:'text',x:Math.round(w.x-6),y:Math.round(w.y-16),w:Math.round(320/Math.max(v.z,.5)),c:P.col.text==='#1d1f24'?'':P.col.text,fs:Math.round(24/Math.max(.5,Math.min(2,v.z))),html:''};
    b.items.push(it);itemsEl.appendChild(itemEl(it));hint();edit(it)};
  const addSticky=w=>{pushUndo();const s=Math.round(200/Math.max(.5,Math.min(2,v.z)));const it={id:uid(),t:'sticky',x:Math.round(w.x-s/2),y:Math.round(w.y-s/2),w:s,h:s,c:P.col.sticky,html:''};
    b.items.push(it);itemsEl.appendChild(itemEl(it));hint();changed();setTool('select');edit(it)};
  const addSticker=e=>{const w=center(),s=Math.round(96/Math.max(.3,v.z));pushUndo();const it={id:uid(),t:'sticker',x:Math.round(w.x-s/2+(Math.random()*40-20)),y:Math.round(w.y-s/2+(Math.random()*40-20)),w:s,e};
    b.items.push(it);itemsEl.appendChild(itemEl(it));hint();select(it.id);changed()};
  async function addImgs(files,at){let any=false;for(const f of files){if(!/^image\//.test(f.type))continue;
    try{const src=await shrink(f);const im=new Image();im.src=src;await im.decode().catch(()=>{});
      const w=Math.round(Math.min(im.naturalWidth||480,560)/Math.max(.3,Math.min(1.5,v.z))),h=w*((im.naturalHeight||3)/(im.naturalWidth||4));
      if(!any)pushUndo();any=true;const it={id:uid(),t:'img',x:Math.round(at.x-w/2),y:Math.round(at.y-h/2),w,src};b.items.push(it);itemsEl.appendChild(itemEl(it));select(it.id);at={x:at.x+30,y:at.y+30}}
    catch(e){toast('Bild konnte nicht gelesen werden')}}
    if(any){hint();changed()}}

  /* ---------- Zeichnen, Radieren, Formen, Ziehen ---------- */
  const PT=new Map();let act=null;
  const rnd=x=>Math.round(x*10)/10;
  const eraseAt=w=>{const r=10/v.z,n=b.ink.length;
    b.ink=b.ink.filter(s=>{const rr=r+s.w/2;return!s.p.split(' ').some(q=>{const[x,y]=q.split(',').map(Number);return Math.abs(x-w.x)<rr&&Math.abs(y-w.y)<rr})});
    if(b.ink.length!==n){drawInk();return true}return false};
  const begin=e=>{const w=toW(e.clientX,e.clientY),sx=e.clientX,sy=e.clientY;
    let tool=e.pointerType==='pen'&&(P.tool==='select'||P.tool==='hand')?'pen':P.tool;
    /* Nur Stift: Finger zeichnen nicht, sondern verschieben */
    if(e.pointerType==='touch'&&['pen','mark','erase'].includes(tool)&&penOnly())tool='hand';
    const tEl=e.target.closest&&e.target.closest('.wb-it'),it=tEl&&b.items.find(x=>x.id===tEl.dataset.id),hd=e.target.closest&&e.target.closest('.wb-h');
    if(e.button===1||st.space||tool==='hand'){act={k:'pan',sx,sy,vx:v.x,vy:v.y,moved:false,tool};return}
    if(tool==='pen'||tool==='mark'){const mk=tool==='mark',z=Math.max(.1,v.z);
      const c={id:uid(),c:mk?P.col.mark:P.col.pen,w:rnd(Math.max(.3,(mk?Math.max(14,P.size*4):P.size)/z)),a:mk?.38:1,pts:[[rnd(w.x),rnd(w.y)]]};
      const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('stroke',c.c);el.setAttribute('stroke-width',c.w);el.setAttribute('stroke-opacity',c.a);
      el.setAttribute('fill','none');el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');if(mk)el.setAttribute('class','mk');
      el.setAttribute('d',strokePath(c.pts.map(q=>q.join(',')).join(' ')));svg.appendChild(el);c.el=el;act={k:'draw',c};return}
    if(tool==='erase'){act={k:'erase',s0:snap(),hit:eraseAt(w)};return}
    if(hd&&it){act={k:'resize',it,h:hd.dataset.h,x0:it.x,y0:it.y,w0:it.w,h0:it.h,sx,sy,s0:snap(),moved:false};return}
    if(tool==='shape'){const s={id:uid(),t:'shape',k:P.shape,x:Math.round(w.x),y:Math.round(w.y),w:0,h:0,c:P.col.shape,f:'',sw:Math.max(1,Math.round(P.size/Math.max(.5,v.z)))};act={k:'shape',s,sx,sy,s0:snap(),added:false};return}
    if(it){const was=st.sel===it.id;select(it.id);act={k:'move',it,sx,sy,x0:it.x,y0:it.y,s0:snap(),moved:false,was,tool};return}
    if(tool==='text'){select(null);addText(w);return}
    if(tool==='sticky'){select(null);addSticky(w);return}
    act={k:'pan',sx,sy,vx:v.x,vy:v.y,moved:false,tool}};
  const moveAct=e=>{const a=act;if(!a)return;const dx=e.clientX-a.sx,dy=e.clientY-a.sy;
    if(a.k==='pan'){if(!a.moved&&Math.hypot(dx,dy)<4)return;a.moved=true;v.x=a.vx+dx;v.y=a.vy+dy;applyView();return}
    if(a.k==='draw'){const w=toW(e.clientX,e.clientY),p=a.c.pts,l=p[p.length-1];if(Math.hypot(w.x-l[0],w.y-l[1])<1.2/v.z)return;
      p.push([rnd(w.x),rnd(w.y)]);a.c.el.setAttribute('d',strokePath(p.map(q=>q.join(',')).join(' ')));return}
    if(a.k==='erase'){if(eraseAt(toW(e.clientX,e.clientY)))a.hit=true;return}
    const wx=dx/v.z,wy=dy/v.z;
    if(a.k==='move'){if(!a.moved&&Math.hypot(dx,dy)<4)return;a.moved=true;a.it.x=Math.round(a.x0+wx);a.it.y=Math.round(a.y0+wy);const d=elOf(a.it.id);if(d)place(d,a.it);posSel();return}
    if(a.k==='resize'){a.moved=true;const it=a.it,d=elOf(it.id);
      if(it.t==='shape'){if(a.h==='s'){it.x=Math.round(a.x0+wx);it.y=Math.round(a.y0+wy);it.w=Math.round(a.w0-wx);it.h=Math.round(a.h0-wy)}
        else if(it.k==='line'||it.k==='arrow'){it.w=Math.round(a.w0+wx);it.h=Math.round(a.h0+wy);if(e.shiftKey){if(Math.abs(it.w)>Math.abs(it.h)*2)it.h=0;else if(Math.abs(it.h)>Math.abs(it.w)*2)it.w=0}}
        else{it.w=Math.max(10,Math.round(a.w0+wx));it.h=Math.max(10,Math.round(a.h0+wy));if(e.shiftKey)it.h=it.w}}
      else if(it.t==='sticky'){it.w=Math.max(80,Math.round(a.w0+wx));it.h=Math.max(60,Math.round(a.h0+wy))}
      else if(it.t==='text')it.w=Math.max(40,Math.round(a.w0+wx));
      else if(it.t==='img')it.w=Math.max(30,Math.round(a.w0+wx));
      else it.w=Math.max(20,Math.round(a.w0+(wx+wy)/2));
      if(d)place(d,it);posSel();return}
    if(a.k==='shape'){const s=a.s;s.w=Math.round(wx);s.h=Math.round(wy);
      if(e.shiftKey){if(s.k==='line'||s.k==='arrow'){if(Math.abs(s.w)>Math.abs(s.h)*2)s.h=0;else if(Math.abs(s.h)>Math.abs(s.w)*2)s.w=0}else{const m=Math.max(Math.abs(s.w),Math.abs(s.h));s.w=Math.sign(s.w||1)*m;s.h=Math.sign(s.h||1)*m}}
      if(!a.added){if(Math.hypot(dx,dy)<4)return;a.added=true;b.items.push(s);itemsEl.appendChild(itemEl(s));hint()}else{const d=elOf(s.id);if(d)place(d,s)}}};
  const normShape=s=>{if(s.k!=='line'&&s.k!=='arrow'){if(s.w<0){s.x+=s.w;s.w=-s.w}if(s.h<0){s.y+=s.h;s.h=-s.h}}};
  const endAct=(e,cancel)=>{const a=act;act=null;if(!a)return;
    if(a.k==='pan'){if(!a.moved&&!cancel&&a.tool==='select')select(null);return}
    if(a.k==='draw'){if(cancel){a.c.el.remove();return}const c=a.c;pushUndo();b.ink.push({id:c.id,c:c.c,w:c.w,a:c.a,p:c.pts.map(q=>q.join(',')).join(' ')});c.el.dataset.id=c.id;changed();return}
    if(a.k==='erase'){if(a.hit){pushSnap(a.s0);changed()}return}
    if(a.k==='move'){if(a.moved){pushSnap(a.s0);changed()}else if(!cancel){const it=a.it;
        if((it.t==='text'||it.t==='sticky')&&(a.was||a.tool==='text'))edit(it);}return}
    if(a.k==='resize'){if(a.moved){if(a.it.t==='shape'){normShape(a.it);refresh(a.it)}pushSnap(a.s0);changed()}return}
    if(a.k==='shape'){const s=a.s;if(cancel){if(a.added){b.items=b.items.filter(x=>x!==s);const d=elOf(s.id);if(d)d.remove()}return}
      if(!a.added){const z=Math.max(.5,Math.min(2,v.z)),W=Math.round(160/z),H=Math.round(100/z);
        if(s.k==='line'||s.k==='arrow'){s.w=W;s.h=0}else{s.x-=Math.round(W/2);s.y-=Math.round(H/2);s.w=W;s.h=s.k==='ellipse'||s.k==='diamond'?W:H}
        b.items.push(s);itemsEl.appendChild(itemEl(s))}
      normShape(s);refresh(s);st.undo.push(a.s0);st.redo=[];setTool('select');select(s.id);hint();changed()}};
  const pinch=()=>{const[p,q]=[...PT.values()];return{d:Math.max(1,Math.hypot(p.x-q.x,p.y-q.y)),m:{x:(p.x+q.x)/2,y:(p.y+q.y)/2}}};
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('.wb-selbar'))return;
    if(e.target.closest('.wb-tx')&&e.target.closest('.wb-tx').isContentEditable)return;
    if(isEditing())document.activeElement.blur();
    if(e.pointerType==='mouse'&&e.button===2)return;
    e.preventDefault();notePen(e);window.__pgTouch=Date.now();wb.focus({preventScroll:true});
    if(e.isPrimary&&PT.size){PT.clear();if(act&&act.k!=='pinch')endAct(null,true);act=null}
    PT.set(e.pointerId,{x:e.clientX,y:e.clientY,t:e.pointerType});try{stage.setPointerCapture(e.pointerId)}catch(x){}
    if(PT.size===2&&[...PT.values()].every(p=>p.t==='touch')){endAct(null,act&&(act.k==='draw'||act.k==='shape'));const g=pinch();act={k:'pinch',d0:g.d,m0:g.m,v0:{...v}};return}
    if(PT.size>1||(act&&act.k==='pinch'))return;
    begin(e)});
  stage.addEventListener('pointermove',e=>{if(!PT.has(e.pointerId))return;PT.set(e.pointerId,{...PT.get(e.pointerId),x:e.clientX,y:e.clientY});window.__pgTouch=Date.now();
    if(act&&act.k==='pinch'){if(PT.size<2)return;const g=pinch(),r=R(),z=Math.max(.1,Math.min(5,act.v0.z*g.d/act.d0));
      const wx=(act.m0.x-r.left-act.v0.x)/act.v0.z,wy=(act.m0.y-r.top-act.v0.y)/act.v0.z;v.z=z;v.x=g.m.x-r.left-wx*z;v.y=g.m.y-r.top-wy*z;applyView();return}
    if(PT.size===1)moveAct(e)});
  const up=e=>{if(!PT.has(e.pointerId))return;PT.delete(e.pointerId);
    if(act&&act.k==='pinch'){if(!PT.size)act=null;return}
    endAct(e,e.type==='pointercancel')};
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  stage.addEventListener('dblclick',e=>{const tEl=e.target.closest('.wb-it'),it=tEl&&b.items.find(x=>x.id===tEl.dataset.id);
    if(it&&(it.t==='text'||it.t==='sticky'))edit(it);else if(it&&it.t==='img')lightbox(it.src);
    else if(!it&&P.tool==='select'&&e.target.closest('.wb-stage'))addText(toW(e.clientX,e.clientY))});
  stage.addEventListener('wheel',e=>{e.preventDefault();const k=e.deltaMode===1?16:1;
    if(e.ctrlKey||e.metaKey){const d=Math.max(-60,Math.min(60,e.deltaY*k));zoomAt(e.clientX,e.clientY,v.z*Math.exp(-d*.006))}else{v.x-=e.deltaX*k;v.y-=e.deltaY*k;applyView()}},{passive:false});
  /* Safari: Zwei-Finger-Zoom auf dem Trackpad (bei Touch kommt das über die Pointer) */
  let gz=1;stage.addEventListener('gesturestart',e=>{e.preventDefault();gz=v.z});
  stage.addEventListener('gesturechange',e=>{e.preventDefault();if(PT.size)return;zoomAt(e.clientX,e.clientY,gz*e.scale)});
  stage.addEventListener('gestureend',e=>e.preventDefault());
  stage.addEventListener('contextmenu',e=>{if(!(e.target.closest('.wb-tx')&&e.target.closest('.wb-tx').isContentEditable))e.preventDefault()});

  /* ---------- Werkzeugleiste ---------- */
  function setTool(t){P.tool=t;if(isEditing())document.activeElement.blur();if(t!=='select'&&t!=='hand')select(null);drawBar()}
  function drawBar(){$$('[data-wt]',host).forEach(x=>x.classList.toggle('on',x.dataset.wt===P.tool));const o=$('#wbOpts',host),t=P.tool;
    const cols={pen:PEN_COLORS,mark:MARK_COLORS,shape:PEN_COLORS,sticky:WB_STICKY,text:PEN_COLORS}[t];o.hidden=!cols;if(!cols){applyView();return}
    const c=P.col[t],extra=!cols.includes(c);let h='';
    if(t==='shape')h+=WB_SHAPES.map(([k,l])=>`<button type="button" data-shp="${k}" class="${P.shape===k?'on':''}" title="${l}" aria-label="${l}">${WB_IC[k]}</button>`).join('')+'<i class="sep"></i>';
    h+=cols.map(x=>sw(x,x===c,'data-oc')).join('')+`<button type="button" class="pg-sw more${extra?' on':''}" id="wbColMore" style="${extra?'background:'+c:''}" title="Weitere Farben …" aria-label="Weitere Farben"></button>`;
    if((t==='pen'||t==='mark')&&HAS_TOUCH)h+='<i class="sep"></i>'+penOnlyBtn();
    if(t==='pen'||t==='shape')h+='<i class="sep"></i>'+[[2,'Fein'],[4,'Mittel'],[8,'Dick']].map(([s,l])=>`<button type="button" data-sz="${s}" class="${P.size===s?'on':''}" title="${l}"><i class="wb-dot" style="width:${s+3}px;height:${s+3}px"></i></button>`).join('');
    o.innerHTML=h;
    $$('[data-oc]',o).forEach(x=>x.onclick=()=>{P.col[t]=x.dataset.oc;drawBar()});
    $('#wbColMore',o).onclick=e=>colorPick(e.currentTarget,c,x=>{if(isHex(x)){P.col[t]=x;drawBar()}},{title:{pen:'Farbe des Stifts',mark:'Farbe des Markers',shape:'Farbe der Form',sticky:'Farbe der Haftnotiz',text:'Textfarbe'}[t]});
    $$('[data-sz]',o).forEach(x=>x.onclick=()=>{P.size=+x.dataset.sz;drawBar()});
    $$('[data-penonly]',o).forEach(x=>x.onclick=()=>{setPenOnly(!penOnly());drawBar()});
    $$('[data-shp]',o).forEach(x=>x.onclick=()=>{P.shape=x.dataset.shp;drawBar()});
    applyView()}
  $$('[data-wt]',host).forEach(x=>x.onclick=()=>setTool(x.dataset.wt));
  $('#wbStk',host).onclick=e=>{const a=e.currentTarget;$$('.wb-pop').forEach(x=>x.remove());const m=document.createElement('div');m.className='wb-pop';m.setAttribute('role','dialog');m.setAttribute('aria-label','Sticker');
    m.innerHTML=WB_STICKERS.map(s=>`<button type="button" data-e="${s}" aria-label="Sticker ${s}">${s}</button>`).join('');document.body.appendChild(m);
    const r=a.getBoundingClientRect();m.style.left=Math.max(8,Math.min(r.left,innerWidth-m.offsetWidth-8))+'px';m.style.top=Math.min(r.bottom+6,innerHeight-m.offsetHeight-8)+'px';
    const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true)},out=ev=>{if(!m.contains(ev.target)&&ev.target!==a)close()};
    setTimeout(()=>document.addEventListener('pointerdown',out,true),0);
    $$('[data-e]',m).forEach(x=>x.onclick=()=>{close();if(P.tool!=='select'&&P.tool!=='hand')setTool('select');addSticker(x.dataset.e)})};
  const fileIn=$('#wbFile',host);$('#wbImg',host).onclick=()=>fileIn.click();
  fileIn.onchange=()=>{addImgs([...fileIn.files],center());fileIn.value=''};
  $('#wbBg',host).onchange=e=>{pushUndo();b.bg=e.target.value;applyView();changed()};
  $('#wbUndo',host).onclick=undo;$('#wbRedo',host).onclick=redo;
  $('#wbZi',host).onclick=()=>zoomBy(1.25);$('#wbZo',host).onclick=()=>zoomBy(1/1.25);$('#wbZr',host).onclick=()=>{const r=R();zoomAt(r.left+r.width/2,r.top+r.height/2,1)};$('#wbFit',host).onclick=fitAll;

  /* ---------- Einfügen und Ziehen von Bildern/Text ---------- */
  const onPaste=e=>{if(isEditing()||!host.isConnected)return;const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>/^image\//.test(f.type));
    if(files.length){e.preventDefault();e.stopPropagation();addImgs(files,center());return}
    const t=e.clipboardData&&e.clipboardData.getData('text/plain');if(t&&t.trim()){e.preventDefault();e.stopPropagation();const w=center();pushUndo();
      const it={id:uid(),t:'text',x:Math.round(w.x-150),y:Math.round(w.y-20),w:Math.round(360/Math.max(v.z,.5)),c:'',fs:Math.round(24/Math.max(.5,Math.min(2,v.z))),html:esc(t.trim()).replace(/\n/g,'<br>')};
      b.items.push(it);itemsEl.appendChild(itemEl(it));select(it.id);hint();changed()}};
  wb.addEventListener('paste',onPaste,true);
  stage.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();stage.classList.add('drop')}});
  stage.addEventListener('dragleave',()=>stage.classList.remove('drop'));
  stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('drop');const f=[...e.dataTransfer.files];if(f.length)addImgs(f,toW(e.clientX,e.clientY))});

  /* ---------- Tastatur ---------- */
  ['pointerdown','keydown','input'].forEach(ev=>wb.addEventListener(ev,()=>{window.__pgTouch=Date.now()},true));
  wb.addEventListener('keydown',e=>{if(isEditing())return;if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;let done=true;
    if(mod&&k==='z')(e.shiftKey?redo:undo)();else if(mod&&k==='y')redo();else if(mod&&k==='d'&&st.sel)dup();
    else if(mod&&(k==='+'||k==='='))zoomBy(1.25);else if(mod&&k==='-')zoomBy(1/1.25);else if(mod&&k==='0')fitAll();
    else if(mod||e.altKey)done=false;
    else if((k==='delete'||k==='backspace')&&st.sel)delSel();
    else if(k==='escape'&&st.sel)select(null);
    else if(k==='enter'&&st.sel){const it=cur();if(it&&(it.t==='text'||it.t==='sticky'))edit(it);else done=false}
    else if(k.startsWith('arrow')&&st.sel){const it=cur(),s=e.shiftKey?20:2;pushUndo();if(k==='arrowleft')it.x-=s;if(k==='arrowright')it.x+=s;if(k==='arrowup')it.y-=s;if(k==='arrowdown')it.y+=s;const d=elOf(it.id);if(d)place(d,it);posSel();changed()}
    else if(k===' '){if(!st.space){st.space=true;applyView()}}
    else if(WB_KEYS[k])setTool(WB_KEYS[k]);
    else done=false;
    if(done){e.preventDefault();e.stopPropagation()}});
  wb.addEventListener('keyup',e=>{if(e.key===' '&&st.space){st.space=false;applyView()}});

  selBar.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-sm],[data-fill]'))e.preventDefault()});
  selBar.addEventListener('click',()=>{if(!isEditing()&&!document.querySelector('.cpick'))wb.focus({preventScroll:true})});
  const onPen=()=>drawBar();document.addEventListener('kn-pen',onPen);
  const ro=new ResizeObserver(()=>posSel());ro.observe(stage);
  drawAll();drawBar();
  if(!wbViews[fid]._seen){wbViews[fid]._seen=1;if(b.items.length||b.ink.length)requestAnimationFrame(fitAll)}
  wb.focus({preventScroll:true});
  return{destroy:()=>{if(!alive)return;alive=false;document.removeEventListener('kn-pen',onPen);if(isEditing())document.activeElement.blur();ro.disconnect();$$('.wb-pop').forEach(x=>x.remove());
    clearTimeout(vt);wbSaveView();if(ct){clearTimeout(ct);ct=0;save()}}}}

const WB_IC={
  board:'<svg width="14" height="14" viewBox="0 0 16 16"><rect x="1.8" y="2.2" width="12.4" height="9" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 14l3-2.8 3 2.8M4.5 8.5c1.2-2.4 2.4-2.4 3.4-.8s2.2 1.6 3.6-1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  select:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 2.5l9 4.6-3.9 1.1-1.5 3.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  hand:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M5.5 8.5V3.6a1 1 0 0 1 2 0V8m0-.5V2.8a1 1 0 0 1 2 0V8m0-.6V3.8a1 1 0 0 1 2 0v5.4c0 2.7-1.8 4.8-4.3 4.8-1.6 0-2.7-.8-3.6-2.2L2.4 9.3a1 1 0 0 1 1.6-1.2l1.5 1.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sticky:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 2.5h11v7l-4 4h-7z" fill="#fff1a8" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M13.5 9.5h-4v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  shape:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1.8" y="1.8" width="7.4" height="7.4" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10.6" cy="10.6" r="3.8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  sticker:'<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="6.8" r=".9" fill="currentColor"/><circle cx="10" cy="6.8" r=".9" fill="currentColor"/><path d="M5.3 9.6c1.4 1.9 4 1.9 5.4 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  fit:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rect:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3.5" width="12" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  ellipse:'<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  diamond:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.8L14.2 8 8 14.2 1.8 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  line:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 13.5l11-11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  arrow:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 13.5l10-10M7 3h6v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
