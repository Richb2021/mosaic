// Mosaic staging server. Runs the released app code with its own database and learner
// store, and replaces sign-in with staging test people (no passwords, nothing sent to NCB).
// The whole site sits behind a private access key. See docs/STAGING.md.
import {resolve} from 'node:path';
import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {SQLStore,ObjectStore} from '../../server/node/storage.mjs';
import {createApp} from '../../server/node/app.mjs';
import {createHTTPServer} from '../../server/node/http.mjs';
import {pilotAPI,learnerOwner} from '../../server/pilot-access.js';
import {learningAPI} from '../../server/learning-api.js';
import {workshopGateway} from '../../server/workshop-gateway.js';
import {mediaWorkerAPI} from '../../server/media-jobs.js';
import {StagingLearnerStore} from './learner-store.mjs';
import {seedStaging,SEED_PEOPLE,personaUser} from './seed.mjs';
import {installMetaRelay} from '../../server/node/meta-relay.mjs';
import {installDnsCache} from '../../server/node/dns-cache.mjs';
import {installKeepAliveFetch,warmConnections} from '../../server/node/keepalive-fetch.mjs';

process.umask(0o077);
if(installDnsCache())console.log('Outbound name lookups are cached.');
if(installKeepAliveFetch()){console.log('Account and progress service connections are kept open.');void warmConnections();}
if(installMetaRelay())console.log('Meta API calls go through the UK relay.');
const root=resolve(process.env.MOSAIC_APP_ROOT||process.cwd()),data=resolve(process.env.MOSAIC_DATA_DIR||resolve(root,'.staging-data'));
const origin=process.env.MOSAIC_PUBLIC_ORIGIN,key=process.env.STAGING_KEY||'',port=Number(process.env.PORT||3187);
if(!origin)throw Error('MOSAIC_PUBLIC_ORIGIN is required');if(key.length<32)throw Error('STAGING_KEY must be at least 32 characters');
const DB=new SQLStore(resolve(data,'application.sqlite'),{migrations:resolve(root,'drizzle')}),BUCKET=new ObjectStore(resolve(data,'objects.sqlite')),store=new StagingLearnerStore(resolve(data,'learner-store.sqlite'));
// Only these settings reach the app. NCB, gateway and maintenance secrets never do, even if present.
// AI keys are optional; staging has its own, lower spending caps (see docs/STAGING.md).
const PASS=['META_API_KEY','FISH_AUDIO_API_KEY','FISH_AUDIO_GUIDE_VOICE','FISH_AUDIO_LEARNER_VOICE','PILOT_DAILY_BUDGET_USD','PILOT_GLOBAL_DAILY_BUDGET_USD','WORKSHOP_GENERATION_LIMIT','MEDIA_WORKER_ENABLED','MAINTENANCE_SECRET','PILOT_OPEN_SIGNUP'];
const env={DB,BUCKET,PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(personaUser(SEED_PEOPLE[0])),...Object.fromEntries(PASS.filter(k=>process.env[k]).map(k=>[k,process.env[k]]))};
if(env.META_API_KEY&&!env.PILOT_GLOBAL_DAILY_BUDGET_USD)throw Error('Set staging spending caps before adding AI keys');
// Background work (generation jobs) runs after the response, as on live.
const pending=new Set(),defer=work=>{const t=Promise.resolve(work).catch(e=>console.error('background',e?.message)).finally(()=>pending.delete(t));pending.add(t)};
const people=DB.db;people.exec('CREATE TABLE IF NOT EXISTS staging_people(id TEXT PRIMARY KEY,name TEXT NOT NULL,note TEXT NOT NULL,created INTEGER NOT NULL)');
for(const p of SEED_PEOPLE)people.prepare('INSERT OR IGNORE INTO staging_people VALUES(?,?,?,?)').run(p.id,p.name,p.note,Date.now());
if(await seedStaging(env,store))console.log('Staging seeded with the sample course and people.');

