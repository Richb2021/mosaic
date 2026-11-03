import {retiredHost} from "../../../../../server/retired-host.js";
import {env} from 'cloudflare:workers';
import {createNcbAccountProxy} from '@nocodebackend/account-react/next';
import {checkOrigin,authCookies,noStore,readJSON} from '../../../../../server/ncb-auth.js';
export const dynamic='force-dynamic';
async function handle(request:Request){try{
 const retired=retiredHost(env);if(retired)return retired;
 checkOrigin(request);
 if(!env.NCB_INSTANCE||!env.NCB_SECRET_KEY)return noStore({error:'Learner accounts are unavailable.'},503);
 const headers=new Headers(request.headers);headers.set('cookie',authCookies(request));headers.delete('authorization');
 const body=request.method==='POST'?JSON.stringify(await readJSON(request,16000)):undefined;
 const clean=new Request(request.url,{method:request.method,headers,body});
 const proxy=createNcbAccountProxy({instance:env.NCB_INSTANCE,secretKey:env.NCB_SECRET_KEY});
 const result=await proxy(clean,new URL(request.url).pathname.replace('/api/ncb/account/','').split('/'));
 result.headers.set('Cache-Control','no-store');return result;
 }catch(e){return noStore({error:'The account request could not be completed.'},e.status||503)}}
export const GET=handle;
export const POST=handle;
