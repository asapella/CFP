import {rpc, configured} from './api.js';

const STORE='cps_student_session_v1';
const CACHE='cps_student_dashboard_v1';
const QUEUE='cps_student_queue_v1';
let session=null, dashboard=null, currentLevel=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const fmtDate=s=>s?new Date(s).toLocaleString('it-IT'):'—';

function setSaveState(text,kind=''){
  const el=$('#saveState'); el.textContent=text; el.className='badge'+(kind?` ${kind}`:'');
}
function loadJSON(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'')||fallback}catch{return fallback}}
function saveSession(){localStorage.setItem(STORE,JSON.stringify(session));}
function clearSession(){localStorage.removeItem(STORE);localStorage.removeItem(CACHE);session=null;dashboard=null;}
function pending(){return loadJSON(QUEUE,[])}
function saveQueue(q){localStorage.setItem(QUEUE,JSON.stringify(q));}

function showLogin(){
  $('#gamePanel').classList.add('hidden'); $('#exitBtn').classList.add('hidden');
  const remembered=loadJSON(STORE,null);
  if(remembered){
    $('#resumeAlias').textContent=remembered.alias||'studente'; $('#resumeClass').textContent=remembered.class_code||'';
    $('#resumePanel').classList.remove('hidden'); $('#loginPanel').classList.add('hidden');
  }else{
    $('#resumePanel').classList.add('hidden'); $('#loginPanel').classList.remove('hidden');
  }
}

async function join(){
  hideError();
  try{
    const classCode=$('#classCode').value.trim(), alias=$('#alias').value.trim();
    const data=await rpc('student_join',{p_class_code:classCode,p_alias:alias});
    session={class_code:data.class_code,resume_code:data.resume_code,alias:data.alias,session_id:data.session_id}; saveSession();
    alert(`Salva questo codice personale di ripresa:\n\n${data.resume_code}\n\nTi serve per continuare da un altro computer.`);
    await enter();
  }catch(e){showError(e.message)}
}
async function resumeManual(){
  hideError();
  try{
    const classCode=$('#resumeClassCode').value.trim(), resumeCode=$('#resumeCode').value.trim().toUpperCase();
    const data=await rpc('student_resume',{p_class_code:classCode,p_resume_code:resumeCode});
    session={class_code:classCode,resume_code:resumeCode,alias:data.alias,session_id:data.session_id}; saveSession(); await enter();
  }catch(e){showError(e.message)}
}
async function continueRemembered(){
  try{
    const data=await rpc('student_resume',{p_class_code:session.class_code,p_resume_code:session.resume_code});
    session.session_id=data.session_id;session.alias=data.alias;saveSession();await enter();
  }catch(e){showError(e.message);$('#resumePanel').classList.add('hidden');$('#loginPanel').classList.remove('hidden')}
}
function showError(msg){const e=$('#loginError');e.textContent=msg;e.classList.remove('hidden')}
function hideError(){$('#loginError').classList.add('hidden')}

async function enter(){
  $('#loginPanel').classList.add('hidden');$('#resumePanel').classList.add('hidden');$('#loginError').classList.add('hidden');
  $('#gamePanel').classList.remove('hidden');$('#exitBtn').classList.remove('hidden');
  await syncQueue();
  await loadDashboard();
}

async function loadDashboard(){
  try{
    dashboard=await rpc('student_dashboard',{p_class_code:session.class_code,p_resume_code:session.resume_code});
    localStorage.setItem(CACHE,JSON.stringify(dashboard));
    setSaveState(pending().length?'salvataggio in attesa':'salvato',pending().length?'pending':'ok');
    $('#offlineNotice').classList.add('hidden');
  }catch(e){
    const cached=loadJSON(CACHE,null);
    if(!cached) throw e;
    dashboard=cached; setSaveState('offline · in attesa','pending'); $('#offlineNotice').classList.remove('hidden');
  }
  renderDashboard();
}

function renderDashboard(){
  $('#studentTitle').textContent=`Ciao ${dashboard.student.alias}`;
  $('#gameMeta').textContent=`${dashboard.game.title} · ${dashboard.game.subject}/${dashboard.game.topic}`;
  $('#studentBadge').textContent=`Studente ${dashboard.student.id.slice(0,8)}`;
  $('#classBadge').textContent=`Classe ${dashboard.class.code}`;
  const {completed,total}=dashboard.overall; $('#progressText').textContent=`${completed}/${total} livelli completati`;
  $('#progressBar').style.width=`${total?completed/total*100:0}%`; $('#versionText').textContent=`Versione contenuti ${dashboard.game.version}`;
  renderLevels(); renderFinal();
}

