import React,{useEffect,useRef,useState} from 'react';
import {CARTOON_SCENES} from './media/cartoon-assets.js';
import {CartoonPlayer} from './media/CartoonPlayer.jsx';
import {previewSets} from './media/story-backdrops.js';
// Author panel: backdrops made for this story with Muse Image. Learners see them only after approval;
// any scene without one keeps the standard setting.
export function backdropImage(client,job,style,scene,attempt){
 const q=new URLSearchParams({scriptId:job.id,style,scene,image:'1',...(Number.isInteger(attempt)?{attempt:String(attempt)}:{})});
 return fetch('/api/learning/creative/backdrops?'+q,{credentials:'same-origin',cache:'no-store',headers:{'X-Mosaic-Learner':client.journal.user?.id||''}}).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'Backdrop unavailable.');return r.blob()});
}
export function CartoonBackdrops({job,client,onChange=()=>{}}){
 const [data,setData]=useState(null),[style,setStyle]=useState('anime'),[places,setPlaces]=useState({}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[checked,setChecked]=useState(false),[thumbs,setThumbs]=useState({});
 const scope=useRef(0),urls=useRef([]);
 const set=data?.sets.find(s=>s.style===style)||null;
 async function load(){const n=scope.current,d=await client.journal.request('creative/backdrops?'+new URLSearchParams({scriptId:job.id}));if(n!==scope.current)return;setData(d);onChange(previewSets(d));return d}
 useEffect(()=>{scope.current++;setData(null);setError('');setNotice('');setChecked(false);void load().then(d=>{if(d?.sets[0])setStyle(d.sets[0].style)}).catch(e=>setError(e.message));return()=>{scope.current++}},[job.id,job.draftHash]);
 useEffect(()=>()=>{for(const u of urls.current)URL.revokeObjectURL(u)},[]);
 // Thumbnails for every finished picture in the chosen style.
 useEffect(()=>{if(!set)return;let active=true;for(const [scene,s] of Object.entries(set.scenes))s.attempts.forEach((a,i)=>{const key=[style,scene,i,a.created].join(':');if(a.status!=='ready'||thumbs[key])return;backdropImage(client,job,style,scene,i).then(b=>{if(!active)return;const u=URL.createObjectURL(b);urls.current.push(u);setThumbs(t=>({...t,[key]:u}))}).catch(()=>{})});return()=>{active=false}},[JSON.stringify(set),style]);
 const placeFor=scene=>places[style+':'+scene]??set?.scenes[scene]?.place??data?.suggestions[scene]??'';
 async function post(body,label){const n=scope.current;setBusy(label);setError('');try{const d=await client.journal.request('creative/backdrops',{scriptId:job.id,scriptHash:job.draftHash,style,...body});if(n!==scope.current)return null;setData(d);onChange(previewSets(d));if(d.notice)setNotice(d.notice);return d}catch(e){if(n===scope.current)setError(e.message);return null}finally{if(n===scope.current)setBusy('')}}
 async function make(scene){setChecked(false);return post({action:'generate',scene,place:placeFor(scene)},scene)}
 async function makeAll(){for(const scene of data.scenes){const s=set?.scenes[scene];if(s&&s.attempts.some(a=>a.status==='ready'))continue;if(s&&!s.canRetry)continue;const d=await make(scene);if(!d)break}}
 if(!data)return error?<section className="background-media"><h4>Backdrops made for this story</h4><p role="alert">{error}</p></section>:null;
 const cost=data.scenes.length*data.costPerImageUsd,approved=set?.status==='approved',ready=set&&Object.values(set.scenes).some(s=>s.attempts[s.chosen]?.status==='ready');
 return <section className="background-media cartoon-backdrops"><h4>Backdrops made for this story</h4>
  <p>The AI paints one backdrop for each setting this episode uses ({data.scenes.length}), so a story about the subject is set there. Each picture costs about ${data.costPerImageUsd.toFixed(2)} (about ${cost.toFixed(2)} for this episode) and counts toward your daily generation allowance. You can remake each one once. Learners only see them after you approve; any scene without one keeps the standard setting.</p>
  {!data.enabled&&<p role="status">Story backdrops are switched off for this site. The standard settings are used.</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <label>Art style<select value={style} disabled={!!busy} onChange={e=>{setStyle(e.target.value);setChecked(false)}}>{Object.entries(data.styles).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  <ul>{data.scenes.map(scene=>{const s=set?.scenes[scene],attempts=s?.attempts||[],pending=attempts.some(a=>a.status==='pending')||busy===scene;return <li key={scene}>
   <label>{CARTOON_SCENES[scene]?.label||scene} becomes<input maxLength={160} value={placeFor(scene)} disabled={!!busy||!data.enabled||attempts.length>=data.maxAttempts} onChange={e=>setPlaces(p=>({...p,[style+':'+scene]:e.target.value}))}/></label>
   <div className="cartoon-backdrop-attempts">{attempts.map((a,i)=>{const src=thumbs[[style,scene,i,a.created].join(':')];return <figure key={i} className={s.chosen===i?'is-chosen':''}>{a.status==='ready'?(src?<img src={src} alt={`Backdrop ${i+1} for ${CARTOON_SCENES[scene]?.label||scene}`} width="240" height="135"/>:<span className="subtle">Loading picture…</span>):<span className="subtle">{a.status==='pending'?'Being made…':a.error||'Not made.'}</span>}<figcaption>{a.status==='ready'?(s.chosen===i?'In use':<button disabled={!!busy} onClick={()=>post({action:'choose',scene,attempt:i},'choose')}>Use this one</button>):null}</figcaption></figure>})}</div>
   {data.enabled&&attempts.length<data.maxAttempts&&<button disabled={!!busy||pending} onClick={()=>make(scene)}>{pending?'Making backdrop… (about 20 seconds)':attempts.length?'Make again (last try)':'Make backdrop'}</button>}
  </li>})}</ul>
  {data.enabled&&data.scenes.some(scene=>!set?.scenes[scene])&&<button disabled={!!busy} onClick={makeAll}>{busy?'Making backdrops…':`Make all missing backdrops (about $${(data.scenes.filter(scene=>!set?.scenes[scene]).length*data.costPerImageUsd).toFixed(2)})`}</button>}
  {set&&(approved?<p role="status">Approved: learners see these backdrops. <button className="text-button" disabled={!!busy} onClick={()=>post({action:'withdraw'},'withdraw')}>Withdraw</button></p>:ready&&<><label className="check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked every picture: it fits the subject, has no writing, logos or people, and is suitable for every age.</label><button className="primary" disabled={!!busy||!checked} onClick={()=>post({action:'approve',confirmed:true},'approve')}>Approve backdrops for learners</button></>)}
  <p className="subtle">AI-generated scenery for a fictional story, not a diagram or evidence. The preview player above shows these pictures before approval.</p>
 </section>;
}
// The author's approved-script view: the player previews the chosen backdrops, the panel manages them.
export function AuthorCartoon({job,client,...player}){
 const [sets,setSets]=useState([]);
 const load=(style,scene,size)=>backdropImage(client,job,style,scene,size?.attempt);
 return <><CartoonPlayer {...player} backdrops={{sets,load}}/><CartoonBackdrops job={job} client={client} onChange={setSets}/></>;
}
