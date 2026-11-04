// Baldur's resolver answers each lookup from the network (20-100 ms) and sometimes stalls for
// 5-10 s. Every API request makes several calls to the account and progress services, so this
// keeps answers for a short while and, when a refresh is slow or fails, keeps using the last good
// answer while it retries in the background. IP addresses and localhost are never cached.
import dns from 'node:dns';
import {isIP} from 'node:net';

export function cachedLookup({lookup=dns.lookup.bind(dns),fresh=120000,stale=6*3600000,max=256,now=()=>Date.now()}={}) {
 const entries=new Map(),pending=new Map();
 const resolve=(host,family,done)=>{
  const key=host+'|'+family;
  if(pending.has(key)){pending.get(key).push(done);return;}
  pending.set(key,[done]);
  lookup(host,{family,all:true},(error,addresses)=>{
   const waiting=pending.get(key)||[];pending.delete(key);
   if(!error&&Array.isArray(addresses)&&addresses.length){
    entries.delete(key);entries.set(key,{addresses,at:now()});
    while(entries.size>max)entries.delete(entries.keys().next().value);
   }
   for(const callback of waiting)callback(error,addresses);
  });
 };
 return function mosaicLookup(host,options,callback) {
  if(typeof options==='function'){callback=options;options={};}
  else if(typeof options==='number')options={family:options};
  options=options||{};
  if(typeof host!=='string'||!host||isIP(host)||host==='localhost'||host.endsWith('.localhost'))return lookup(host,options,callback);
  const family=options.family===4||options.family===6?options.family:0,key=host+'|'+family,hit=entries.get(key);
  const reply=addresses=>{
   if(options.all)return callback(null,addresses.map(a=>({address:a.address,family:a.family})));
   callback(null,addresses[0].address,addresses[0].family);
  };
  const age=hit?now()-hit.at:Infinity;
  if(age<fresh){process.nextTick(reply,hit.addresses);return;}
  if(age<stale){process.nextTick(reply,hit.addresses);resolve(host,family,()=>{});return;}
  resolve(host,family,(error,addresses)=>error?callback(error):reply(addresses));
 };
}

export function installDnsCache(env=process.env) {
 if(env.MOSAIC_DNS_CACHE==='off'||dns.lookup.mosaicCache)return false;
 const lookup=cachedLookup();lookup.mosaicCache=true;dns.lookup=lookup;return true;
}
