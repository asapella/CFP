import {rpc, teacherSignIn, teacherSignOut, teacherSession, configured, CONFIG} from './api.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const fmt=s=>s?new Date(s).toLocaleString('it-IT'):'—';
let versions=[], classes=[], activeClassId=null, activeDash=null, activeOverview=null, timer=null, uploadPayload=null, demoContent=null;

function alertBox(msg){alert(msg)}
function showApp(){
  $('#loginPanel').classList.add('hidden');$('#appPanel').classList.remove('hidden');$('#logoutBtn').classList.remove('hidden');
  $('#authBadge').textContent='docente autenticato';$('#authBadge').className='badge ok';
}
function showLogin(msg=''){
  $('#loginPanel').classList.remove('hidden');$('#appPanel').classList.add('hidden');$('#logoutBtn').classList.add('hidden');
  $('#authBadge').textContent='non autenticato';$('#authBadge').className='badge'; if(msg){$('#loginError').textContent=msg;$('#loginError').classList.remove('hidden')}
}
async function login(){
  try{await teacherSignIn($('#email').value.trim(),$('#password').value);$('#loginError').classList.add('hidden');showApp();await boot()}catch(e){showLogin(e.message)}
}
async function boot(){await Promise.all([loadVersions(),loadClasses()]);setupDemoVersion();}

async function loadVersions(){
  versions=await rpc('teacher_list_game_versions',{},true); const opts=versions.map(v=>`<option value="${v.version_id}">${esc(v.title)} · v${v.version}</option>`).join('');
  $('#newClassGame').innerHTML=opts;$('#demoGame').innerHTML=opts;
}
async function loadClasses(){classes=await rpc('teacher_list_classes',{},true);renderClassList();}
function renderClassList(){
  const el=$('#classList'); if(!classes.length){el.innerHTML='<p class="muted">Nessuna classe creata.</p>';return}
  el.innerHTML=classes.map(c=>`<button class="level available class-open" data-id="${c.id}" style="width:100%;min-height:0;text-align:left;margin-bottom:8px"><div class="row space"><b>${esc(c.name)}</b><span class="badge ${c.status==='open'?'ok':c.status==='archived'?'lock':'pending'}">${esc(c.status)}</span></div><div class="meta">Codice <span class="code">${esc(c.class_code)}</span> · ${esc(c.game_title)} v${c.game_version}</div></button>`).join('');
  el.querySelectorAll('.class-open').forEach(b=>b.onclick=()=>openClass(b.dataset.id));
}
async function createClass(){
  const name=$('#newClassName').value.trim(), vid=$('#newClassGame').value;if(!name)return alertBox('Inserisci il nome della classe.');
  try{const c=await rpc('teacher_create_class',{p_name:name,p_game_version_id:vid},true);alertBox(`Classe creata. Codice da comunicare agli studenti: ${c.class_code}`);$('#newClassName').value='';await loadClasses();await openClass(c.id)}catch(e){alertBox(e.message)}
}
async function openClass(id){activeClassId=id;$('#classPanel').classList.remove('hidden');await refreshClass();if(timer)clearInterval(timer);timer=setInterval(()=>refreshClass(true).catch(()=>{}),CONFIG.POLL_MS)}
async function refreshClass(silent=false){
  if(!activeClassId)return;try{
    [activeDash,activeOverview]=await Promise.all([rpc('teacher_class_dashboard',{p_class_id:activeClassId},true),rpc('teacher_class_overview',{p_class_id:activeClassId},true)]);renderClass();
    if(!silent)$('#autoRefreshText').textContent=`aggiornato ${new Date().toLocaleTimeString('it-IT')}`;
  }catch(e){if(!silent)alertBox(e.message)}
}
function renderClass(){
  const c=activeDash.class,g=activeDash.game;$('#classTitle').textContent=c.name;$('#classMeta').innerHTML=`Codice <span class="code">${esc(c.class_code)}</span> · ${esc(g.title)} v${g.version} · stato <b>${esc(c.status)}</b>`;
  renderStudents();renderOverview();
}
function renderStudents(){
  const q=$('#studentFilter').value.trim().toLowerCase(),sort=$('#studentSort').value;let rows=[...activeDash.students].filter(s=>!q||s.alias.toLowerCase().includes(q)||s.state.toLowerCase().includes(q));
  const prog=s=>s.total?s.completed/s.total:0;
  rows.sort((a,b)=>sort==='progress_desc'?prog(b)-prog(a):sort==='progress_asc'?prog(a)-prog(b):sort==='attempts_desc'?b.attempts-a.attempts:sort==='hints_desc'?b.hints-a.hints:sort==='first_try_asc'?a.first_try_correct-b.first_try_correct:sort==='last_desc'?new Date(b.last_activity||0)-new Date(a.last_activity||0):a.alias.localeCompare(b.alias,'it'));
  $('#studentsBody').innerHTML=rows.map(s=>`<tr><td><b>${esc(s.alias)}</b><br><span class="muted small">${esc(s.student_id.slice(0,8))}</span></td><td>${esc(s.state)}</td><td>${s.current_level}</td><td>${s.completed}/${s.total}</td><td>${s.first_try_correct}</td><td>${s.attempts}</td><td>${s.hints}</td><td>${fmt(s.last_activity)}</td><td><button class="btn ghost detail" data-id="${s.student_id}">Apri</button></td></tr>`).join('');
  $('#studentsBody').querySelectorAll('.detail').forEach(b=>b.onclick=()=>openStudent(b.dataset.id));
}
function pct(w,a){return a?Math.round((w/a)*100):0}
function renderOverview(){
  const o=activeOverview, d=activeDash; const attempts=d.students.reduce((n,s)=>n+s.attempts,0), completed=d.students.filter(s=>s.state==='completato').length;
  $('#overviewKpis').innerHTML=`<div class="kpi"><b>${o.students}</b><span>studenti</span></div><div class="kpi"><b>${completed}</b><span>percorsi completati</span></div><div class="kpi"><b>${attempts}</b><span>tentativi totali</span></div><div class="kpi"><b>${d.students.reduce((n,s)=>n+s.hints,0)}</b><span>suggerimenti usati</span></div>`;
  const hard=[...o.levels].sort((a,b)=>pct(b.wrong_attempts,b.attempts)-pct(a.wrong_attempts,a.attempts)).slice(0,5);
  $('#hardLevels').innerHTML=hard.map(x=>`<div class="row space" style="margin:7px 0"><span>L${x.order} ${esc(x.title)}</span><span class="badge">${pct(x.wrong_attempts,x.attempts)}% errori</span></div>`).join('')||'<span class="muted">Nessun tentativo.</span>';
  $('#skillOverview').innerHTML=o.skills.map(x=>`<div class="row space" style="margin:7px 0"><span>${esc(x.label)}</span><span class="badge">${x.wrong_attempts}/${x.attempts} errori/tentativi</span></div>`).join('');
}
async function setStatus(status){try{await rpc('teacher_set_class_status',{p_class_id:activeClassId,p_status:status},true);await Promise.all([loadClasses(),refreshClass()])}catch(e){alertBox(e.message)}}

