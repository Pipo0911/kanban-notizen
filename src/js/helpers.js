/* Kanban Notizen · Toast, Dialoge, Export, Markdown */
'use strict';
/* ============ Helfer: Toast, Dialoge, Download, Markdown ============ */
let toastT;
function toast(msg,opt={}){const t=$('#toast');
  t.innerHTML=`<span>${esc(msg)}</span>${opt.undo?'<button data-undo>Rückgängig</button>':''}${opt.open?`<button data-open>${esc(opt.openLabel||'Öffnen')}</button>`:''}`;
  t.className='show';clearTimeout(toastT);toastT=setTimeout(()=>t.className='',opt.undo||opt.open?8000:3500);
  if(opt.undo)$('[data-undo]',t).onclick=()=>{const keep=DB.ui,act=DB.active;DB=normDB(Object.assign(JSON.parse(opt.undo),{ui:keep,active:act}));save();render();t.className='';toast('Rückgängig gemacht')};
  if(opt.open)$('[data-open]',t).onclick=()=>{t.className='';opt.open()}}
async function download(name,text,type){
  if(TAURI&&TAURI.dialog){const ext=(name.split('.').pop()||'txt').toLowerCase();
    const p=await TAURI.dialog.save({defaultPath:name,filters:[{name:ext.toUpperCase()+'-Datei',extensions:[ext]}]});if(!p)return false;
    try{await tInvoke('write_text_file',{path:p,contents:text});toast('Gespeichert: '+p);return true}catch(e){toast('Speichern fehlgeschlagen: '+e);return false}}
  const b=new Blob([text],{type:type||'application/json'});
  if(IOS&&navigator.canShare){try{const f=new File([b],name,{type:b.type});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return true}}catch(e){if(e&&e.name==='AbortError')return false}}
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return true}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}ta.remove();return ok}}
function moveArr(a,x,d){const k=a.indexOf(x),j=k+d;if(k<0||j<0||j>=a.length)return;a.splice(k,1);a.splice(j,0,x)}
const safeName=s=>String(s).replace(/[^\wäöüÄÖÜ -]/g,'').trim().replace(/\s+/g,'-')||'notizen';
function fieldHTML(x){const id='a_'+x.name;
  const at=`name="${x.name}" id="${id}"${x.required?' required':''}${x.maxlength?` maxlength="${x.maxlength}"`:''}${x.placeholder?` placeholder="${esc(x.placeholder)}"`:''}`;
  let inp;
  if(x.type==='select')inp=`<select ${at}>${x.options.map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(x.value??'')?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
  else if(x.type==='textarea')inp=`<textarea ${at} rows="${x.rows||3}">${esc(x.value||'')}</textarea>`;
  else inp=`<input type="${x.type||'text'}" ${at} value="${esc(x.value??'')}">`;
  return`<div class="fld"><label for="${id}">${esc(x.label)}</label>${inp}${x.hint?`<small>${esc(x.hint)}</small>`:''}</div>`}
function ask({title,text='',fields=[],ok='OK',cancel='Abbrechen',danger=false,init,wide}){
  return new Promise(res=>{const d=$('#dlg2');d.style.width=wide?'min(640px,calc(100vw - 24px))':'';
    d.innerHTML=`<form id="af" novalidate><div class="dh">${esc(title)}</div><div class="ab">${text?`<p class="atext">${text}</p>`:''}${fields.map(fieldHTML).join('')}</div><div class="df"><span class="spacer"></span>${cancel?`<button type="button" class="btn ghost" data-x>${esc(cancel)}</button>`:''}<button class="btn ${danger?'danger-solid':'primary'}">${esc(ok)}</button></div></form>`;
    const f=$('#af',d);let done=false;
    const fin=v=>{if(done)return;done=true;if(d.open)d.close();res(v)};
    f.onsubmit=e=>{e.preventDefault();if(!f.checkValidity()){f.reportValidity();return}const o={};fields.forEach(x=>o[x.name]=f.elements[x.name].value);fin(o)};
    const bx=$('[data-x]',d);if(bx)bx.onclick=()=>fin(null);d.onclose=()=>{fin(null);applyExternal()};
    if(init)init(f);d.showModal();
    const first=$('input,select,textarea',f);(first||$('.btn:last-child',f)).focus()})}
function inl(t){
  const keep=[];const hold=h=>{keep.push(h);return`\u0000${keep.length-1}\u0000`};
  let s=String(t??'');
  s=s.replace(/`([^`]+)`/g,(_,c)=>hold('<code>'+esc(c)+'</code>'));
  s=s.replace(WL_RE,(_,tg,al)=>hold(wikiHTML(tg,al)));
  s=esc(s);
  s=s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g,u=>hold(`<a href="${u}" target="_blank" rel="noopener">${u}</a>`));
  const j=DB&&DB.settings.jiraUrl;
  if(j)s=s.replace(/\b([A-Z][A-Z0-9]{1,9}-\d{1,7})\b/g,k=>hold(`<a class="jira" href="${esc(j.replace(/\/?$/,'/'))}${k}" target="_blank" rel="noopener" title="In Jira öffnen">${k}</a>`));
  s=s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g,'$1<i>$2</i>').replace(/~~([^~]+)~~/g,'<s>$1</s>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>keep[+i])}
function md(src){const out=[];let list=null,para=[],code=null;
  const fp=()=>{if(para.length){out.push('<p>'+para.join('<br>')+'</p>');para=[]}},fl=()=>{if(list){out.push(`</${list==='ck'?'ul':list}>`);list=null}};
  for(const raw of String(src).split('\n')){const l=raw.replace(/\s+$/,'');let m;
    if(code!==null){if(/^```/.test(l)){out.push('<pre>'+esc(code.join('\n'))+'</pre>');code=null}else code.push(raw);continue}
    if(/^```/.test(l)){fp();fl();code=[];continue}
    if(!l.trim()){fp();fl();continue}
    if(/^(-{3,}|\*{3,})$/.test(l.trim())){fp();fl();out.push('<hr>');continue}
    if((m=l.match(/^#{1,4}\s+(.*)/))){fp();fl();out.push('<h4>'+inl(m[1])+'</h4>');continue}
    if((m=l.match(/^>\s?(.*)/))){fp();fl();out.push('<blockquote>'+inl(m[1])+'</blockquote>');continue}
    if((m=l.match(/^\s*[-*]\s+\[( |x|X)\]\s*(.*)/))){fp();if(list!=='ck'){fl();out.push('<ul style="list-style:none;padding-left:.2em">');list='ck'}out.push(`<li><span class="mdck${m[1]!==' '?' on':''}"></span>${inl(m[2])}</li>`);continue}
    if((m=l.match(/^\s*[-*•]\s+(.*)/))){fp();if(list!=='ul'){fl();out.push('<ul>');list='ul'}out.push('<li>'+inl(m[1])+'</li>');continue}
    if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){fp();if(list!=='ol'){fl();out.push('<ol>');list='ol'}out.push('<li>'+inl(m[1])+'</li>');continue}
    fl();para.push(inl(l))}
  if(code!==null)out.push('<pre>'+esc(code.join('\n'))+'</pre>');
  fp();fl();return out.join('')}
function noteText(s,n){const L=[`# ${noteLabel(n)}`];
  const meta=[n.due?'Termin: '+fmtDate(n.due)+(n.dueTime?' '+n.dueTime:''):'',n.prio?'Priorität: '+PRIO[n.prio].n:'',n.tags.length?'Labels: '+n.tags.join(', '):'',n.time.length?'Zeit: '+hShort(timeTotal(n)):''].filter(Boolean);
  if(meta.length)L.push(meta.join(' · '));if(n.body.trim())L.push('',n.body.trim());if(n.checklist.length)L.push('',...n.checklist.map(c=>`- [${c.done?'x':' '}] ${c.text}`));return L.join('\n')}
