import React,{useEffect,useMemo,useRef,useState} from 'react';
import {programmeSteps,nextCelebration,completedUnits,readSet,writeSet} from './celebrations.js';
import {unitKey,formatName} from './programme.js';
import {templateArt} from './art.js';

// Shown once when a programme's required steps are all finished. Content stays usable:
// the dialog closes with Escape, the close button or either action.
const BITS=[[-420,-260,260,22,'#2BB8A6'],[380,-300,-200,18,'#FF7A59'],[-520,40,180,26,'#8B7CF6'],[540,20,320,20,'#FFB547'],[-300,300,-240,16,'#FF7A59'],[320,320,220,24,'#2BB8A6'],[-140,-360,140,14,'#FFB547'],[160,-380,-160,18,'#8B7CF6'],[-600,-120,300,14,'#2BB8A6'],[620,-140,-280,16,'#FF7A59']];
const STEP_WORDS={read:'read the source',practice:'practised the questions',game:'played the game',reflect:'explained it in your own words'};

export function ChapterCelebration({client,onToday,onTrail}){
  const who=client.journal.user?.id;
  const steps=programmeSteps(client.state.units,client.items,client.journal.records);
  const signature=steps.map(s=>s.id+(s.done?1:0)).join();
  const unitId=useMemo(()=>{
    const seen=readSet('celebrated',who);
    if(!seen){writeSet('celebrated',who,new Set(completedUnits(steps)));return null}
    return nextCelebration(steps,seen);
  },[who,signature]);
  const [closed,setClosed]=useState(null);
  const heading=useRef(null);
  const item=unitId&&closed!==unitId?client.items.find(i=>unitKey(i.pack)===unitId):null;
  const open=!!item;
  const close=then=>{const seen=readSet('celebrated',who)||new Set();seen.add(unitId);writeSet('celebrated',who,seen);setClosed(unitId);then?.()};
  useEffect(()=>{if(!open)return;heading.current?.focus();const onKey=e=>{if(e.key==='Escape')close()};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey)},[open]);
  if(!open)return null;
  const done=steps.filter(s=>s.unitId===unitId&&s.done).map(s=>STEP_WORDS[s.id.split(':').pop()]).filter(Boolean);
  const said=done.length>1?done.slice(0,-1).join(', ')+' and '+done.at(-1):done[0]||'finished every step';
  const art=templateArt(item.pack.template,item.pack.id);
  return <div className="celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
   <div className="celebration-bits" aria-hidden="true">{BITS.map(([x,y,r,s,c],n)=><span key={n} style={{'--x':x+'px','--y':y+'px','--r':r+'deg','--s':s+'px','--d':(.25+n*.03)+'s',background:c}}/>)}</div>
   <section className="celebration-card">
    <div className="celebration-art"><img src={art} alt={'Artwork for '+item.pack.title+', now complete'}/><div className="celebration-tiles" aria-hidden="true">{Array.from({length:32},(_,n)=><span key={n} style={{'--d':(.1+((n%8)+Math.floor(n/8))*.06)+'s',background:['#2BB8A6','#FF7A59','#8B7CF6','#FFB547'][(n*5)%4]}}/>)}</div><span className="celebration-format">{formatName(item.pack.template)}</span></div>
    <div className="celebration-copy"><h2 id="celebration-title" ref={heading} tabIndex={-1}>{item.pack.title} complete</h2><p>You {said}. The picture for this chapter is now complete.</p>
     <div className="celebration-actions"><button className="primary" onClick={()=>close(onTrail)}>See my trail</button><button onClick={()=>close(onToday)}>Back to Today</button></div></div>
    <button className="celebration-close" aria-label="Close" onClick={()=>close()}>×</button>
   </section>
   <img className="celebration-fox" src="/brand/fox-cheer.webp" alt=""/>
  </div>;
}
