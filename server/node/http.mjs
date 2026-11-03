import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createHash,timingSafeEqual} from 'node:crypto';

const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export function createHTTPServer(app,{origin,gatewayKey='',upstreamHost='',maxBodyBytes=16*1024*1024,onError=entry=>console.error(JSON.stringify(entry))}={}) {
  const publicURL=new URL(origin);
  if(!['https:','http:'].includes(publicURL.protocol)||publicURL.pathname!=='/'||publicURL.search||publicURL.username||publicURL.password)throw Error('Configure an exact public origin');
  if(gatewayKey&&gatewayKey.length<32)throw Error('Gateway key must be at least 32 characters');
  return createServer({requestTimeout:120000,headersTimeout:15000},async(req,res)=>{
    try {
      if(![publicURL.host,upstreamHost].filter(Boolean).includes(req.headers.host)) {res.writeHead(421);res.end();return;}
      if(gatewayKey&&!equal(String(req.headers['x-mosaic-gateway']||''),gatewayKey)){res.writeHead(403,{'Cache-Control':'no-store'});res.end();return;}
      if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end();return;}
      const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined&&!['host','connection','transfer-encoding','x-mosaic-gateway'].includes(key))headers.set(key,Array.isArray(value)?value.join(', '):value);
      const chunks=[];let size=0;
      const bodyLimit=req.url.split('?')[0]==='/api/media-worker'?64*1024*1024:maxBodyBytes;
      if(Number(headers.get('content-length'))>bodyLimit){res.writeHead(413);res.end();return;}
      for await (const chunk of req){size+=chunk.length;if(size>bodyLimit){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const method=req.method||'GET',body=size?Buffer.concat(chunks):undefined;
      if(['GET','HEAD'].includes(method)&&body){res.writeHead(400);res.end();return;}
      const response=await app(new Request(publicURL.origin+req.url,{method,headers,body}));
      res.statusCode=response.status;
      for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
      if(!response.body||method==='HEAD'){res.end();return;}
      const stream=Readable.fromWeb(response.body);res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
    }catch(error) {onError({event:'request-failed',method:req.method,route:req.url?.startsWith('/api/')?'/api/'+req.url.split('/')[2].split('?')[0]:'static',kind:['TypeError','RangeError','SyntaxError'].includes(error?.name)?error.name:'Error'});if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"The request could not be completed."}');}
  });
}
