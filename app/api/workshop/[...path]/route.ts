import {env} from 'cloudflare:workers';
import {workshopAPI} from '../../../../server/workshop-api.js';
import {deferWorkshopWork} from '../../../../server/execution-context';
import {digest} from '../../../../server/content-service.js';
import {withDataGuard} from '../../../../server/data-control.js';
import {enforceRetention} from '../../../../server/data-lifecycle.js';
import {NCBStore} from '../../../../server/ncb-store.js';
import {ncbSession,noStore} from '../../../../server/ncb-auth.js';
export const dynamic='force-dynamic';
async function handle(request:Request){try{
 if(new URL(request.url).pathname.endsWith('/health'))return workshopAPI(request,env);
 const user=await ncbSession(request,env);if(!user)return noStore({error:'Sign in to your learner account to open this private workspace library.'},401);
 const siteOwner=request.headers.get('oai-authenticated-user-id'),owner=await digest('mosaic-learner:'+user.id);
 if(request.method==='GET')await enforceRetention(env,{siteOwner,owner,store:new NCBStore(env),now:()=>Date.now()});
 return await withDataGuard(request,env,{owner,siteOwner},()=>workshopAPI(request,env,{defer:deferWorkshopWork}));
 }catch(e:any){return noStore({error:e.status?e.message:'The account service is unavailable. Your saved resources are unchanged.'},e.status||503)}}
export const GET=handle;
export const POST=handle;