async function openStudent(id){
  try{const d=await rpc('teacher_student_detail',{p_student_id:id},true);$('#studentModalTitle').textContent=d.student.alias;renderStudentDetail(d);$('#studentModal').classList.remove('hidden')}catch(e){alertBox(e.message)}
}
function renderStudentDetail(d){
  const body=$('#studentModalBody');
  const wrongGroups=new Map();
  d.attempts.filter(a=>!a.correct).forEach(a=>{const k=`${a.level_key}|${JSON.stringify(a.answer)}`;const cur=wrongGroups.get(k)||{level:a.level_key,answer:a.answer,count:0};cur.count++;wrongGroups.set(k,cur)});
  const recurring=[...wrongGroups.values()].sort((a,b)=>b.count-a.count).slice(0,6);
  const firstAttempts=d.attempts.filter(a=>a.run_no===1), repeatAttempts=d.attempts.filter(a=>a.run_no>1);
  const acc=arr=>arr.length?Math.round(arr.filter(a=>a.correct).length/arr.length*100):0;
  body.innerHTML=`<div class="row"><button id="renameStudent" class="btn ghost">Correggi nome</button><button id="resetStudent" class="btn warn">Azzera partita</button><button id="deleteStudent" class="btn danger">Elimina ingresso</button></div><div class="divider"></div><h3>Annotazioni private</h3><textarea id="teacherNote" class="field" rows="3">${esc(d.note)}</textarea><div style="height:8px"></div><button id="saveNote" class="btn secondary">Salva nota</button><div class="divider"></div><h3>Andamento per competenza</h3>${d.skills.map(s=>`<div class="row space"><span>${esc(s.label)}</span><span class="badge">${s.wrong_attempts}/${s.attempts} errori/tentativi</span></div>`).join('')}<div class="divider"></div><h3>Primo svolgimento vs ripetizioni</h3><div class="kpis"><div class="kpi"><b>${firstAttempts.length}</b><span>tentativi nel primo svolgimento</span></div><div class="kpi"><b>${acc(firstAttempts)}%</b><span>correttezza primo svolgimento</span></div><div class="kpi"><b>${repeatAttempts.length}</b><span>tentativi in ripetizione</span></div><div class="kpi"><b>${acc(repeatAttempts)}%</b><span>correttezza ripetizioni</span></div></div><div class="divider"></div><h3>Errori ricorrenti</h3>${recurring.length?recurring.map(r=>`<div class="row space" style="margin:6px 0"><span><b>${esc(r.level)}</b> · <code>${esc(JSON.stringify(r.answer))}</code></span><span class="badge">${r.count} volte</span></div>`).join(''):'<p class="muted">Nessun errore ripetuto.</p>'}<div class="divider"></div><h3>Livello per livello</h3><div class="table-wrap"><table class="table"><thead><tr><th>Livello</th><th>Difficoltà</th><th>Tentativi</th><th>Errori</th><th>Suggerimenti</th><th>Con aiuto</th><th>Ripetizioni</th></tr></thead><tbody>${d.levels.map(l=>`<tr><td>${l.order}. ${esc(l.title)}</td><td>${esc(l.difficulty)}</td><td>${l.attempts}</td><td>${l.wrong_attempts}</td><td>${l.hints}</td><td>${l.help_completions}</td><td>${l.repetitions}</td></tr>`).join('')}</tbody></table></div><div class="divider"></div><h3>Cronologia tentativi</h3><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Livello</th><th>Svolgimento</th><th>Tentativo</th><th>Risposta</th><th>Esito</th></tr></thead><tbody>${d.attempts.map(a=>`<tr><td>${fmt(a.created_at)}</td><td>${esc(a.level_key)}</td><td>${a.run_no===1?'primo':'ripetizione '+a.run_no}</td><td>${a.attempt_no}</td><td><code>${esc(JSON.stringify(a.answer))}</code></td><td>${a.correct?'✓ corretto':'✗ errore'}</td></tr>`).join('')}</tbody></table></div>`;
  $('#saveNote').onclick=async()=>{await rpc('teacher_save_note',{p_student_id:d.student.id,p_note:$('#teacherNote').value},true);alertBox('Nota salvata.')};
  $('#renameStudent').onclick=async()=>{const n=prompt('Nuovo nome/pseudonimo:',d.student.alias);if(!n)return;await rpc('teacher_rename_student',{p_student_id:d.student.id,p_alias:n},true);$('#studentModal').classList.add('hidden');await refreshClass()};
  $('#resetStudent').onclick=async()=>{if(!confirm(`Azzera la partita di ${d.student.alias}? Saranno cancellati sessioni, livelli e tentativi, ma lo studente resterà nella classe con lo stesso codice di ripresa.`))return;await rpc('teacher_reset_student',{p_student_id:d.student.id},true);$('#studentModal').classList.add('hidden');await refreshClass()};
  $('#deleteStudent').onclick=async()=>{if(!confirm(`Eliminare ${d.student.alias} e TUTTI i suoi risultati? Prima esporta i CSV se vuoi conservarli.`))return;await rpc('teacher_delete_student',{p_student_id:d.student.id},true);$('#studentModal').classList.add('hidden');await refreshClass()};
}

