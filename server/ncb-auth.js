const BASE='https://app.nocodebackend.com/api/user-auth';
export const authCookies=request=>(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>/^(?:(?:__Secure-|__Host-))?better-auth\.[\w.-]+=/.test(s)).join('; ');
export const noStore=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function checkOrigin(req){if(req.method!=='GET'&&(req.headers.get('origin')!==new URL(req.url).origin||!req.headers.get('content-type')?.startsWith('application/json')))throw Object.assign(Error('Open this form on this site before saving.'),{status:403});}
export async function readJSON(req,limit=200000){const reader=req.body?.getReader();if(!reader)throw Object.assign(Error('A request body is required.'),{status:400});let length=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Object.assign(Error('This request is too large.'),{status:413});parts.push(value)}}finally{await reader.cancel().catch(()=>{})}const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw Object.assign(Error('Send a valid JSON request.'),{status:400})}}
export function ncbHeaders(req,env){return {'Content-Type':'application/json','X-Database-Instance':env.NCB_INSTANCE,Authorization:'Bearer '+env.NCB_SECRET_KEY,Cookie:authCookies(req),Origin:new URL(req.url).origin,'User-Agent':req.headers.get('user-agent')||'Lanternbound'};}
export async function ncbSession(req,env,fetcher=fetch){
 if(!env.NCB_INSTANCE||!env.NCB_SECRET_KEY||!authCookies(req))return null;
 const res=await fetcher(BASE+'/get-session?instance='+encodeURIComponent(env.NCB_INSTANCE)+'&disableCookieCache=true',{headers:ncbHeaders(req,env),cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!res.ok){if(res.status===401)return null;throw Object.assign(Error('Account service is unavailable. Your device save is safe.'),{status:503});}
 const data=await res.json();return data?.user&&typeof data.user.id==='string'?{id:data.user.id,name:String(data.user.name||''),email:String(data.user.email||''),emailVerified:data.user.emailVerified===true||data.user.emailverified===true||data.user.emailverified===1}:null;
}
const GET_PATHS=new Set(['get-session','providers']);
const POST_PATHS=new Set(['sign-in/email','sign-up/email','request-password-reset','reset-password','email-otp/send-verification-otp','sign-in/email-otp','sign-in/social','sign-out']);
export async function authAPI(req,env,fetcher=fetch){try{
 if(!env.NCB_INSTANCE||!env.NCB_SECRET_KEY)return noStore({error:'Learner accounts are not connected yet.'},503);
 const url=new URL(req.url),path=url.pathname==='/api/auth-providers'?'providers':url.pathname.replace(/^\/api\/auth\//,'');
 if(!(req.method==='GET'?GET_PATHS:POST_PATHS).has(path))return noStore({error:'Account route not found.'},404);
 checkOrigin(req);let body;
 if(req.method==='POST'){
  const data=await readJSON(req,16000),fields={
   'sign-in/email':['email','password','rememberMe'],'sign-up/email':['email','password','name'],
   'request-password-reset':['email'],'reset-password':['token','newPassword'],
   'email-otp/send-verification-otp':['email','type'],'sign-in/email-otp':['email','otp'],
   'sign-in/social':['provider'],'sign-out':[]};
  body=Object.fromEntries(fields[path].filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
  if(path==='request-password-reset')body.redirectTo=url.origin+'/account.html?view=reset';
  if(path==='sign-in/social'){if(!['google','apple'].includes(body.provider))return noStore({error:'Choose an enabled provider.'},400);body.callbackURL=url.origin+'/account.html?view=callback';}
 }
 const upstream=await fetcher(BASE+'/'+path+'?instance='+encodeURIComponent(env.NCB_INSTANCE)+(path==='get-session'?'&disableCookieCache=true':''),{method:req.method,headers:ncbHeaders(req,env),body:body?JSON.stringify(body):undefined,cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)});
 const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 const retryAfter=upstream.headers.get('retry-after');if(retryAfter&&/^\d{1,6}$/.test(retryAfter))headers.set('Retry-After',retryAfter);
 for(const cookie of upstream.headers.getSetCookie?.()||[]){const parts=cookie.split(';').map(s=>s.trim());parts[0]=parts[0].replace(/^(?:__Secure-|__Host-)/,'');const attrs=parts.slice(1).filter(s=>!/^domain=|^samesite=|^secure$/i.test(s));headers.append('Set-Cookie',[parts[0],...attrs,'SameSite=Lax',...(url.protocol==='https:'?['Secure']:[])].join('; '));}
 if(path==='sign-out'){const names=new Set(['better-auth.session_token','better-auth.session_data','better-auth.dont_remember','better-auth.account_data',...authCookies(req).split(';').map(s=>s.trim().split('=')[0]).filter(Boolean)]);for(const name of names)headers.append('Set-Cookie',`${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${url.protocol==='https:'?'; Secure':''}`);}
 // This lightweight app identity route omits session tokens. The maintained
 // Account component separately receives its documented session/device data.
 if(path==='get-session'){if(!upstream.ok)return noStore({user:null},upstream.status);const d=await upstream.json();return new Response(JSON.stringify({user:d?.user?{id:d.user.id,name:d.user.name,email:d.user.email}:null}),{headers});}
 const data=await upstream.json().catch(()=>({error:'The account service did not return a valid response.'}));
 if(path==='providers'){const p=data.providers||data;return noStore({providers:Object.fromEntries(['email','google','apple','emailOTP','public_signup'].map(k=>[k,p[k]===true||p[k]?.enabled===true]))},upstream.status);}
 delete data.token;delete data.session;return new Response(JSON.stringify(data),{status:upstream.status,headers});
 }catch(e){return noStore({error:e.status?e.message:'The account service could not complete the request. Please try again.'},e.status||503)}}
