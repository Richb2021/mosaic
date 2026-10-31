import {BUILDINGS} from './interiors.js';

export function validateSettlement(raw){
 const s=structuredClone(raw),str=(v,n=1800)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
 if(s?.version!==1||!Array.isArray(s.quests)||s.quests.length>6||new Set(s.quests.map(q=>q?.id)).size!==s.quests.length)throw Error('A settlement needs version 1 and up to six unique quests.');
 for(const q of s.quests){
  if(!q||!str(q.id,40)||['constructor','prototype','__proto__'].includes(q.id)||!/^[a-z][a-z0-9-]*$/.test(q.id)||!str(q.title,100)||!Object.hasOwn(BUILDINGS,q.giver)||!str(q.offer)||!str(q.done)||!Array.isArray(q.steps)||q.steps.length<2||q.steps.length>8)throw Error('Quest identity, resident or steps are invalid.');
  if(!q.reward||!Number.isInteger(q.reward.gold)||q.reward.gold<0||q.reward.gold>100||!Number.isInteger(q.reward.xp)||q.reward.xp<0||q.reward.xp>40)throw Error('Quest rewards exceed the allowed range.');
  for(const step of q.steps){
   if(!Object.hasOwn(BUILDINGS,step.location)||!['resident','ledger','workbench'].includes(step.target)||!str(step.title,120)||!str(step.text)||!str(step.after))throw Error('Every quest step needs a place, interaction and story text.');
   const c=step.challenge;if(!c)continue;
   if(!str(c.prompt)||!str(c.hint)||!str(c.explanation))throw Error('A quest task needs a prompt, hint and explanation.');
   if(c.type==='allocation'){
    if(!Number.isInteger(c.total)||c.total<2||c.total>20||!Number.isInteger(c.solution)||c.solution<0||c.solution>c.total||!Array.isArray(c.labels)||c.labels.length!==2||c.labels.some(l=>!str(l,80))||!str(c.unit,60))throw Error('Invalid quest allocation.');
   }else if(c.type==='choice'){
    if(!Array.isArray(c.options)||c.options.length<2||c.options.length>4||c.options.some(o=>!str(o,240))||!Number.isInteger(c.solution)||c.solution<0||c.solution>=c.options.length)throw Error('Invalid quest decision.');
   }else throw Error('Unsupported quest task.');
  }
  const last=q.steps.at(-1);if(last.location!==q.giver||last.target!=='resident'||last.challenge)throw Error('Return to the quest giver for the final step.');
 }
 for(const section of ['residentLines','clues']){if(s[section]!==undefined&&(typeof s[section]!=='object'||s[section]===null||Array.isArray(s[section])||Object.entries(s[section]).some(([id,t])=>!Object.hasOwn(BUILDINGS,id)||!str(t))))throw Error('Invalid settlement dialogue.');}
 return s;
}
export function storyHash(story){let h=2166136261;for(const c of JSON.stringify(story.quests.map(q=>({id:q.id,giver:q.giver,reward:q.reward,steps:q.steps.map(st=>({location:st.location,target:st.target,challenge:st.challenge?{type:st.challenge.type,solution:st.challenge.solution,total:st.challenge.total}:null}))}))))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36)}
export function bindSettlement(s,story){
 const hash=storyHash(story);
 if(s.questContent!==hash){s.questContent=hash;for(const [id,v] of Object.entries(s.quests)){const q=story.quests.find(q=>q.id===id);if(v.completed&&q)v.step=q.steps.length;else delete s.quests[id];}s.trackedQuest=null;}
 for(const [id,v] of Object.entries(s.quests)){
  const q=story.quests.find(q=>q.id===id);
  if(!q||v.step>q.steps.length||v.completed!==(v.step===q.steps.length)||v.rewarded!==v.completed)delete s.quests[id];
 }
 if(!s.quests[s.trackedQuest]||s.quests[s.trackedQuest].completed)s.trackedQuest=null;
}
export function acceptQuest(s,story,id){
 const q=story.quests.find(q=>q.id===id);if(!q||s.interior!==q.giver||s.quests[id])return false;
 s.quests[id]={step:0,completed:false,rewarded:false,attempts:0};s.trackedQuest=id;return true;
}
export function advanceQuest(s,story,id,target,value){
 const q=story.quests.find(q=>q.id===id),v=s.quests[id];if(!q||!v||v.completed)return {ok:false,message:'This request is not active.'};
 const step=q.steps[v.step];if(s.interior!==step.location||target!==step.target)return {ok:false,message:'Follow the next lead in your quest journal.'};
 if(step.challenge){
  v.attempts=Math.min(100000,v.attempts+1);const c=step.challenge;
  if(!Number.isInteger(value)||value!==c.solution)return {ok:false,message:'That plan does not fit the clues yet. '+c.hint};
 }
 v.step++;let reward='';
 if(v.step===q.steps.length){v.completed=true;v.rewarded=true;s.gold=Math.min(9999,s.gold+q.reward.gold);s.xp=Math.min(10000,s.xp+q.reward.xp);if(s.trackedQuest===id)s.trackedQuest=null;reward=`${q.reward.gold} coins · ${q.reward.xp} XP`;}
 return {ok:true,completed:v.completed,text:v.completed?q.done:step.after,reward};
}
export const currentQuestStep=(s,story,id)=>{const q=story.quests.find(q=>q.id===id),v=s.quests[id];return q&&v&&!v.completed?q.steps[v.step]:null};
export const questsAt=(s,story,target)=>story.quests.filter(q=>{const st=currentQuestStep(s,story,q.id);return st?.location===s.interior&&st.target===target});

// Legacy/custom packs without a settlement still reuse their own learning task.
// Exporting a pack includes this editable story rather than inventing new facts.
export function fallbackSettlement(pack){
 const a=pack.puzzles.allocation;
 return validateSettlement({version:1,quests:[{id:'community',title:'A place at the table',giver:'inn',offer:'Maren wants to bring the neighbours together. A delivery has arrived with instructions nobody quite understands. Could you help the household make a workable plan?',done:'The neighbours finally sit down together. Maren pins your plan beside the kitchen door so the next traveller can follow it too.',reward:{gold:40,xp:12},steps:[
  {location:'millhouse',target:'resident',title:'Ask Rook about the delivery',text:pack.dialogue.mill,after:'You copy Rook’s explanation. The household ledger at the Copper Oven holds the instructions.'},
  {location:'bakery',target:'ledger',title:'Read the Copper Oven ledger',text:a.prompt,after:'You bring the instructions back to Maren’s supper table.'},
  {location:'inn',target:'workbench',title:'Make the household plan',text:'Maren clears the table. You can move the counters until the plan satisfies the delivery instructions.',after:a.explanation,challenge:{...a,type:'allocation'}},
  {location:'inn',target:'resident',title:'Tell Maren the plan is ready',text:'The plan is ready. Maren asks what made it work.',after:'The household is ready.'},
 ]}]});
}
