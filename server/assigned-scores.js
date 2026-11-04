// Scores on work a teacher assigned, from the learner's saved game results. Owner decision (4 Nov 2026):
// teachers see these whether or not the learner shares their self-reported updates. Only the assigned
// chapters' results are read; never other games, chats, profile or answers' wording.
import {sqlDB,parse} from './data-control.js';
import {validPracticeRecord} from '../src/game-modes/learning-model.js';
import {draftHash} from '../src/game-modes/draft-engine.js';

export async function assignedScores(env,store,g){
 const db=sqlDB(env.DB);let rows;
 try{rows=await store.list(g.learner)}catch{return {state:'unavailable',steps:[]}}
 const records=[];for(const r of rows||[]){try{const v={version:r.version,updated:Number(r.updated_ms),...JSON.parse(r.payload)};if(validPracticeRecord(v))records.push(v)}catch{}}
 const steps=[];
 for(const s of g.steps||[]){
  let pack=null;try{pack=parse((await db.one('SELECT draft FROM workshop_jobs WHERE id=?',s.jobId))?.draft)}catch{}
  const id=pack?.id,hash=pack?draftHash(pack):null;
  const mine=records.filter(r=>r.summary.packId===id).sort((a,b)=>(b.summary.contentHash===hash)-(a.summary.contentHash===hash)||b.updated-a.updated),r=mine[0];
  if(!r){steps.push({objectiveId:s.id,objective:s.objective,title:s.title,played:false});continue}
  const obs=r.summary.observations,answered=obs.filter(o=>o.attempts>0||o.correct!==null);
  steps.push({objectiveId:s.id,objective:s.objective,title:s.title,played:true,completed:r.summary.completed,answered:answered.length,firstTry:answered.filter(o=>o.correct===true&&o.attempts<=1&&!o.assisted).length,help:answered.filter(o=>o.assisted).length,updated:r.updated});
 }
 return {state:'ok',steps};
}
export function scoreSummary(list){
 const steps=list.flatMap(s=>s.steps||[]);
 return {total:steps.length,played:steps.filter(s=>s.played).length,completed:steps.filter(s=>s.completed).length,answered:steps.reduce((n,s)=>n+(s.answered||0),0),firstTry:steps.reduce((n,s)=>n+(s.firstTry||0),0),help:steps.reduce((n,s)=>n+(s.help||0),0)};
}
