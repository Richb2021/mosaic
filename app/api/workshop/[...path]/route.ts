import {env} from 'cloudflare:workers';
import {workshopAPI} from '../../../../server/workshop-api.js';
import {deferWorkshopWork} from '../../../../server/execution-context';
import {ncbSession,noStore} from '../../../../server/ncb-auth.js';
export const dynamic='force-dynamic';
async function handle(request:Request){try{
 if(!new URL(request.url).pathname.endsWith('/health')&&!await ncbSession(request,env))return noStore({error:'Sign in to your learner account to open this private workspace library.'},401);
 return workshopAPI(request,env,{defer:deferWorkshopWork});
 }catch{return noStore({error:'The account service is unavailable. Your saved resources are unchanged.'},503)}}
export const GET=handle;
export const POST=handle;
