// Mosaic tiles and chapter celebrations, built from each programme's real steps.
// Tiles count finished steps only; they never represent a score or mastery.
import {makeProgramme,unitKey} from './programme.js';

const KIND={read:'is-read',practice:'is-read',game:'is-play',reflect:'is-explain'};

// One entry per programme step, across every saved programme the learner has.
export function programmeSteps(units=[],items=[],records=[]){
  return units.flatMap(u=>{
    const item=items.find(i=>unitKey(i.pack)===u.id);if(!item)return [];
    try{return makeProgramme(item.pack,u,records).stages.map(s=>({id:u.id+':'+s.id,unitId:u.id,kind:KIND[s.id]||'is-read',done:!!s.done,optional:!!s.optional}))}
    catch{return []}
  });
}

// Steps finished since the learner last saw them. With no history (a new device), nothing is new.
export function newlyDone(steps,seen){
  if(!seen)return new Set();
  return new Set(steps.filter(s=>s.done&&!seen.has(s.id)).map(s=>s.id));
}

// Programmes whose required steps are all finished.
export function completedUnits(steps){
  const by=new Map();
  for(const s of steps){if(!by.has(s.unitId))by.set(s.unitId,[]);by.get(s.unitId).push(s)}
  return [...by].filter(([,list])=>{const req=list.filter(s=>!s.optional);return req.length>0&&req.every(s=>s.done)}).map(([id])=>id);
}

// The first newly completed programme to celebrate, or null. With no history, nothing is celebrated.
export function nextCelebration(steps,celebrated){
  if(!celebrated)return null;
  return completedUnits(steps).find(id=>!celebrated.has(id))||null;
}

// Per-device memory, keyed by account so a shared classroom device keeps learners apart.
const key=(name,user)=>`mosaic:${name}:${user||'guest'}`;
export function readSet(name,user,store=globalThis.localStorage){
  try{const raw=store?.getItem(key(name,user));return raw?new Set(JSON.parse(raw)):null}catch{return null}
}
export function writeSet(name,user,values,store=globalThis.localStorage){
  try{store?.setItem(key(name,user),JSON.stringify([...values].slice(-2000)))}catch{}
}

// Steps finished this week on this device, for the class leaderboard (sent only when the learner opts in).
export const weekOf=ms=>Math.floor((ms-4*86400000)/(7*86400000));
export function weekSteps(user,now=Date.now(),store=globalThis.localStorage){
 try{const v=JSON.parse(store?.getItem('mosaic:week-steps:'+(user||'guest'))||'{}');return v.week===weekOf(now)?v.count||0:0}catch{return 0}
}
export function addWeekSteps(user,n,now=Date.now(),store=globalThis.localStorage){
 if(!n)return weekSteps(user,now,store);const count=weekSteps(user,now,store)+n;
 try{store?.setItem('mosaic:week-steps:'+(user||'guest'),JSON.stringify({week:weekOf(now),count}))}catch{}
 return count;
}
