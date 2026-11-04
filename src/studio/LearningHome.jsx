import {programmeCycles,cycleProgressText} from './cycle-navigation.js';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {programmeSteps,newlyDone,readSet,writeSet,weekSteps,addWeekSteps} from './celebrations.js';
import {ClassBoardCard} from './Classes.jsx';
import {canPrepare} from './client.js';
import {unitKey,formatName,makeProgramme} from './programme.js';
import {AssignmentShelf} from './CourseWorkspace.jsx';
import {templateArt} from './art.js';
const greeting=(h=new Date().getHours())=>h<12?'Good morning':h<18?'Good afternoon':'Good evening';
export function LearningHome({client,onContinue,onStart,onCourses,onBrowse,onProfile,busy}){
 const due=client.state.units.flatMap(u=>programmeCycles(client.cycles,u)).filter(c=>c.stage==='revisit'&&!c.waiting).sort((a,b)=>a.dueAt-b.dueAt)[0];
 const dueUnit=due&&client.state.units.find(u=>u.packId===due.packId&&u.contentHash===due.contentHash);
 const unit=dueUnit||client.state.units.find(u=>u.id===client.state.active)||client.state.units[0];
 const item=client.items.find(i=>unitKey(i.pack)===unit?.id),profile=client.journal.profile;
 let plan;try{if(item)plan=makeProgramme(item.pack,unit,client.journal.records)}catch{}
 const cycle=programmeCycles(client.cycles,unit)[0];
 const author=canPrepare(client),managed=!!client.journal.user&&!author;
 const first=String(client.journal.user?.name||'').trim().split(/\s+/)[0];
 const tiles=programmeSteps(client.state.units,client.items,client.journal.records),who=client.journal.user?.id;
 const fresh=useMemo(()=>newlyDone(tiles,readSet('tiles',who)),[who,tiles.map(t=>t.id+(t.done?1:0)).join()]);
 const counted=useRef(''),[steps,setSteps]=useState(()=>weekSteps(who));
 useEffect(()=>{writeSet('tiles',who,new Set(tiles.filter(t=>t.done).map(t=>t.id)));const sig=(who||'')+':'+[...fresh].join();if(fresh.size&&counted.current!==sig){counted.current=sig;setSteps(addWeekSteps(who,fresh.size))}});
 const done=tiles.filter(t=>t.done).length,cells=tiles.length?tiles:Array.from({length:12},(_,i)=>({id:"empty"+i,kind:'',done:false})),hasSaved=client.state.units.length>0;
 return <div className="learning-home"><div className="page-heading lh-hello"><div><h1>{greeting()}{first?', '+first:''}</h1><p>{profile.goal||'Choose a goal, bring your material, and take one useful step.'}</p></div><button onClick={onProfile}>Goals and preferences</button></div>
 <div className="lh-desk"><section className="lh-next"><div className="lh-next-art"><img src={item?templateArt(item.pack.template,item.pack.id):'/game-modes/art/room-quay.webp'} alt=""/><span className="lh-format">{item?formatName(item.pack.template):'Reviewed activities'}</span></div><div className="lh-next-copy"><span>{dueUnit?'Ready to revisit':item?'Continue where you left off':'A place to begin'}</span><h2>{item?.pack.title||(managed?'Your organiser’s reviewed activities':author?'What do you need to learn?':'Explore a reviewed activity')}</h2><p>{dueUnit?due.reason:cycle?cycleProgressText(cycle):plan?plan.reasons[0]:managed?'Your assigned activities appear below. Your own answers and progress stay with your account.':'Start from your own notes or explore an included activity. You can always change the format and the support you use.'}</p><div className="lh-chips"><span>About {profile.minutes} min</span>{item&&<span className="is-reviewed">Reviewed sources</span>}</div><div className="lh-actions">{item?<button className="primary" disabled={busy} onClick={()=>onContinue(unit.id,dueUnit?'cycle':'overview',dueUnit?due.bankId:null)}>{dueUnit?'Open my revisit':'Continue my programme'}</button>:<button className="primary" onClick={managed?onCourses:author?onCourses:onBrowse}>{managed?'See my assignments':author?'Organise my learning material':'Explore activities'}</button>}{author&&item&&<button className="text-button" onClick={onCourses}>Prepare another topic</button>}</div></div></section>
 <aside className="lh-side"><section className="lh-mosaic" aria-labelledby="lh-mosaic-title"><div className="lh-mosaic-head"><h2 id="lh-mosaic-title">Your mosaic</h2><span>{tiles.length?done+' of '+tiles.length+' steps':'No steps yet'}</span></div><div className="ll-tiles" role="img" aria-label={tiles.length?done+' of '+tiles.length+' programme steps finished':'No programme steps finished yet'}>{cells.map(t=><span key={t.id} className={'ll-tile'+(fresh.has(t.id)?' is-new':t.done?' '+t.kind:'')}/>)}</div><p>{tiles.length?'Each finished step places a tile: teal for reading and practice, coral for playing, violet for explaining.':'Your first finished step places a tile here.'}</p>{hasSaved&&<img className="lh-fox" src="/brand/fox-lantern.webp" alt=""/>}</section>
 <ClassBoardCard client={client} weekSteps={steps}/>
 <section className="lh-context"><h2>Your learning context</h2><dl><dt>Starting point</dt><dd>{profile.level}</dd><dt>Connect ideas to</dt><dd>{profile.interests.join(', ')||'Choose your interests'}</dd><dt>Give more attention to</dt><dd>{profile.struggles||'Use a starting question to find a focus.'}</dd><dt>Time for a session</dt><dd>{profile.minutes} minutes</dd></dl><p>Your choices. Change them any time.</p></section></aside></div>
 {managed&&<AssignmentShelf client={client} onStart={onStart} busy={busy}/>}
 <section className="lh-saved"><div className="section-heading"><h2>Keep learning</h2><button onClick={onBrowse}>Browse activities</button></div>{hasSaved?client.state.units.map(u=>{const i=client.items.find(i=>unitKey(i.pack)===u.id),c=programmeCycles(client.cycles,u).find(c=>c.stage==='revisit'&&!c.waiting);return <article key={u.id}>{i&&<img src={templateArt(i.pack.template,i.pack.id)} alt=""/>}<div><span>{i?formatName(i.pack.template):'Chapter unavailable'}</span><h3>{i?.pack.title||'Saved programme'}</h3><p>{c?'A revisit is ready.':u.profile?.goal||'Continue the source, practice and reflection route.'}</p></div><button disabled={busy||!i} onClick={()=>onContinue(u.id,c?'cycle':'overview',c?.bankId)}>Continue</button></article>}):<div className="lh-empty"><img src="/brand/fox-reading.webp" alt=""/><div><h3>Nothing saved yet</h3><p>Programmes you start are saved here, so you can pick up where you left off.</p></div><button className="primary" onClick={onBrowse}>Find something to explore</button></div>}</section>
 </div>;
}
