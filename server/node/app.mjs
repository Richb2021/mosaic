import {createReadStream,realpathSync} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {Readable} from 'node:stream';
import {createNcbAccountProxy} from '@nocodebackend/account-react/next';
import {authAPI,authCookies,checkOrigin,noStore,readJSON} from '../ncb-auth.js';
import {pilotAPI} from '../pilot-access.js';
import {learningAPI} from '../learning-api.js';
import {workshopGateway} from '../workshop-gateway.js';
import {maintenanceAPI} from '../background-retention.js';
import {mediaWorkerAPI} from '../media-jobs.js';
import {operationsAPI} from '../launch-operations.js';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.map':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm'};
const aliases={'/':'/index.html','/studio':'/studio.html','/account':'/account.html','/welcome':'/welcome.html','/cartoons':'/cartoons.html'};

async function accountProxy(request,env) {
  try {
    checkOrigin(request);
    if(!env.NCB_INSTANCE||!env.NCB_SECRET_KEY)return noStore({error:'Learner accounts are unavailable.'},503);
    const headers=new Headers(request.headers);headers.set('cookie',authCookies(request));headers.delete('authorization');
    const body=request.method==='POST'?JSON.stringify(await readJSON(request,16000)):undefined;
    const clean=new Request(request.url,{method:request.method,headers,body});
    const result=await createNcbAccountProxy({instance:env.NCB_INSTANCE,secretKey:env.NCB_SECRET_KEY})(clean,new URL(request.url).pathname.replace('/api/ncb/account/','').split('/'));
    result.headers.set('Cache-Control','no-store');return result;
  } catch(error) {return noStore({error:'The account request could not be completed.'},error.status||503);}
}

export function createApp(env,{staticDirectory,defer=()=>{}}) {
  const root=realpathSync(resolve(staticDirectory));
  return async request=>{
    const url=new URL(request.url),path=url.pathname;
    if(path.startsWith('/api/')) {
      if(!['GET','POST'].includes(request.method))return noStore({error:'Method not allowed.'},405);
      if(path==='/api/auth-providers'||path.startsWith('/api/auth/'))return authAPI(request,env);
      if(path.startsWith('/api/ncb/account/'))return accountProxy(request,env);
      if(path==='/api/pilot')return pilotAPI(request,env);
      if(path.startsWith('/api/learning/'))return learningAPI(request,env);
      if(path.startsWith('/api/workshop/'))return workshopGateway(request,env,{defer});
      if(path==='/api/maintenance')return maintenanceAPI(request,env);
      if(path==='/api/operations')return operationsAPI(request,env);
      if(path==='/api/media-worker')return request.method==='POST'?mediaWorkerAPI(request,env):noStore({error:'Method not allowed.'},405);
      return noStore({error:'Not found.'},404);
    }
    if(!['GET','HEAD'].includes(request.method))return noStore({error:'Method not allowed.'},405);
    let decoded;
    try {decoded=decodeURIComponent(aliases[path]||path);}catch{return noStore({error:'Not found.'},404);}
    if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(p=>p.startsWith('.')))return noStore({error:'Not found.'},404);
    let file,info;
    try {file=await realpath(resolve(root,'.'+decoded));if(!file.startsWith(root+sep))throw Error();info=await stat(file);if(!info.isFile())throw Error();}
    catch{return noStore({error:'Not found.'},404);}
    const headers=new Headers({'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=300','Accept-Ranges':'bytes'});
    let start=0,end=info.size-1,status=200;
    if(request.headers.has('range')) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range'));
      if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});
      if(!match[1])start=Math.max(0,info.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});
      status=206;headers.set('Content-Range',`bytes ${start}-${end}/${info.size}`);
    }
    headers.set('Content-Length',String(Math.max(0,end-start+1)));
    return new Response(request.method==='HEAD'||!info.size?null:Readable.toWeb(createReadStream(file,{start,end})),{status,headers});
  };
}