function diffClass(d){return String(d||'').toLowerCase().replace('difficile','difficile')}
function renderLevels(){
  const grid=$('#levelsGrid');grid.innerHTML='';
  dashboard.levels.forEach(l=>{
    const done=l.state==='completed', locked=!l.unlocked;
    const div=document.createElement('button'); div.type='button'; div.className=`level ${done?'completed':locked?'locked':'available'}`; div.disabled=locked;
    div.innerHTML=`<div class="row space"><span class="badge ${diffClass(l.difficulty)}">${esc(l.difficulty)}</span><span class="badge ${done?'ok':locked?'lock':''}">${done?'✓ completato':locked?'🔒 bloccato':'▶ disponibile'}</span></div><h3>Livello ${l.order} · ${esc(l.title)}</h3><div class="meta">${esc(skillLabel(l.skill_id))}</div><div class="meta">CPS: ${esc(l.cps_stage||'')}</div><div class="meta">Tentativi: ${l.attempts||0} · Suggerimenti: ${l.hints_used||0}</div>`;
    if(!locked) div.addEventListener('click',()=>openLevel(l)); grid.appendChild(div);
  });
}
function skillLabel(id){
  const map={mcm:'Minimo Comune Multiplo',binomi:'Quadrati di binomi',eq1:'Equazioni di primo grado',eq2:'Equazioni di secondo grado'};return map[id]||id;
}

function renderFinal(){
  const el=$('#finalPanel'); if(dashboard.overall.status!=='completed'){el.classList.add('hidden');return}
  const sorted=[...dashboard.skills].sort((a,b)=>(a.wrong_attempts+a.hints_used)-(b.wrong_attempts+b.hints_used));
  const strengths=sorted.slice(0,2).map(s=>s.label).join(' · '), review=[...sorted].reverse().slice(0,2).map(s=>s.label).join(' · ');
  el.innerHTML=`<h2 class="section-title">Percorso completato 🎯</h2><div class="grid two"><div class="alert ok"><b>Punti di forza</b><br>${esc(strengths||'Percorso completato')}</div><div class="alert info"><b>Da ripassare</b><br>${esc(review||'Rivedi i livelli con più tentativi')}</div></div><p class="muted">Puoi riaprire qualunque livello completato per esercitarti di nuovo: le ripetizioni restano distinte dal primo svolgimento.</p>`;
  el.classList.remove('hidden');
}