function csvCell(v){const s=typeof v==='string'?v:JSON.stringify(v??'');return `"${s.replaceAll('"','""')}"`}
function downloadCsv(name,headers,rows){const text='\ufeff'+headers.map(csvCell).join(';')+'\n'+rows.map(r=>r.map(csvCell).join(';')).join('\n');const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportPrefix(){const c=activeDash.class,g=activeDash.game;return `${c.name.replace(/\W+/g,'_')}_${g.title.replace(/\W+/g,'_')}_v${g.version}`}
function exportSummary(){
  const c=activeDash.class,g=activeDash.game;downloadCsv(`${exportPrefix()}_riepilogo.csv`,['classe','codice_classe','gioco','versione','studente_id','studente','stato','livello_attuale','completati','totale','corretti_primo_tentativo','tentativi','suggerimenti','ultima_attivita'],activeDash.students.map(s=>[c.name,c.class_code,g.title,g.version,s.student_id,s.alias,s.state,s.current_level,s.completed,s.total,s.first_try_correct,s.attempts,s.hints,s.last_activity]));
}
async function fetchAllDetails(){const out=[];for(const s of activeDash.students)out.push(await rpc('teacher_student_detail',{p_student_id:s.student_id},true));return out}
async function exportLevels(){
  const all=await fetchAllDetails(),rows=[];for(const d of all)for(const l of d.levels)rows.push([d.class.name,d.class.class_code,d.game.title,d.game.version,d.student.id,d.student.alias,l.order,l.key,l.title,l.difficulty,l.skill_id,l.attempts,l.wrong_attempts,l.hints,l.help_completions,l.repetitions,JSON.stringify(l.statuses)]);
  downloadCsv(`${exportPrefix()}_livelli.csv`,['classe','codice_classe','gioco','versione','studente_id','studente','livello','chiave','titolo','difficolta','competenza','tentativi','errori','suggerimenti','completamenti_aiuto','ripetizioni','stati'],rows)
}
async function exportAttempts(){
  const all=await fetchAllDetails(),rows=[];for(const d of all)for(const a of d.attempts)rows.push([d.class.name,d.class.class_code,d.game.title,d.game.version,d.student.id,d.student.alias,a.level_key,a.run_no,a.attempt_no,JSON.stringify(a.answer),a.correct,a.created_at]);
  downloadCsv(`${exportPrefix()}_tentativi.csv`,['classe','codice_classe','gioco','versione','studente_id','studente','livello','svolgimento','tentativo','risposta','corretta','data_ora'],rows)
}

async function deleteClass(){
  if(!confirm(`Eliminare definitivamente la classe “${activeDash.class.name}”? Verranno cancellati studenti, sessioni, livelli, tentativi e note. Prima usa i pulsanti CSV per esportare.`))return;
  const typed=prompt('Per confermare scrivi ELIMINA');if(typed!=='ELIMINA')return;
  await rpc('teacher_delete_class',{p_class_id:activeClassId},true);activeClassId=null;$('#classPanel').classList.add('hidden');if(timer)clearInterval(timer);await loadClasses();
}

async function readContentFile(file){
  try{const txt=await file.text();uploadPayload=JSON.parse(txt);const n=uploadPayload?.levels?.length||0,g=uploadPayload?.game; if(!g?.slug||!n)throw new Error('JSON non valido: servono game.slug e levels.');$('#contentPreview').innerHTML=`<b>${esc(g.title)}</b><br>${esc(g.subject)} / ${esc(g.topic)}<br>${n} livelli<br><span class="muted">La pubblicazione creerà una nuova versione immutabile.</span>`;$('#publishContentBtn').disabled=false}catch(e){uploadPayload=null;$('#contentPreview').textContent=e.message;$('#publishContentBtn').disabled=true}
}
async function publishContent(){
  if(!uploadPayload)return;if(!confirm(`Pubblicare “${uploadPayload.game.title}” come nuova versione? Le classi già create resteranno sulla versione attuale.`))return;
  try{const r=await rpc('teacher_publish_game_version',{p_payload:uploadPayload},true);alertBox(`Pubblicata versione ${r.version}.`);uploadPayload=null;$('#contentFile').value='';$('#contentPreview').textContent='Nessun file selezionato.';$('#publishContentBtn').disabled=true;await loadVersions();setupDemoVersion()}catch(e){alertBox(e.message)}
}

function setupDemoVersion(){if(!versions.length)return;$('#demoGame').value=versions[0].version_id;loadDemoLevels()}
async function loadDemoLevels(){
  try{demoContent=await rpc('teacher_demo_content',{p_game_version_id:$('#demoGame').value},true);$('#demoLevel').innerHTML=(demoContent.levels||[]).map(l=>`<option value="${l.key}">L${l.order} · ${esc(l.difficulty)} · ${esc(l.title)}</option>`).join('')}catch(e){alertBox(e.message)}
}
function demoVisual(v){
  if(!v)return '<p class="muted">Nessun elemento visuale.</p>';
  if(v.kind==='multiples')return '<div class="multiples">'+v.rows.map(r=>`<div class="mrow"><b>${esc(r.label)}:</b>${r.values.map(x=>`<span class="bubble">${esc(x)}</span>`).join('')}</div>`).join('')+'</div>';
  if(v.kind==='area_tiles')return `<div class="visual-grid">${(v.labels||[]).map((x,i)=>`<div class="tile ${i?'small':''}">${esc(x)}</div>`).join('')}</div>`;
  if(v.kind==='balance')return `<div class="eq-balance"><span>${esc(v.left)}</span><span>=</span><span>${esc(v.right)}</span></div><div class="bar"></div>`;
  if(v.kind==='factor_tree')return v.items.map(x=>`<span class="bubble" style="display:inline-block;margin:5px">${esc(x)}</span>`).join('');
  if(v.kind==='error_card')return `<div class="errorwork">${esc(v.work)}</div><p><b>${esc(v.question||'')}</b></p>`;
  if(v.kind==='quadratic_roots')return `<div class="errorwork" style="text-align:center">${esc(v.expression)}</div><p class="muted" style="text-align:center">${esc(v.factor_hint||'')}</p>`;
  if(v.kind==='context_card')return `<div class="context"><strong>${esc(v.icon||'')} ${esc(v.title||'')}</strong>${(v.lines||[]).map(x=>`<div>${esc(x)}</div>`).join('')}</div>`;
  return `<pre class="json">${esc(JSON.stringify(v,null,2))}</pre>`;
}
function renderDemo(){
  const l=demoContent?.levels?.find(x=>x.key===$('#demoLevel').value);if(!l)return;$('#demoView').innerHTML=`<div class="card"><div class="row"><span class="badge">${esc(l.difficulty)}</span><span class="badge">${esc(l.skill_id)}</span><span class="badge">CPS: ${esc(l.cps_stage)}</span></div><h2>Livello ${l.order} · ${esc(l.title)}</h2><p class="prompt">${esc(l.prompt)}</p><div class="visual">${demoVisual(l.visual)}</div><h3>Risposte disponibili</h3>${(l.options||[]).length?`<div class="options">${l.options.map(o=>`<div class="option">${esc(o.text)}</div>`).join('')}</div>`:`<p class="muted">Tipo di risposta: ${esc(l.response_type)}</p>`}<div class="alert ok" style="margin-top:12px"><b>Soluzione:</b> ${esc(l.solution)}</div><div class="alert info" style="margin-top:8px"><b>Spiegazione:</b> ${esc(l.explanation)}</div><p class="muted small">Questa schermata è di sola lettura: non scrive tentativi.</p></div>`;
}

function switchTab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));['classes','content','demo'].forEach(n=>$('#tab-'+n).classList.toggle('hidden',n!==name))}

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));
$('#loginBtn').onclick=login;$('#logoutBtn').onclick=()=>{teacherSignOut();if(timer)clearInterval(timer);showLogin()};$('#createClassBtn').onclick=createClass;$('#refreshClassBtn').onclick=()=>refreshClass();$('#closeClassBtn').onclick=()=>{$('#classPanel').classList.add('hidden');activeClassId=null;if(timer)clearInterval(timer)};
$('#openClassBtn').onclick=()=>setStatus('open');$('#closeAccessBtn').onclick=()=>setStatus('closed');$('#archiveClassBtn').onclick=()=>setStatus('archived');$('#deleteClassBtn').onclick=deleteClass;
$('#studentFilter').oninput=()=>activeDash&&renderStudents();$('#studentSort').onchange=()=>activeDash&&renderStudents();$('#closeStudentModal').onclick=()=>$('#studentModal').classList.add('hidden');
$('#exportSummaryBtn').onclick=exportSummary;$('#exportLevelsBtn').onclick=exportLevels;$('#exportAttemptsBtn').onclick=exportAttempts;
$('#contentFile').onchange=e=>e.target.files[0]&&readContentFile(e.target.files[0]);$('#publishContentBtn').onclick=publishContent;$('#demoGame').onchange=loadDemoLevels;$('#loadDemoBtn').onclick=renderDemo;

if(!configured())showLogin('Backend non configurato: modifica assets/js/config.js.');else if(teacherSession()){showApp();boot().catch(e=>showLogin(e.message))}else showLogin();
