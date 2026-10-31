/* Kanban Notizen · Grundlagen: Hilfsfunktionen, Konstanten, Symbole */
'use strict';
/* ============ Grundlagen ============ */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const now=()=>new Date().toISOString();
const isoDay=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const today=()=>isoDay(new Date());
const addDays=(ds,n)=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return isoDay(d)};
const dow=ds=>new Date(ds+'T12:00:00').getDay();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=x=>Array.isArray(x)?x:[];
const isDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'');
const isTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'');
const okId=x=>/^[A-Za-z0-9_~:@+-]{1,100}$/.test(String(x||''));
const WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
const fmtDate=d=>{if(!d)return'';const[y,m,t]=d.split('-');return`${t}.${m}.${y}`};
const fmtShort=d=>{if(!d)return'';const t=today();if(d===t)return'Heute';if(d===addDays(t,1))return'Morgen';if(d===addDays(t,-1))return'Gestern';const[y,m,dd]=d.split('-');return`${WD[dow(d)]} ${dd}.${m}.`+(y!==t.slice(0,4)?y.slice(2):'')};
const fmtTime=iso=>iso?new Date(iso).toLocaleString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const hhmm=()=>new Date().toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'});
const rel=iso=>{const s=(Date.now()-Date.parse(iso))/1e3;if(s<60)return'gerade eben';if(s<3600)return`vor ${Math.floor(s/60)} Min.`;if(s<86400)return`vor ${Math.floor(s/3600)} Std.`;const d=Math.floor(s/86400);if(d===1)return'gestern';if(d<30)return`vor ${d} Tagen`;return fmtDate(iso.slice(0,10))};
const hm=min=>{min=Math.round(min);return`${Math.floor(min/60)}:${String(min%60).padStart(2,'0')}`};
const hShort=min=>{min=Math.round(min);const h=Math.floor(min/60),m=min%60;return h?(m?`${h} h ${m} min`:`${h} h`):`${m} min`};
const clock=ms=>{const s=Math.max(0,Math.floor(ms/1e3));return`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
function parseMin(v){v=String(v||'').trim().toLowerCase().replace(',','.');if(!v)return 0;let m;
  if((m=v.match(/^(\d+):(\d{1,2})$/)))return +m[1]*60+ +m[2];
  if((m=v.match(/^(\d+(?:\.\d+)?)\s*h$/))||(m=v.match(/^(\d+\.\d+)$/)))return Math.round(+m[1]*60);
  if((m=v.match(/^(\d+)\s*(?:m|min)?$/)))return +m[1];return 0}

const NCOL=[{id:'default',n:'Weiss',d:'#ffffff'},{id:'yellow',n:'Gelb',d:'#f5cd47'},{id:'green',n:'Grün',d:'#4bce97'},{id:'blue',n:'Blau',d:'#6f9cff'},{id:'pink',n:'Rosa',d:'#ef7fbd'},{id:'purple',n:'Lila',d:'#a48ef5'},{id:'orange',n:'Orange',d:'#fa9d5a'},{id:'grey',n:'Grau',d:'#a0a3ab'}];
const NC=Object.fromEntries(NCOL.map(c=>[c.id,c]));
const SPCOL=['#2f5bd3','#1f8fbf','#1f9d6b','#6aa84f','#d4a015','#e0742c','#d24b3e','#c8508f','#7a55d6','#5a6275'];
const SPCOLN=['Blau','Petrol','Grün','Hellgrün','Senf','Orange','Rot','Pink','Violett','Schiefer'];
const PRIOS=[{id:'highest',n:'Höchste',c:'#c9372c'},{id:'high',n:'Hoch',c:'#e56910'},{id:'medium',n:'Mittel',c:'#d4a015'},{id:'low',n:'Niedrig',c:'#2898bd'},{id:'lowest',n:'Niedrigste',c:'#5a8f3c'}];
const PRIO=Object.fromEntries(PRIOS.map(p=>[p.id,p]));const PRANK=id=>id?PRIOS.findIndex(p=>p.id===id):9;
function prioIcon(id,sz=16){const p=PRIO[id];if(!p)return'';const up=id==='highest'||id==='high',dbl=id==='highest'||id==='lowest';
  if(id==='medium')return`<span class="prio" title="Priorität: ${p.n}"><svg width="${sz}" height="${sz}" viewBox="0 0 16 16"><path d="M3 6h10M3 10h10" stroke="${p.c}" stroke-width="2.2" stroke-linecap="round"/></svg></span>`;
  const ch=y=>up?`M3.5 ${y+4}L8 ${y}l4.5 4`:`M3.5 ${y}L8 ${y+4}l4.5-4`;
  return`<span class="prio" title="Priorität: ${p.n}"><svg width="${sz}" height="${sz}" viewBox="0 0 16 16"><path d="${dbl?ch(up?3:2)+' '+ch(up?8:7):ch(up?5.5:4.5)}" fill="none" stroke="${p.c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`}
const LCOL=[{id:'red',n:'Rot',c:'#f8857a'},{id:'orange',n:'Orange',c:'#fbac6e'},{id:'yellow',n:'Gelb',c:'#f5cd47'},{id:'green',n:'Grün',c:'#6fd3a0'},{id:'teal',n:'Türkis',c:'#6cc9d6'},{id:'blue',n:'Blau',c:'#8fb2ff'},{id:'purple',n:'Lila',c:'#b9a5f7'},{id:'pink',n:'Rosa',c:'#f49ccb'},{id:'grey',n:'Grau',c:'#c2c5cc'}];
const LC=Object.fromEntries(LCOL.map(c=>[c.id,c]));
function labelColor(name){const c=DB&&DB.settings.labels[name];if(LC[c])return LC[c].c;let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;return LCOL[h%LCOL.length].c}
function labelColorId(name){const c=DB&&DB.settings.labels[name];if(LC[c])return c;let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;return LCOL[h%LCOL.length].id}
function ensureLabel(name){if(!DB.settings.labels[name]){let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;DB.settings.labels[name]=LCOL[h%LCOL.length].id}}
const lblHTML=t=>`<span class="nlbl" style="background:${labelColor(t)}">${esc(t)}</span>`;
const SORTS={manual:'Manuell',prio:'Priorität',due:'Termin',updated:'Zuletzt geändert'};
const REPEAT={'':'Nie',daily:'Täglich',weekdays:'Werktags (Mo–Fr)',weekly:'Wöchentlich',biweekly:'Alle 2 Wochen',monthly:'Monatlich',yearly:'Jährlich'};
const TEMPLATES={
  arbeit:{n:'Arbeit',d:'Eingang, In Arbeit, Warten auf …, Erledigt',cols:[['Eingang','yellow'],['In Arbeit','blue'],['Warten auf …','orange'],['Erledigt','green',1]]},
  notizen:{n:'Notizen',d:'Ideen, In Arbeit, Erledigt',cols:[['Ideen','yellow'],['In Arbeit','blue'],['Erledigt','green',1]]},
  woche:{n:'Wochenplanung',d:'Später, Diese Woche, Heute, Erledigt',cols:[['Später','grey'],['Diese Woche','blue'],['Heute','orange'],['Erledigt','green',1]]},
  lernen:{n:'Lernen',d:'Zu lernen, Am Lernen, Kann ich',cols:[['Zu lernen','purple'],['Am Lernen','blue'],['Kann ich','green',1]]},
  leer:{n:'Leer',d:'eine Spalte „Notizen“',cols:[['Notizen','yellow']]}
};
const DEFAULT_TPL=()=>[
  {id:uid(),name:'Telefonnotiz',color:'yellow',title:'Telefonat {datum}',tags:['telefon'],checklist:[],body:'**Firma / Kunde:** \n**Kontakt:** \n**Telefon / E-Mail:** \n\n## Anliegen\n\n\n## Vereinbart / nächster Schritt\n- '},
  {id:uid(),name:'Störung / Incident',color:'orange',title:'Störung: ',tags:['störung'],checklist:['Ticket erfasst','Kunde informiert','Ursache gefunden','Gelöst und dokumentiert'],body:'**Kunde:** \n**Betroffen:** \n**Seit:** {datum} \n**Ticket:** \n\n## Symptome\n- \n\n## Massnahmen\n- '},
  {id:uid(),name:'Meeting-Protokoll',color:'blue',title:'Meeting {datum}',tags:['meeting'],checklist:[],body:'**Datum:** {datum}\n**Teilnehmende:** \n\n## Traktanden\n1. \n\n## Beschlüsse\n- \n\n## Pendenzen\n- [ ] '},
  {id:uid(),name:'Tagesplan',color:'green',title:'Tagesplan {wochentag} {datum}',tags:['planung'],checklist:[],body:'## Fokus heute\n- \n\n## Termine\n- \n\n## Nicht vergessen\n- '}
];
const SVG={
  logo:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1.5" y="2" width="5.5" height="7" rx="1.2" fill="#fff"/><rect x="9" y="2" width="5.5" height="4.5" rx="1.2" fill="#fff" opacity=".75"/><rect x="9" y="8" width="5.5" height="6" rx="1.2" fill="#fff" opacity=".9"/><rect x="1.5" y="10.5" width="5.5" height="3.5" rx="1.2" fill="#fff" opacity=".6"/></svg>',
  search:'<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="2"/></svg>',
  pin:'<svg width="14" height="14" viewBox="0 0 16 16"><path d="M10.5 1.5l4 4-2 .6-2.6 2.6.4 3.3-1.3 1.3L6 10l-3.7 3.7-.6-.6L5.4 9.4 2.1 6.4l1.3-1.3 3.3.4L9.3 2.9z" fill="currentColor"/></svg>',
  cal:'<svg width="11" height="11" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2 7h12M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.8"/></svg>',
  rep:'<svg width="11" height="11" viewBox="0 0 16 16"><path d="M3 6a5 5 0 0 1 9-2l1.5-1.5V7H9l1.6-1.6A3.2 3.2 0 0 0 4.8 6.4M13 10a5 5 0 0 1-9 2l-1.5 1.5V9H7l-1.6 1.6a3.2 3.2 0 0 0 5.8-1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  clock:'<svg width="11" height="11" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 4.5V8l2.5 1.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  img:'<svg width="11" height="11" viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="6.5" r="1.4" fill="currentColor"/><path d="M2 12l4-3.5 3 2.5 2-1.5 3 2.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  today:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.5"/><rect x="5" y="8.5" width="3" height="3" rx=".6" fill="currentColor"/></svg>',
  time:'<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8.5" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5.2v3.3l2.2 1.4M6.5 1.5h3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  folder:'<svg class="fi" width="15" height="15" viewBox="0 0 16 16"><path d="M1.8 4.2c0-.8.6-1.4 1.4-1.4h3l1.5 1.6h5.1c.8 0 1.4.6 1.4 1.4v6.3c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  gear:'<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.5"/></svg>',
  upd:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 10.5V2.5M4.8 5.7 8 2.5l3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 10.5v1.8c0 .7.5 1.2 1.2 1.2h8.6c.7 0 1.2-.5 1.2-1.2v-1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  star:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  starOn:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  trash:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.3c0 .7.6 1.2 1.3 1.2h4c.7 0 1.3-.5 1.3-1.2L12 4M6.6 6.8v5M9.4 6.8v5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  daily:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3M5 9h6M5 11.5h4" stroke="currentColor" stroke-width="1.4"/></svg>',
  hist:'<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6M8 5v3.2l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  board:'<svg width="18" height="18" viewBox="0 0 16 16"><rect x="1.5" y="2" width="3.6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="6.2" y="2" width="3.6" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="10.9" y="2" width="3.6" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  key:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1.5" y="4" width="13" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7h1M7 7h1M10 7h2M4.5 9.8h7" stroke="currentColor" stroke-width="1.5"/></svg>'
};

let DB,statusMsg='',statusErr=false;
const ui={filters:blankF(),stab:'details',gtab:'general',edTab:'write',period:'week'};
function blankF(){return{q:'',tag:'',prio:'',color:'',due:'',pinned:false}}
const SPACE_VIEWS=['board','wall','archive','spacecfg'],GLOBAL_VIEWS=['today','time','trash','settings'];
const WDL=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const DAILY_TPL='## Fokus heute\n- \n\n## Notizen\n\n\n## Erledigt\n- ';