async function openLevel(summary){
  currentLevel=summary;
  let level={...summary,was_completed:summary.state==='completed'};
  if(navigator.onLine){
    try{
      const data=await rpc('student_begin_level',{p_class_code:session.class_code,p_resume_code:session.resume_code,p_level_key:summary.key});
      level={...summary,...data.level,run_id:data.run_id,run_no:data.run_no,wrong_attempts:data.wrong_attempts||0,solution_after_wrong_attempts:data.solution_after_wrong_attempts||3,solution_available:!!data.solution_available,was_completed:summary.state==='completed'};
    }catch(e){alert(e.message);return}
  }
  currentLevel=level; renderLevel(level); $('#levelPanel').classList.remove('hidden'); $('#levelPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderLevel(l){
  const panel=$('#levelPanel');
  panel.innerHTML=`<div class="hero-level"><div class="row space"><div><span class="badge ${diffClass(l.difficulty)}">${esc(l.difficulty)}</span> <span class="badge">${esc(skillLabel(l.skill_id))}</span></div><button id="closeLevel" class="btn ghost">Chiudi</button></div><h2 class="section-title">Livello ${l.order} · ${esc(l.title)}</h2><div class="prompt">${esc(l.prompt)}</div><div id="visualBox" class="visual"></div><div id="answerBox"></div><div class="row"><button id="verifyBtn" class="btn">Verifica</button><button id="hintBtn" class="btn secondary">Suggerimento</button><button id="solutionBtn" class="btn ghost hidden">Mostra soluzione</button><button id="skipBtn" class="btn warn">Salta</button><button id="nextLevelBtn" class="btn secondary hidden">Livello successivo →</button></div><div id="solutionGate" class="muted small" style="margin-top:10px"></div><div id="feedbackBox" class="hidden"></div></div>`;
  renderVisual($('#visualBox'),l.visual); renderAnswer($('#answerBox'),l);
  $('#closeLevel').onclick=()=>panel.classList.add('hidden'); $('#verifyBtn').onclick=submitAnswer; $('#hintBtn').onclick=requestHint; $('#solutionBtn').onclick=revealSolution; $('#skipBtn').onclick=skipLevel; $('#nextLevelBtn').onclick=openNextLevel;
  updateSolutionGate(); updateNextButton();
}

function updateSolutionGate(){
  const btn=$('#solutionBtn'), gate=$('#solutionGate'); if(!btn||!gate||!currentLevel)return;
  const threshold=Number(currentLevel.solution_after_wrong_attempts||3), wrong=Number(currentLevel.wrong_attempts||0);
  const available=!!currentLevel.solution_available;
  btn.classList.toggle('hidden',!available);
  gate.textContent=available?'':`La soluzione diventa disponibile dopo ${threshold} tentativi errati (${Math.min(wrong,threshold)}/${threshold}).`;
}
function nextSummary(){
  if(!dashboard||!currentLevel)return null;
  return [...dashboard.levels].filter(x=>x.order>currentLevel.order&&x.unlocked).sort((a,b)=>a.order-b.order)[0]||null;
}
function updateNextButton(){
  const btn=$('#nextLevelBtn'); if(!btn)return; const next=nextSummary();
  const canGo=!!next && (currentLevel.was_completed || ['completed','completed_help','skipped'].includes(currentLevel.finished_status||''));
  btn.classList.toggle('hidden',!canGo); if(next)btn.textContent=`Livello ${next.order} →`;
}
async function openNextLevel(){
  const next=nextSummary(); if(!next)return; await openLevel(next);
}
function markLevelFinished(status){
  currentLevel.finished_status=status; currentLevel.was_completed=true;
  ['verifyBtn','hintBtn','solutionBtn','skipBtn'].forEach(id=>{const e=$('#'+id);if(e)e.classList.add('hidden')});
  const gate=$('#solutionGate');if(gate)gate.textContent=''; updateNextButton();
}

function renderVisual(el,v){
  if(!v){el.textContent='Rappresenta il problema sul quaderno prima di passare ai simboli.';return}
  if(v.kind==='multiples'){
    el.innerHTML='<div class="multiples">'+v.rows.map(r=>`<div class="mrow"><b>${esc(r.label)}:</b>${r.values.map(x=>`<span class="bubble">${esc(x)}</span>`).join('')}</div>`).join('')+'</div>';
  } else if(v.kind==='area_tiles'){
    const labels=v.labels||['a²','ab','ab','b²']; el.innerHTML=`<div class="visual-grid">${labels.map((x,i)=>`<div class="tile ${i? 'small':''}">${esc(x)}</div>`).join('')}</div><p class="muted small">Leggi l'area come somma dei quattro pezzi.</p>`;
  } else if(v.kind==='balance'){
    el.innerHTML=`<div class="eq-balance"><span>${esc(v.left)}</span><span>=</span><span>${esc(v.right)}</span></div><div class="bar"></div><p class="muted small" style="text-align:center">Mantieni l'equilibrio facendo la stessa operazione a sinistra e a destra.</p>`;
  } else if(v.kind==='factor_tree'){
    el.innerHTML=v.items.map(x=>`<div class="bubble" style="margin:5px;display:inline-block">${esc(x)}</div>`).join('');
  } else if(v.kind==='error_card'){
    el.innerHTML=`<div class="errorwork">${esc(v.work)}</div><p><b>${esc(v.question||'Trova l’errore.')}</b></p>`;
  } else if(v.kind==='quadratic_roots'){
    el.innerHTML=`<div class="errorwork" style="text-align:center">${esc(v.expression)}</div><p class="muted" style="text-align:center">${esc(v.factor_hint||'Osserva la parabola e le possibili intersezioni.')}</p>`;
  } else if(v.kind==='context_card'){
    el.innerHTML=`<div class="context"><strong>${esc(v.icon||'')} ${esc(v.title||'Situazione')}</strong>${(v.lines||[]).map(x=>`<div>${esc(x)}</div>`).join('')}</div>`;
  } else el.textContent=JSON.stringify(v);
}

function renderAnswer(el,l){
  if(['choice','choice_reason'].includes(l.response_type)){
    el.innerHTML=`<div class="options">${(l.options||[]).map(o=>`<label class="option"><input type="radio" name="choice" value="${esc(o.id)}"><span>${esc(o.text)}</span></label>`).join('')}</div>${l.response_type==='choice_reason'?'<label for="reason">Motiva in una frase</label><textarea id="reason" class="field" rows="3" placeholder="Scrivi il passaggio che ti ha fatto scegliere questa risposta"></textarea>':''}`;
  } else if(l.response_type==='number'){
    el.innerHTML='<label for="answerValue">Risposta numerica</label><input id="answerValue" class="field" inputmode="decimal" placeholder="Scrivi il numero">';
  } else if(l.response_type==='text'){
    el.innerHTML='<label for="answerValue">Risposta</label><input id="answerValue" class="field" placeholder="es. 13/3">';
  } else if(l.response_type==='open'){
    el.innerHTML='<label for="answerValue">Risposta aperta</label><textarea id="answerValue" class="field" rows="5" placeholder="Scrivi il ragionamento e la risposta"></textarea>';
  } else if(l.response_type==='procedure'){
    el.innerHTML=`<div class="procedure">${(l.procedure_fields||[]).map((f,i)=>`<label><b>${i+1}. ${esc(f.label)}</b><input class="field procedure-step" data-step="${esc(f.id)}" placeholder="${esc(f.placeholder||'Scrivi questo passaggio')}"></label>`).join('')}</div>`;
  } else if(l.response_type==='coordinate'){
    el.innerHTML='<div class="grid two"><div><label>x</label><input id="coordX" class="field" inputmode="decimal"></div><div><label>y</label><input id="coordY" class="field" inputmode="decimal"></div></div>';
  } else if(l.response_type==='ordering'){
    const items=l.items||[]; el.innerHTML=`<p class="muted">Scrivi l'ordine separando gli elementi con una virgola.</p><input id="answerValue" class="field" placeholder="${items.map(x=>x.id).join(', ')}">`;
  } else if(l.response_type==='matching'){
    el.innerHTML=(l.left_items||[]).map(left=>`<label>${esc(left.text)}<select class="field match" data-left="${esc(left.id)}"><option value="">— scegli —</option>${(l.right_items||[]).map(r=>`<option value="${esc(r.id)}">${esc(r.text)}</option>`).join('')}</select></label>`).join('');
  } else el.innerHTML='<input id="answerValue" class="field">';
}

function collectAnswer(l){
  if(['choice','choice_reason'].includes(l.response_type)){
    const c=document.querySelector('input[name="choice"]:checked'); if(!c) throw new Error('Scegli una risposta.');
    const a={choice:c.value}; if(l.response_type==='choice_reason') a.reason=$('#reason').value.trim(); return a;
  }
  if(['number','text','open'].includes(l.response_type)){const v=$('#answerValue').value.trim();if(!v)throw new Error('Inserisci una risposta.');return {value:v}}
  if(l.response_type==='procedure'){
    const steps={};let missing=false;document.querySelectorAll('.procedure-step').forEach(i=>{steps[i.dataset.step]=i.value.trim();if(!i.value.trim())missing=true});
    if(missing)throw new Error('Completa tutti i passaggi del procedimento.');return {steps};
  }
  if(l.response_type==='coordinate') return {x:$('#coordX').value.trim(),y:$('#coordY').value.trim()};
  if(l.response_type==='ordering') return {order:$('#answerValue').value.split(',').map(x=>x.trim()).filter(Boolean)};
  if(l.response_type==='matching'){const pairs={};document.querySelectorAll('.match').forEach(s=>pairs[s.dataset.left]=s.value);return {pairs}}
  return {value:$('#answerValue')?.value||''};
}

function feedback(msg,kind='info'){
  const b=$('#feedbackBox');b.className=`alert ${kind}`;b.textContent=msg;b.classList.remove('hidden');
}

async function submitAnswer(){
  try{
    const answer=collectAnswer(currentLevel), event={id:crypto.randomUUID(),class_code:session.class_code,resume_code:session.resume_code,session_id:session.session_id,level_key:currentLevel.key,answer,created_at:new Date().toISOString()};
    if(!navigator.onLine){queueEvent(event);feedback('Connessione assente: risposta conservata sul computer. Verrà verificata e salvata quando torni online.','warn');setSaveState('salvataggio in attesa','pending');return}
    setSaveState('salvataggio…','pending');
    let data;
    try{data=await sendEvent(event)}catch(err){
      if(!navigator.onLine || /fetch|network|rete|connessione/i.test(err.message)){queueEvent(event);setSaveState('salvataggio in attesa','pending');feedback('Connessione interrotta: il tentativo è in coda e verrà sincronizzato automaticamente.','warn');return}
      throw err;
    }
    setSaveState('salvato','ok');
    currentLevel.wrong_attempts=Number(data.wrong_attempts??currentLevel.wrong_attempts??0);
    currentLevel.solution_after_wrong_attempts=Number(data.solution_after_wrong_attempts??currentLevel.solution_after_wrong_attempts??3);
    currentLevel.solution_available=!!data.solution_available;
    updateSolutionGate();
    feedback(data.feedback|| (data.correct?'Risposta corretta.':'Riprova.'),data.correct?'ok':'bad');
    if(data.correct){
      await loadDashboard(); markLevelFinished(data.completed_status||'completed');
      const next=nextSummary(); if(next)feedback(`${data.feedback||'Corretto'} Puoi passare subito al livello ${next.order}.`,'ok');
    }
  }catch(e){feedback(e.message,'bad')}
}
async function sendEvent(ev){
  return rpc('student_submit_attempt',{p_class_code:ev.class_code,p_resume_code:ev.resume_code,p_session_id:ev.session_id||null,p_level_key:ev.level_key,p_client_event_id:ev.id,p_answer:ev.answer});
}
function queueEvent(ev){const q=pending();q.push(ev);saveQueue(q)}
async function syncQueue(){
  if(!navigator.onLine) return; let q=pending(); if(!q.length)return; setSaveState('sincronizzazione…','pending'); const rest=[];
  for(const ev of q){try{await sendEvent(ev)}catch(e){rest.push(ev)}} saveQueue(rest); setSaveState(rest.length?'salvataggio in attesa':'salvato',rest.length?'pending':'ok');
}

async function requestHint(){
  if(!navigator.onLine){feedback('Il suggerimento richiede una connessione perché viene registrato nel percorso.','warn');return}
  try{const d=await rpc('student_request_hint',{p_class_code:session.class_code,p_resume_code:session.resume_code,p_level_key:currentLevel.key});feedback(`Suggerimento: ${d.hint}`,'info');await loadDashboard()}catch(e){feedback(e.message,'bad')}
}
async function revealSolution(){
  if(!navigator.onLine){feedback('La soluzione può essere mostrata solo online, così viene registrata come aiuto.','warn');return}
  if(!currentLevel.solution_available){feedback('La soluzione non è ancora disponibile. Riprova il procedimento.','warn');return}
  if(!confirm('Mostrare la soluzione completerà questo livello “con aiuto”. Continuare?'))return;
  try{const d=await rpc('student_reveal_solution',{p_class_code:session.class_code,p_resume_code:session.resume_code,p_level_key:currentLevel.key});feedback(`Soluzione: ${d.solution}. ${d.explanation}`,'info');await loadDashboard();markLevelFinished('completed_help')}catch(e){feedback(e.message,'bad')}
}
async function skipLevel(){
  if(!navigator.onLine){feedback('Per saltare un livello serve la connessione.','warn');return}
  if(!confirm('Vuoi saltare questo livello? Verrà registrato come “saltato”, non come superato autonomamente.'))return;
  try{await rpc('student_skip_level',{p_class_code:session.class_code,p_resume_code:session.resume_code,p_level_key:currentLevel.key});feedback('Livello registrato come saltato.','warn');await loadDashboard();markLevelFinished('skipped')}catch(e){feedback(e.message,'bad')}
}

async function logout(){
  if(session && navigator.onLine){try{await rpc('student_exit',{p_class_code:session.class_code,p_resume_code:session.resume_code,p_session_id:session.session_id})}catch{}}
  clearSession();location.reload();
}

$('#joinBtn').onclick=join; $('#resumeBtn').onclick=resumeManual; $('#continueBtn').onclick=()=>{session=loadJSON(STORE,null);continueRemembered()}; $('#forgetBtn').onclick=()=>{clearSession();showLogin()}; $('#exitBtn').onclick=logout;
window.addEventListener('online',async()=>{await syncQueue();if(session)await loadDashboard()}); window.addEventListener('offline',()=>{setSaveState('offline · in attesa','pending');$('#offlineNotice').classList.remove('hidden')});
setInterval(()=>{if(session&&navigator.onLine&&pending().length)syncQueue().then(()=>loadDashboard()).catch(()=>{})},8000);

if('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(()=>{});
if(!configured()){showError('Questa copia non è ancora collegata al backend. Configura assets/js/config.js.');}
session=loadJSON(STORE,null);showLogin();
