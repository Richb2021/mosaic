import {WORLD_PACKS} from '../game-modes/adventure-world-packs.js';
import {workshopRequest as resourceRequest} from '../resource-client.js';
import {learningJournal} from '../game-modes/learning-client.js';
import {ADVENTURE_PACKS} from '../game-modes/adventure-content.js';
import {DRAFT_PACKS} from '../game-modes/draft-content.js';
import {TOWN_PACKS} from '../game-modes/town-packs.js';
import {EXTENDED_PACKS} from '../game-modes/extended-packs.js';
import {RPG_PACKS} from '../../server/rpg-catalog.js';
import {emptyStudio,unitKey,newUnit,applyUnitAction,validateStudioShape,validateUnit} from './programme.js';
const LOCAL='mosaic:personal-studio:v1';
export class StudioClient{
 constructor(){this.state=emptyStudio();this.version=0;this.items=[];this.warning='';this.journal=learningJournal;}
 async load(){
  const previousUser=this.journal.user?.id;
  const session=await fetch('/api/auth/get-session',{credentials:'include',cache:'no-store'});if(!session.ok)throw Error('Your account could not be checked. Retry before opening personal progress.');
  await this.journal.connect();if(!this.journal.connected)throw Error(this.journal.notice||'Your account could not be loaded. Retry before changing saved preferences.');
  this.warning='';if(previousUser!==this.journal.user?.id||!this.journal.user)this.access=null;
  if(this.journal.user){const [catalog,saved,access]=await Promise.all([this.journal.request('studio/catalog'),this.journal.request('studio'),pilotRequest().catch(()=>{this.warning='Course preparation and group details are temporarily unavailable. Your available learning and saved programmes are still open. Reload to check group access again.';return null})]);this.items=catalog.items;this.state=saved.state;this.version=saved.version;this.remoteUnits=saved.units;this.cycles=saved.cycles||[];this.access=access;}
  else{this.items=[...RPG_PACKS,...WORLD_PACKS,...ADVENTURE_PACKS,...DRAFT_PACKS,...TOWN_PACKS,...EXTENDED_PACKS].map(pack=>({pack,jobId:null,origin:'Included reviewed activity'}));const raw=this.journal.storage.getItem(LOCAL);if(raw){try{const parsed=validateStudioShape(JSON.parse(raw));for(const u of parsed.units){const item=this.items.find(i=>unitKey(i.pack)===u.id);if(item)validateUnit(u,item.pack);}this.state=parsed;}catch{throw Error('The saved programme could not be read. Your record is preserved; do not reset it unless you have a recovery copy.');}}}
  this.journal.changed?.();
 }
 async refresh(){await this.load();}
 async change(input){
  if(this.busy)throw Error('A programme change is still saving.');this.busy=true;
  try{
   if(this.journal.user){const data=await this.journal.request('studio',{...input,expectedVersion:this.version});this.state=data.state;this.version=data.version;return;}
   let next=structuredClone(this.state);
   if(input.type==='activate'){if(!next.units.some(u=>u.id===input.id))throw Error('Programme not found.');next.active=input.id;}
   else if(input.type==='remove'){next.units=next.units.filter(u=>u.id!==input.id);if(next.active===input.id)next.active=next.units[0]?.id||null;}
   else{const item=this.items.find(i=>i.pack.id===input.packId&&unitKey(i.pack)===input.packId+':'+input.contentHash);if(!item)throw Error('This exact content version is not available.');const pack=item.pack,id=unitKey(pack);
    if(input.type==='create'){if(!input.evidenceConfirmed)throw Error('Review the sources first.');if(next.units.some(u=>u.id===id))throw Error('Continue your existing programme for this activity.');if(next.units.length>=12)throw Error('Keep up to twelve programmes. Remove one before adding another.');next.units.unshift(newUnit(pack,{...this.journal.profile,...(input.learningGoal!==undefined?{goal:input.learningGoal}:{})},input.activityKeys));next.active=id;}
    else next.units=next.units.map(u=>u.id===id?applyUnitAction(u,pack,{...input.action,...(input.action?.type==='replan'?{profile:this.journal.profile}:{})}):u);
   }
   this.journal.storage.setItem(LOCAL,JSON.stringify(next));this.state=next;
  }finally{this.busy=false;}
 }
}
export const canPrepare=client=>!!client.journal.user&&!!client.access&&(client.access.enabled===false||client.access.canAuthor&&client.access.onboarding?.ageBand==='18plus');
export async function pilotRequest(body){
 const r=await fetch('/api/pilot',{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Mosaic-Learner':learningJournal.user?.id||''},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Group access could not be checked.');return d;
}
let workshopEpoch='0:0';
export async function workshopRequest(path,body){const {data,epoch}=await resourceRequest(path,body,{dataEpoch:workshopEpoch});if(!body)workshopEpoch=epoch||workshopEpoch;return data;}
export function gameURL(item){const p=item.pack;if(p.template==='underlight-v1')return '/?'+new URLSearchParams({rpg:p.id,hash:unitKey(p).slice(p.id.length+1)});return '/modes.html?'+new URLSearchParams(item.jobId?{job:item.jobId}:{game:p.id});}
