import React,{useEffect,useRef,useState} from 'react';
import './score-tiles.css';

// Scores as mosaic tiles, in the Lantern Light style: one tile per question answered.
// Teal = right first time, amber = help used, coral = took another try. Tiles drop in one by one.
export function ScoreTiles({firstTry=0,answered=0,help=0,max=12,label}){
 const helped=Math.min(help,answered-firstTry),retried=Math.max(0,answered-firstTry-helped);
 const kinds=[...Array(firstTry).fill('is-first'),...Array(helped).fill('is-help'),...Array(retried).fill('is-retry')];
 const shown=kinds.slice(0,max),more=kinds.length-shown.length;
 const text=label||`${firstTry} of ${answered} right first time${help?`, help used ${help}`:''}`;
 return <span className="sc-tiles" role="img" aria-label={text} title={text}>{shown.map((k,i)=><i key={i} className={'sc-tile '+k} style={{'--i':i}}/>)}{more>0&&<b className="sc-more">+{more}</b>}</span>;
}
// Not played yet: dashed empty tiles, so "no data" never looks like a low score.
export function NotPlayed({count=3,text='Not played yet'}){
 return <span className="sc-empty"><span className="sc-tiles" aria-hidden="true">{Array.from({length:count},(_,i)=><i key={i} className="sc-tile is-empty" style={{'--i':i}}/>)}</span><span>{text}</span></span>;
}
// Numbers that count up once when they first appear (instant with reduced motion).
export function CountUp({value,duration=700}){
 const [shown,setShown]=useState(value),started=useRef(false);
 useEffect(()=>{
  const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.querySelector('.reduce-motion');
  if(started.current||reduce||!Number.isFinite(value)||value<=0){setShown(value);return}
  started.current=true;const t0=performance.now();let raf;
  const tick=t=>{const p=Math.min(1,(t-t0)/duration),e=1-Math.pow(1-p,3);setShown(Math.round(value*e));if(p<1)raf=requestAnimationFrame(tick)};
  setShown(0);raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[value]);
 return <>{shown}</>;
}
