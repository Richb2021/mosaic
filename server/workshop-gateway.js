import {assignedChapters} from './assignments.js';
import {workshopAPI} from './workshop-api.js';
import {ncbSession,noStore,checkOrigin} from './ncb-auth.js';
import {workspaceIdentity,requireAdmission} from './pilot-access.js';
import {withDataGuard} from './data-control.js';
import {enforceRetention} from './data-lifecycle.js';
import {registerRetentionSubject} from './background-retention.js';
import {NCBStore} from './ncb-store.js';
export async function workshopGateway(req,env,{session=ncbSession,store=new NCBStore(env),now=()=>Date.now(),...options}={}){try{
 checkOrigin(req);const user=await session(req,env);if(!user)return noStore({error:'Sign in to your learner account to open your resource library.'},401);
 if(req.headers.get('X-Mosaic-Learner')!==user.id)return noStore({error:'Your learner account changed. Reload before opening the library.'},401);
 const ctx={...await workspaceIdentity(user,env),store,now};const access=await requireAdmission(env,ctx.principal,{store,onboarding:true,storageOwner:ctx.owner});
 if(req.method!=='GET'&&env.PILOT_ENABLED==='true'&&(!access.canAuthor||access.ageBand!=='18plus'))return noStore({error:'Your organiser prepares and reviews learning material for your managed account. You can play assigned chapters and save your progress.'},403);
 await registerRetentionSubject(env,{...ctx,now:now()});
 if(req.method==='GET')await enforceRetention(env,ctx);
 return await withDataGuard(req,env,ctx,async()=>{
 const match=new URL(req.url).pathname.match(/^\/api\/workshop\/jobs\/([^/]+)$/);
 if(req.method==='GET'&&match){const assigned=(await assignedChapters(env,ctx.owner)).find(j=>j.id===match[1]);if(assigned)return noStore({job:{id:assigned.id,status:'published',draft:JSON.parse(assigned.draft),readOnly:true}});}
 return workshopAPI(req,env,{...options,now,owner:ctx.siteOwner,learnerOwner:ctx.owner});
 });
}catch(e){return noStore({error:e.status?e.message:'Your resource library is temporarily unavailable.'},e.status||503)}}
