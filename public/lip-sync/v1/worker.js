/* Audio stays in this dedicated worker; the only fetches are same-origin models.
 * lip-sync-engine 1.0.3 / Rhubarb / PocketSphinx. See LICENSE.txt and provenance.json.
 */
let engine;
self.onmessage=async({data})=>{
 try {
  if(data.type==='init'){
   const base=new URL('.',self.location.href);
   const parts=await Promise.all([0,1,2].map(async i=>{const r=await fetch(new URL(`model-${i}.bin`,base));if(!r.ok)throw Error('Speech model unavailable');return new Uint8Array(await r.arrayBuffer());}));
   const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
   importScripts(new URL('lip-sync-engine.js',base).href);
   engine=await self.createLipSyncEngineModule({getPreloadedPackage:()=>bytes.buffer,locateFile:p=>new URL(p,base).href,print:()=>{},printErr:()=>{}});
   const path='/wasm/res',p=engine._malloc(64);engine.stringToUTF8(path,p,64);const ok=engine._lipsyncengine_init(p);engine._free(p);if(ok!==0)throw Error('Speech analyser could not initialise');self.postMessage({type:'ready'});
  }else if(data.type==='analyze'){
   if(!engine||!(data.pcm instanceof Int16Array)||data.pcm.length>16000*90||!data.pcm.length||typeof data.text!=='string'||data.text.length>500)throw Error('Invalid speech input');
   const m=engine,p=m._malloc(data.pcm.byteLength),size=m.lengthBytesUTF8(data.text)+1,t=m._malloc(size);let r=0;
   try{m.HEAP16.set(data.pcm,p/2);m.stringToUTF8(data.text,t,size);r=m._lipsyncengine_analyze_pcm16(p,data.pcm.length,16000,t);if(!r)throw Error('Speech analysis failed');self.postMessage({type:'result',id:data.id,result:JSON.parse(m.UTF8ToString(r))});}
   finally{m._free(p);m._free(t);if(r)m._lipsyncengine_free(r);}
  }
 }catch{self.postMessage({type:'error',id:data.id,error:'Speech animation could not be prepared. You can still listen and use the transcript.'});}
};
