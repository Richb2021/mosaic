// Authored world rules. Topic packs supply only prose and a bounded field answer.
export const WORLD_ROOMS=['workshop','woods','archive','quay','garden','tower'];
export const TOKEN_ROOMS=['woods','quay','archive'];
export const RELAY_TARGET=[1,2,3];
export function worldSchema({obj,text,refs,room}){return obj({
 title:text(100),rooms:obj({quay:room,garden:room,tower:room}),
 after:obj(Object.fromEntries(WORLD_ROOMS.map(id=>[id,text(600)]))),
 delivery:obj({title:text(90),parcelName:text(60),offer:text(700),carrying:text(700),delivered:text(700),thanks:text(700),sourceRefs:refs}),
 field:obj({title:text(90),prompt:text(700),options:{type:'array',minItems:3,maxItems:3,items:text(240)},solution:{type:'integer',minimum:0,maximum:2},feedback:{type:'array',minItems:3,maxItems:3,items:text(700)},hint:text(500),sourceRefs:refs}),
 relay:obj({title:text(90),intro:text(700),success:text(700),sourceRefs:refs})
})}
export const WORLD_PROMPT=` Include world: a six-place connected adventure. Existing workshop/woods/archive rooms connect to world.rooms quay (riverside ferry landing), garden (walled conservatory garden) and tower (stone signal tower). Room art is fixed. Routes, gates and quest rules are authored, never supplied by the model. Main path: recover tool in woods, repair workshop, read archive, solve sequence, then complete a mechanical relay in tower and make the final choice there. The relay is a fictional noneducational three-wheel connector puzzle; do not invent its rules or equate its solution with learning. world.relay has title/intro/success/sourceRefs. Two optional requests: world.delivery starts at quay, gives parcelName to carry to garden, then return to quay for thanks and a quay–archive shortcut. Offer/carrying/delivered/thanks tell that coherent story, with sourceRefs. world.field is a separate supported application question at the garden, three options, one solution index and three explanatory feedback strings; cite exact evidence, provide hint. It unlocks a garden–archive shortcut. Distinguish fictional story stakes from subject facts. world.after descriptions replace room descriptions after workshop repair, archive solution, tower relay, delivery completion at quay, field success at garden, or finding a keepsake in woods. They describe changed objects and atmosphere without claiming unshown crowds. Three collectible trail tokens are authored scenery, not grades. Keep returning dialogue consistent. Endings occur at tower after the main puzzle and relay; optional requests can still finish afterwards. Do not claim a full curriculum is covered.`;
export function worldState(){return {delivery:0,field:{attempts:0,answer:null,solved:false,hinted:false},relay:{turns:[0,0,0],moves:0,solved:false},tokens:[],tracked:'main'}}
export const roomsOf=p=>p.world?{...p.rooms,...p.world.rooms}:p.rooms;
export function worldRoutes(s){const routes={workshop:['woods','quay','archive'],woods:['workshop','garden'],quay:['workshop','garden','tower'],garden:['woods','quay'],archive:['workshop','tower'],tower:['quay','archive']};if(s.world?.delivery===3){routes.quay.push('archive');routes.archive.push('quay')}if(s.world?.field.solved){routes.garden.push('archive');routes.archive.push('garden')}return routes;}
export function roomLock(s,id){return id==='archive'&&!s.repaired?'Restore the workshop mechanism to open the archive.':id==='tower'&&!s.solved?'Connect the archive evidence before climbing to the signal tower.':''}
export function worldAnchors(s,base){
 const rooms=Object.fromEntries(WORLD_ROOMS.map(id=>[id,{clue:{x:34,y:78},npc:{x:66,y:81}}]));
 for(const id of ['workshop','woods','archive'])for(const key of ['clue','npc','machine','tool','sequence'])if(base[id]?.[key])rooms[id][key]=base[id][key];
 rooms.quay.request={x:46,y:80};rooms.garden.request={x:47,y:80};rooms.garden.field={x:84,y:81};rooms.tower.relay={x:82,y:80};
 for(const id of TOKEN_ROOMS)if(!s.world.tokens.includes(id))rooms[id].token={x:22,y:84};
 for(const [id,exits] of Object.entries(worldRoutes(s)))exits.forEach((to,i)=>rooms[id][to]={x:8+i*82/Math.max(1,exits.length-1),y:85});return rooms;
}
export function worldChanged(s,id){return {workshop:s.repaired,archive:s.solved,tower:s.world.relay.solved,quay:s.world.delivery===3,garden:s.world.field.solved,woods:s.world.tokens.includes('woods')}[id]}
export function worldGoal(p,s){const w=s.world,r=roomsOf(p);if(w.tracked==='delivery')return w.delivery===0?`Ask at ${r.quay.title}: ${p.world.delivery.title}`:w.delivery===1?`Take ${p.world.delivery.parcelName} to ${r.garden.title}.`:w.delivery===2?`Return to ${r.quay.title} with the news.`:'Delivery complete. The quay shortcut is open.';if(w.tracked==='field')return w.field.solved?'Garden request complete. Its archive path is open.':`Read the garden clue, then try ${p.world.field.title}.`;if(s.completed)return 'The main story is complete. The remaining requests are yours to choose.';if(s.solved)return w.relay.solved?'Choose the story’s next step at the tower.':`Restore the signal in ${r.tower.title}.`;return null;}
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const count=n=>Number.isInteger(n)&&n>=0&&n<=100000;
export function validWorldState(s,p){
 const w=s.world;if(!exact(w,['delivery','field','relay','tokens','tracked'])||!Number.isInteger(w.delivery)||w.delivery<0||w.delivery>3||!['main','delivery','field'].includes(w.tracked))return false;
 if(s.inspected.some(id=>!s.visited.includes(id))||s.talked.some(id=>!s.visited.includes(id)))return false;
 const f=w.field,r=w.relay;if(!exact(f,['attempts','answer','solved','hinted'])||!count(f.attempts)||typeof f.hinted!=='boolean'||typeof f.solved!=='boolean'||!(f.answer===null||Number.isInteger(f.answer)&&f.answer>=0&&f.answer<3)||Boolean(f.attempts)!==(f.answer!==null)||f.solved!==(f.answer===p.world.field.solution))return false;
 if(!exact(r,['turns','moves','solved'])||!Array.isArray(r.turns)||r.turns.length!==3||!r.turns.every(n=>Number.isInteger(n)&&n>=0&&n<4)||!count(r.moves)||typeof r.solved!=='boolean'||r.solved&&!r.turns.every((v,i)=>v===RELAY_TARGET[i])||r.moves<r.turns.reduce((sum,n)=>sum+n,0))return false;
 if(!Array.isArray(w.tokens)||w.tokens.length>3||new Set(w.tokens).size!==w.tokens.length||!w.tokens.every(id=>TOKEN_ROOMS.includes(id)&&s.visited.includes(id)))return false;
 if(w.delivery>=1&&!s.visited.includes('quay')||w.delivery>=2&&!s.visited.includes('garden')||f.attempts&&!s.inspected.includes('garden')||f.hinted&&!s.visited.includes('garden')||r.moves&&!s.visited.includes('tower')||r.solved&&!s.solved||s.completed&&!r.solved)return false;
 return true;
}
export function worldAction(p,s,a){
 if(!p.world)return null;const w=s.world,room=roomsOf(p)[s.room],reply=(message,title='Along the thread',sourceRefs=[])=>({state:s,message,title,sourceRefs});
 if(a.type==='track'&&['main','delivery','field'].includes(a.quest)){w.tracked=a.quest;return reply('')}
 if(a.type==='token'&&TOKEN_ROOMS.includes(s.room)){if(!w.tokens.includes(s.room))w.tokens.push(s.room);return reply(`A trail token from ${room.title} joins your collection. ${w.tokens.length} of 3 found. These keepsakes record exploration, not learning.`, 'A small discovery')}
 if(a.type==='delivery'){
  const q=p.world.delivery;if(s.room==='quay'){if(w.delivery===0){w.delivery=1;return reply(q.offer,q.title,q.sourceRefs)}if(w.delivery===1)return reply(q.carrying,q.title,q.sourceRefs);if(w.delivery===2){w.delivery=3;return reply(q.thanks+' The quay–archive shortcut is now open.',q.title,q.sourceRefs)}return reply(q.thanks,q.title,q.sourceRefs)}
  if(s.room==='garden'){if(w.delivery===1){w.delivery=2;return reply(q.delivered,q.title,q.sourceRefs)}return reply(w.delivery>=2?q.delivered:`Someone at ${p.world.rooms.quay.title} has a parcel for this garden.`,q.title,q.sourceRefs)}return reply('Visit the quay or the garden to continue this request.');
 }
 if(a.type==='field-hint'&&s.room==='garden'){if(!w.field.solved)w.field.hinted=true;return reply(p.world.field.hint,p.world.field.title,p.world.field.sourceRefs)}
 if(a.type==='field-answer'&&s.room==='garden'){
  const q=p.world.field;if(!s.inspected.includes('garden'))return reply('Read the garden clue before deciding.',q.title,q.sourceRefs);if(!Number.isInteger(a.answer)||a.answer<0||a.answer>2)return reply('Choose one of the three proposals.');
  if(!w.field.solved){w.field.attempts=Math.min(100000,w.field.attempts+1);w.field.answer=a.answer;w.field.solved=a.answer===q.solution}return reply(q.feedback[w.field.answer]+(w.field.solved?' The garden–archive shortcut is now open.':''),q.title,q.sourceRefs);
 }
 if(a.type==='relay-turn'&&s.room==='tower'&&s.solved&&!w.relay.solved&&Number.isInteger(a.index)&&a.index>=0&&a.index<3){w.relay.turns[a.index]=(w.relay.turns[a.index]+1)%4;w.relay.moves=Math.min(100000,w.relay.moves+1);return reply('')}
 if(a.type==='relay-check'&&s.room==='tower'&&s.solved){const q=p.world.relay;if(w.relay.turns.every((v,i)=>v===RELAY_TARGET[i]))w.relay.solved=true;return reply(w.relay.solved?q.success:'The route is still broken. Turn each elbow until its two open sides match the engraved route beneath it.',q.title,q.sourceRefs)}
 return null;
}
