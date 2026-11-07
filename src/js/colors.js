/* © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE */
/* Kanban Notizen · Grosse Farbpalette für Notizen, Spalten, Labels, Spaces und Seiten.
   Farben sind entweder eine der bisherigen Voreinstellungen (z. B. 'blue') oder ein Hex-Wert '#rrggbb'. */
'use strict';
const isHex=c=>/^#[0-9a-f]{6}$/i.test(c||'');
const okColor=(c,map)=>map[c]||isHex(c)?c:null;
function hsl2hex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return'#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
const CP_HUES=[[355,'Rot'],[20,'Orange'],[38,'Bernstein'],[52,'Gelb'],[90,'Limette'],[140,'Grün'],[170,'Türkis'],[195,'Cyan'],[215,'Blau'],[245,'Indigo'],[275,'Violett'],[320,'Pink']];
const CP_TONES=[[92,85,'sehr hell'],[82,80,'hell'],[70,76,'zart'],[57,72,'kräftig'],[45,70,'dunkel'],[33,62,'sehr dunkel']];
const CP_GREYS=['#ffffff','#f4f5f7','#e5e7eb','#d1d5db','#b0b6bf','#8a919c','#646b76','#474d57','#30353d','#1f2329','#111317','#000000'];
const CP_ROWS=[CP_GREYS,...CP_TONES.map(([l,s])=>CP_HUES.map(([h])=>hsl2hex(h,s,l)))];
const CPKEY='kanban-notizen-colors';
const recentColors=()=>{try{return JSON.parse(localStorage.getItem(CPKEY)||'[]').filter(isHex).slice(0,12)}catch(e){return[]}};
function rememberColor(c){if(!isHex(c))return;const l=[c.toLowerCase(),...recentColors().filter(x=>x.toLowerCase()!==c.toLowerCase())].slice(0,12);try{localStorage.setItem(CPKEY,JSON.stringify(l))}catch(e){}}
/* Lesbare Schriftfarbe auf einer Hintergrundfarbe */
function textOn(hex){if(!isHex(hex))return'#1f2430';const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;
  const L=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};return .2126*L(r)+.7152*L(g)+.0722*L(b)>.42?'#1f2430':'#ffffff'}
/* Punkt-/Akzentfarbe einer Spalte oder Notiz (Voreinstellung oder Hex) */
const colHex=c=>NC[c]?NC[c].d:isHex(c)?c:NC.grey.d;
const colName=c=>NC[c]?NC[c].n:isHex(c)?c.toUpperCase():'';

/* ---------- Farbwähler ----------
   colorPick(anker, aktuelleFarbe, beiAuswahl, {presets:[[id,hex,name]], none:'Standard', title:'Farbe'}) */
function colorPick(anchor,current,onPick,opt={}){$$('.cpick').forEach(x=>x.remove());
  const m=document.createElement('div');m.className='cpick';m.setAttribute('role','dialog');m.setAttribute('aria-label',opt.title||'Farbe wählen');
  const cur=String(current||'').toLowerCase(),rec=recentColors();
  const sw=(c,title)=>`<button type="button" class="cp-sw${String(c).toLowerCase()===cur?' on':''}" data-c="${c}" style="background:${c}" title="${esc(title||c.toUpperCase())}" aria-label="${esc(title||c)}"></button>`;
  const hx=isHex(current)?current:opt.presets&&opt.presets.find(p=>p[0]===current)?opt.presets.find(p=>p[0]===current)[1]:'#3a7bd5';
  m.innerHTML=`<div class="cp-h"><b>${esc(opt.title||'Farbe')}</b>${opt.none?`<button type="button" class="btn sm ghost" data-c="${opt.noneValue??''}">${esc(opt.none)}</button>`:''}</div>
    ${opt.presets?`<div class="cp-lbl">Standard</div><div class="cp-row">${opt.presets.map(([id,h,n])=>`<button type="button" class="cp-sw${id===current?' on':''}" data-c="${id}" style="background:${h}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('')}</div>`:''}
    ${rec.length?`<div class="cp-lbl">Zuletzt verwendet</div><div class="cp-row">${rec.map(c=>sw(c)).join('')}</div>`:''}
    <div class="cp-lbl">Alle Farben</div><div class="cp-grid">${CP_ROWS.map((row,ri)=>row.map((c,ci)=>sw(c,ri?`${CP_HUES[ci][1]} ${CP_TONES[ri-1][2]}`:'')).join('')).join('')}</div>
    <div class="cp-lbl">Eigene Farbe</div><div class="cp-own"><input type="color" value="${hx}" aria-label="Farbwähler"><input type="text" class="cp-hex" value="${hx.toUpperCase()}" maxlength="7" spellcheck="false" aria-label="Hex-Code"><button type="button" class="btn sm primary" data-own>Übernehmen</button></div>`;
  /* In einem offenen Dialog (Top-Layer) muss der Wähler im Dialog liegen, sonst ist er verdeckt */
  (anchor.closest('dialog[open]')||document.body).appendChild(m);
  const r=anchor.getBoundingClientRect(),W=m.offsetWidth,H=m.offsetHeight;
  m.style.left=Math.max(8,Math.min(r.left,innerWidth-W-8))+'px';m.style.top=(r.bottom+6+H>innerHeight&&r.top-H-6>8?r.top-H-6:Math.max(8,Math.min(r.bottom+6,innerHeight-H-8)))+'px';
  const close=()=>{m.remove();document.removeEventListener('pointerdown',out,true);document.removeEventListener('keydown',esc_,true)};
  const out=e=>{if(!m.contains(e.target)&&e.target!==anchor)close()};
  const esc_=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
  setTimeout(()=>{document.addEventListener('pointerdown',out,true);document.addEventListener('keydown',esc_,true)},0);
  const pick=c=>{if(isHex(c))rememberColor(c);close();onPick(c)};
  $$('[data-c]',m).forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>pick(b.dataset.c)});
  const ci=$('input[type=color]',m),ti=$('.cp-hex',m);
  ci.oninput=()=>{ti.value=ci.value.toUpperCase()};
  ti.oninput=()=>{let v=ti.value.trim();if(!v.startsWith('#'))v='#'+v;if(isHex(v))ci.value=v.toLowerCase()};
  ti.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('[data-own]',m).click()}};
  $('[data-own]',m).onclick=()=>{let v=ti.value.trim();if(!v.startsWith('#'))v='#'+v;if(!isHex(v)){toast('Bitte einen Hex-Code wie #3A7BD5 eingeben');return}pick(v.toLowerCase())};
  return close}
/* Knopf mit Farbvorschau, der den Farbwähler öffnet */
const swatchBtn=(c,attrs='',title='Farbe wählen')=>`<button type="button" class="cp-btn" ${attrs} style="--c:${colHex(c)}" title="${esc(title)}" aria-label="${esc(title)}"><span></span>▾</button>`;
const NOTE_PRESETS=()=>NCOL.map(c=>[c.id,c.d,c.n]);
const LABEL_PRESETS=()=>LCOL.map(c=>[c.id,c.c,c.n]);
