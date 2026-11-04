// Meta's API refuses requests from the API server's Netherlands address, so calls to
// api.meta.ai go through a small relay on the UK web host (deploy/20i/meta-relay.php).
// Every other request is untouched. Without META_RELAY_URL and META_RELAY_SECRET, nothing changes.
export function routeMetaThroughRelay({url,secret}={},base=globalThis.fetch){
 if(!url||!secret)return base;
 if(secret.length<32||!/^https:\/\//.test(url))throw Error('META_RELAY_URL must be https and META_RELAY_SECRET at least 32 characters');
 return async(input,init={})=>{
  const target=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
  if(target.origin!=='https://api.meta.ai')return base(input,init);
  const headers=new Headers(init.headers),body=init.body==null?undefined:typeof init.body==='string'?init.body:await new Response(init.body).text();
  return base(url,{method:'POST',signal:init.signal,redirect:'manual',headers:{'Content-Type':'application/json','X-Mosaic-Relay':secret},
   body:JSON.stringify({method:(init.method||'GET').toUpperCase(),path:target.pathname+target.search,authorization:headers.get('authorization')||'',...(body===undefined?{}:{body})})});
 };
}
export function installMetaRelay(env=process.env){
 if(!env.META_RELAY_URL)return false;
 globalThis.fetch=routeMetaThroughRelay({url:env.META_RELAY_URL,secret:env.META_RELAY_SECRET});return true;
}
