// Calls to the account and progress services (NoCodeBackend) reuse open connections. Node's
// built-in fetch drops an idle connection after about 4 s, and opening a new one from Baldur takes
// ~1 s and sometimes stalls for 6-9 s; the service keeps idle connections for 45 s or more, and a
// reused one answers in ~0.17 s. Other hosts, and anything this wrapper can't send exactly
// (Request objects, streamed bodies), go to the normal fetch unchanged.
import https from 'node:https';

const HOSTS=new Set(['app.nocodebackend.com','eu-api.nocodebackend.com']);
const NO_BODY=new Set([101,204,205,304]);

export function keepAliveFetch({base=globalThis.fetch,hosts=HOSTS,protocol='https:',request=https.request,agent=new https.Agent({keepAlive:true,maxSockets:32,maxFreeSockets:8,timeout:60000,scheduling:'lifo'})}={}){
 const send=(url,init,body)=>new Promise((resolve,reject)=>{
  const signal=init.signal;
  if(signal?.aborted)return reject(signal.reason);
  const headers={};
  for(const [k,v] of new Headers(init.headers||{}))if(k!=='accept-encoding'&&k!=='connection')headers[k]=v;
  if(body!==undefined)headers['content-length']=String(body.length);
  let settled=false,received=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',onAbort);fn(value);};
  const req=request(url,{method:(init.method||'GET').toUpperCase(),headers,agent},res=>{
   received=true;const chunks=[];
   res.on('data',c=>chunks.push(c));
   res.on('error',e=>finish(reject,e));
   res.on('end',()=>{
    const out=new Headers();
    for(let i=0;i<res.rawHeaders.length;i+=2){try{out.append(res.rawHeaders[i],res.rawHeaders[i+1]);}catch{}}
    const status=res.statusCode||502;
    finish(resolve,new Response(NO_BODY.has(status)||req.method==='HEAD'?null:Buffer.concat(chunks),{status,statusText:res.statusMessage||'',headers:out}));
   });
  });
  const onAbort=()=>{req.destroy(signal.reason);finish(reject,signal.reason);};
  signal?.addEventListener('abort',onAbort,{once:true});
  req.on('error',error=>{
   // A kept connection the service closed just before we used it: nothing was received, so send again on a fresh one.
   if(!received&&req.reusedSocket&&!settled&&['ECONNRESET','EPIPE'].includes(error.code)){settled=true;signal?.removeEventListener('abort',onAbort);return send(url,init,body).then(resolve,reject);}
   finish(reject,error);
  });
  if(body!==undefined)req.write(body);
  req.end();
 });
 const wrapped=async(input,init={})=>{
  if(typeof input!=='string'&&!(input instanceof URL))return base(input,init);
  const url=new URL(String(input));
  if(url.protocol!==protocol||!hosts.has(url.hostname))return base(input,init);
  const raw=init.body;
  const body=raw==null?undefined:typeof raw==='string'?Buffer.from(raw):raw instanceof Uint8Array?Buffer.from(raw):null;
  if(body===null)return base(input,init);
  const res=await send(url,init,body);
  // Follow redirects the way fetch would, by handing a GET back to the normal fetch (the service doesn't redirect API calls today).
  if(res.status>=300&&res.status<400&&res.headers.has('location')&&init.redirect!=='manual'&&(init.method||'GET').toUpperCase()==='GET')return base(input,init);
  return res;
 };
 wrapped.agent=agent;
 return wrapped;
}

export function installKeepAliveFetch(env=process.env){
 if(env.MOSAIC_KEEPALIVE_FETCH==='off'||globalThis.fetch.mosaicKeepAlive)return false;
 const wrapped=keepAliveFetch();wrapped.mosaicKeepAlive=true;globalThis.fetch=wrapped;return true;
}

// Right after a restart the first visitor would pay for name lookups and new connections (about 5-10 s).
// One harmless request to each service opens a kept connection first; failures are ignored.
export function warmConnections(fetcher=globalThis.fetch,hosts=[...HOSTS]){
 return Promise.allSettled(hosts.map(h=>fetcher(`https://${h}/`,{method:'GET',signal:AbortSignal.timeout(15000)}).then(r=>r.arrayBuffer())));
}