const mac=v=>createHmac('sha256',key).update(v).digest('hex'),same=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
const ACCESS='mosaic_staging',PERSON='mosaic_staging_person';
const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(c=>c.trim().split('=')).filter(([k,v])=>k&&v).map(([k,...v])=>[k,decodeURIComponent(v.join('='))]));
const cookie=(name,value,age)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const personOf=c=>{const [id,sig]=(c[PERSON]||'').split('.');if(!id||!sig||!same(sig,mac('person:'+id)))return null;const p=people.prepare('SELECT * FROM staging_people WHERE id=?').get(id);return p?personaUser(p):null};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=(title,body,status=200,extra={})=>new Response(`<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#FBF6EC;color:#1D2440;margin:0;padding:24px}main{max-width:720px;margin:auto}h1{font-size:28px}.tag{display:inline-block;background:#F4B63F;border-radius:99px;padding:2px 10px;font-weight:700;font-size:13px}ul{list-style:none;padding:0}li{background:#fff;border:1px solid #E6DCC8;border-radius:16px;padding:14px 16px;margin:10px 0;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}small{color:#5A6078}button{font:inherit;font-weight:700;border-radius:99px;border:1.5px solid #1D2440;background:#fff;padding:8px 16px;cursor:pointer}button.primary{background:#F4B63F;border-color:#F4B63F}input{font:inherit;padding:9px 12px;border-radius:12px;border:1.5px solid #D8CCB3}form.inline{display:flex;gap:8px;flex-wrap:wrap}a{color:#5B3FB0}</style><main>${body}</main></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex',...extra}});
const redirect=(to,setCookies=[])=>{const h=new Headers({Location:to,'Cache-Control':'no-store'});for(const c of setCookies)h.append('Set-Cookie',c);return new Response(null,{status:303,headers:h})};
const BANNER=`<a href="/staging" style="position:fixed;left:50%;transform:translateX(-50%);top:4px;z-index:2147483647;background:#F4B63F;color:#1D2440;font:700 12px/1 system-ui,sans-serif;padding:7px 11px;border-radius:99px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.2)">STAGING · switch person</a>`;
const app=createApp(env,{staticDirectory:resolve(root,'public'),defer});

async function handle(request){
 const url=new URL(request.url),path=url.pathname,c=cookies(request);
 // The staging cartoon worker authenticates with its own maintenance secret, not the browser access key.
 if(path==='/api/media-worker')return request.method==='POST'?mediaWorkerAPI(request,env,{store}):Response.json({error:'Method not allowed.'},{status:405}); // staging's own learner store, not NCB
 if(path==='/staging/enter'){if(!same(url.searchParams.get('key')||'',key))return page('Staging','<h1>Wrong staging link</h1>',403);return redirect('/staging',[cookie(ACCESS,mac('access'),30*86400)])}
 if(!c[ACCESS]||!same(c[ACCESS],mac('access')))return path.startsWith('/api/')?Response.json({error:'Private staging site.'},{status:401}):page('Mosaic staging','<h1>Mosaic staging</h1><p>This is a private test copy. Open it with your staging link.</p>',401);
 const user=personOf(c);
 if(request.method==='POST'&&path.startsWith('/staging/')){
  if(request.headers.get('origin')!==url.origin)return page('Staging','<h1>Open this form on the staging site.</h1>',403);
  const form=new URLSearchParams(await request.text());
  if(path==='/staging/sign-in'){const p=people.prepare('SELECT id FROM staging_people WHERE id=?').get(form.get('id')||'');if(!p)return redirect('/staging');return redirect(form.get('next')==='welcome'?'/welcome.html':'/studio.html#today',[cookie(PERSON,p.id+'.'+mac('person:'+p.id),30*86400)])}
  if(path==='/staging/sign-out')return redirect('/staging',[cookie(PERSON,'',0)]);
  if(path==='/staging/people'){const name=(form.get('name')||'').trim().replace(/\s+/g,' ');if(!/^[\p{L}\p{N} .'-]{2,40}$/u.test(name))return redirect('/staging?error=name');
   const id='staging-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20)+'-'+crypto.randomUUID().slice(0,6);
   people.prepare('INSERT INTO staging_people VALUES(?,?,?,?)').run(id,name,'Added on staging. Not in any group until invited.',Date.now());
   return redirect('/welcome.html',[cookie(PERSON,id+'.'+mac('person:'+id),30*86400)])}
  return redirect('/staging');
 }
 if(path==='/staging'){
  const list=people.prepare('SELECT * FROM staging_people ORDER BY rowid').all();
  return page('Mosaic staging',`<p><span class="tag">STAGING</span></p><h1>Mosaic staging</h1><p>A private test copy running the released code with its own data. Pick a person to sign in as. No passwords; nothing here touches the live site or live accounts.</p>${user?`<p>Signed in as <b>${esc(user.name)}</b>. <a href="/studio.html#today">Open Mosaic</a></p><form method="post" action="/staging/sign-out"><button>Sign out</button></form>`:''}${url.searchParams.get('error')?'<p role="alert">Use 2 to 40 letters for a name.</p>':''}
<h2>People</h2><ul>${list.map(p=>`<li><div><b>${esc(p.name)}</b><br><small>${esc(p.note)}</small></div><form method="post" action="/staging/sign-in"><input type="hidden" name="id" value="${esc(p.id)}"><button class="primary">Sign in as ${esc(p.name.split(' ')[0])}</button></form></li>`).join('')}</ul>
<h2>Add a test person</h2><p>Like a new sign-up: they start with no group. Invite them from a teacher's Welcome page (optionally straight into a class); once they've joined, they can add more classes with a class code.</p><form class="inline" method="post" action="/staging/people"><input name="name" maxlength="40" placeholder="e.g. Noah Brown" required><button class="primary">Add and sign in</button></form>`);
 }
 if(path==='/api/auth/get-session')return Response.json({user:user?{id:user.id,email:user.email,name:user.name,emailVerified:true}:null,session:user?{userId:user.id}:null},{headers:{'Cache-Control':'no-store'}});
 if(path==='/api/auth/sign-out')return new Response(JSON.stringify({success:true}),{headers:{'Content-Type':'application/json','Set-Cookie':cookie(PERSON,'',0)}});
 if(path==='/api/auth-providers')return Response.json({providers:{}},{headers:{'Cache-Control':'no-store'}});
 if(path.startsWith('/api/auth/')||path.startsWith('/api/ncb/'))return Response.json({error:'Staging uses test people. Switch person at /staging.'},{status:404});
 const session=async()=>user;
 if(path==='/api/pilot')return pilotAPI(request,env,{store,session});
 if(path.startsWith('/api/learning/'))return learningAPI(request,env,{store,session});
 if(path.startsWith('/api/workshop/'))return workshopGateway(request,env,{store,session,defer});
 if(path==='/account'||path==='/account.html')return redirect('/staging');
 const res=await app(request);
 if((res.headers.get('content-type')||'').startsWith('text/html')){const html=(await res.text()).replace('</body>',BANNER+'</body>');const h=new Headers(res.headers);h.delete('content-length');h.set('X-Robots-Tag','noindex');return new Response(html.includes(BANNER)?html:html+BANNER,{status:res.status,headers:h})}
 res.headers.set?.('X-Robots-Tag','noindex');return res;
}
const server=createHTTPServer(handle,{origin,upstreamHost:'127.0.0.1:'+port}); // the worker calls in over loopback
server.listen(port,'127.0.0.1',()=>console.log('Mosaic staging listening on loopback port '+port));
const stop=()=>server.close(async()=>{await Promise.allSettled([...pending]);DB.close();BUCKET.close();store.close();process.exit(0)});process.on('SIGTERM',stop);process.on('SIGINT',stop);
