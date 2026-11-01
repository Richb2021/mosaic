import {validSave,hashPack} from './engine.js';
import {contentKey} from './chapter.js';
import {storyHash} from './quests.js';
import {draftHash} from './game-modes/draft-engine.js';

// A save belongs to the complete authored world and the exact reviewed chapter.
// Snapshots restore play; they are not a replay-verified assessment record.
export function rpgBundle(world,settlement,chapter){
 if(!chapter||chapter.topicId!==world.id)throw Error('This chapter belongs to a different world.');
 return {id:'rpg-'+chapter.id,template:'underlight-v1',title:chapter.title,world,settlement,chapter,sources:chapter.sources};
}
export const rpgSaveKey=bundle=>`lanternbound:rpg:v2:${bundle.id}:${draftHash(bundle)}`;
export function validateRPGSave(raw,bundle){
 const need=(v,m)=>{if(!v)throw Error(m)};
 need(bundle?.world&&bundle?.settlement&&bundle?.chapter,'The complete adventure content is required.');
 const s=validSave(raw,bundle.world),c=bundle.chapter;
 need(s,'This adventure save cannot be restored.');
 need(s.pack===hashPack(bundle.world)&&s.chapter.content===contentKey(c),'This save belongs to another chapter revision.');
 need(s.questContent===storyHash(bundle.settlement),'This save belongs to another settlement.');
 for(const [id,v] of Object.entries(s.quests)){
  const q=bundle.settlement.quests.find(q=>q.id===id);
  need(q&&v.step<=q.steps.length&&v.completed===(v.step===q.steps.length)&&v.rewarded===v.completed,'A saved quest does not match this story.');
 }
 need(s.chapter.mechanisms.balance<=c.challenges.balance.total,'The saved allocation exceeds this chapter’s supply.');
 for(const id of s.chapter.solved){
  const expected=c.challenges[id].solution,actual=s.chapter.mechanisms[id];
  need(JSON.stringify(actual)===JSON.stringify(expected)&&s.chapter.attempts[id]>0,'A restored mechanism does not match the reviewed solution.');
 }
 need(s.seals.every(id=>s.attempts[id]>0),'Restored seals need a recorded attempt.');
 need(!s.defeated.includes('guardian')||s.seals.length===4,'The final encounter requires all four seals.');
 // Never retain arbitrary objects smuggled into otherwise valid party/position fields.
 s.pos={x:s.pos.x,z:s.pos.z};s.party=s.party.map(h=>({name:h.name,hp:h.hp,mp:h.mp}));
 s.chapter.party=s.chapter.party.map(h=>({hp:h.hp,mp:h.mp}));
 s.chapter.mechanisms={route:[...s.chapter.mechanisms.route],balance:s.chapter.mechanisms.balance,transfer:[...s.chapter.mechanisms.transfer]};
 if(s.chapter.battle)s.chapter.battle.foes=s.chapter.battle.foes.map(f=>({kind:f.kind,hp:f.hp,exposed:f.exposed}));
 return s;
}
