import {CONFIG, configured} from './config.js';

const TKEY='cps_teacher_auth_v1';

function ensureConfigured(){
  if(!configured()) throw new Error('Backend non configurato: modifica assets/js/config.js');
}

async function request(path,{method='POST',body,teacher=false}={}){
  ensureConfigured();
  const token = teacher ? await teacherAccessToken() : CONFIG.SUPABASE_ANON_KEY;
  const headers={
    'apikey':CONFIG.SUPABASE_ANON_KEY,
    'Authorization':`Bearer ${token}`,
    'Content-Type':'application/json'
  };
  const res=await fetch(`${CONFIG.SUPABASE_URL}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(res.status===401 && teacher){
    const refreshed=await refreshTeacher();
    if(refreshed) return request(path,{method,body,teacher});
  }
  const text=await res.text();
  let data=null; try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!res.ok){
    const msg=data?.message||data?.msg||data?.error_description||data?.hint||`Errore ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function rpc(name,args={},teacher=false){
  return request(`/rest/v1/rpc/${name}`,{body:args,teacher});
}

export async function teacherSignIn(email,password){
  ensureConfigured();
  const res=await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',headers:{'apikey':CONFIG.SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const data=await res.json();
  if(!res.ok) throw new Error(data.error_description||data.msg||'Accesso non riuscito');
  sessionStorage.setItem(TKEY,JSON.stringify({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000,user:data.user}));
  return data.user;
}

export function teacherSession(){
  try{return JSON.parse(sessionStorage.getItem(TKEY)||'null');}catch{return null;}
}

async function teacherAccessToken(){
  const s=teacherSession(); if(!s) throw new Error('Sessione docente assente');
  if(s.expires_at-Date.now()<60000){const ok=await refreshTeacher(); if(!ok) throw new Error('Sessione docente scaduta');}
  return teacherSession().access_token;
}

export async function refreshTeacher(){
  const s=teacherSession(); if(!s?.refresh_token) return false;
  const res=await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',headers:{'apikey':CONFIG.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})
  });
  if(!res.ok){sessionStorage.removeItem(TKEY); return false;}
  const data=await res.json();
  sessionStorage.setItem(TKEY,JSON.stringify({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000,user:data.user}));
  return true;
}

export function teacherSignOut(){sessionStorage.removeItem(TKEY);}
export {configured, CONFIG};
