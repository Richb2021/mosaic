import {resolve} from 'node:path';
import {SQLStore,ObjectStore} from './storage.mjs';
import {createApp} from './app.mjs';
import {createHTTPServer} from './http.mjs';

process.umask(0o077);
const root=resolve(process.env.MOSAIC_APP_ROOT||process.cwd());
const data=resolve(process.env.MOSAIC_DATA_DIR||resolve(root,'.mosaic-data'));
const staticDirectory=resolve(root,'public');
if(data===staticDirectory||data.startsWith(staticDirectory+'/'))throw Error('Private storage must be outside public assets');
if(!process.env.MOSAIC_PUBLIC_ORIGIN)throw Error('MOSAIC_PUBLIC_ORIGIN is required');
const port=Number(process.env.PORT||3185);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
const DB=new SQLStore(resolve(data,'application.sqlite'),{migrations:resolve(root,'drizzle')}),BUCKET=new ObjectStore(resolve(data,'objects.sqlite'));
const env={...process.env,DB,BUCKET},pending=new Set();
const defer=work=>{const tracked=Promise.resolve(work).catch(()=>{}).finally(()=>pending.delete(tracked));pending.add(tracked);};
const server=createHTTPServer(createApp(env,{staticDirectory,defer}),{origin:process.env.MOSAIC_PUBLIC_ORIGIN,gatewayKey:process.env.MOSAIC_GATEWAY_KEY,upstreamHost:process.env.MOSAIC_UPSTREAM_HOST});
server.listen(port,'127.0.0.1',()=>console.log('Mosaic listening on loopback port '+port));
let closing=false;
async function shutdown(){if(closing)return;closing=true;const deadline=setTimeout(()=>process.exit(1),60000);deadline.unref();await new Promise(resolve=>server.close(resolve));await Promise.allSettled([...pending]);DB.close();BUCKET.close();clearTimeout(deadline);}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
