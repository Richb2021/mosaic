import {supportLink} from '../studio/support-link.js';
import '../studio/support-link.css';
import {validateAdventureContent} from './adventure-content.js';
import {adventureAnchors,adventureSaveKey,initialAdventureState,validateAdventureSave,adventureGoal,reduceAdventure} from './adventure-engine.js';
import './adventure-style.css';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const safeURL=u=>typeof u==='string'&&/^\/game-modes\/(?:art|extended-art|depth-art)\/[a-zA-Z0-9_./-]+$/.test(u)&&!u.includes('..')?u:'';
const roomNames={workshop:'Workshop',woods:'Woodland path',archive:'Archive'};
const button=(label,action,extra='',className='')=>`<button type="button" class="${className}" data-adventure="${action}" ${extra}>${label}</button>`;

export function mountAdventure(container,{pack:raw,assets={},onExit=()=>{},onLibrary=()=>{},onProgress=()=>{},storage=localStorage}={}){
 const pack=validateAdventureContent(raw),anchors=adventureAnchors(pack),saveKey=adventureSaveKey(pack);let state=initialAdventureState(pack),storageNotice='',panel=null,selectedItem=null,destination=null,arrival=null,verb='look',raf=0,last=performance.now(),animation='idle',animationTime=0,moving=false,disposed=false,saveDue=0,feedback='',previousFocus=null;
 const keys=new Set(),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 try{const stored=storage.getItem(saveKey);if(stored){const valid=validateAdventureSave(stored,pack);if(valid)state=valid;else storageNotice='An incompatible save was ignored. A new adventure is ready.'}}catch{storageNotice='Saving is unavailable. This adventure will last for this visit.'}
 function persist(){try{storage.setItem(saveKey,JSON.stringify(state));if(storageNotice.startsWith('Saving'))storageNotice='';}catch{storageNotice='Saving is unavailable. Keep this page open to retain your adventure.'}onProgress({pack,record:state,kind:'classic'});}
 function icon(key,alt=''){const url=safeURL(assets.icons?.[key]);return url?`<img src="${esc(url)}" alt="${esc(alt)}" draggable="false">`:''}
 function refs(ids){return ids?.length?`<details class="atlas-evidence"><summary>Read the source</summary>${ids.map(id=>{const s=pack.sources.find(x=>x.id===id);return s?`<article><h4>${esc(s.title)}</h4><small>${esc(s.locator)}</small><p>${esc(s.excerpt)}</p></article>`:''}).join('')}</details>`:''}
 function stop(){destination=null;arrival=null;moving=false;keys.clear();}
 function focusToken(element){
  if(!element||!container.contains(element))return null;
  if(element.id)return {id:element.id};
  const control=element.closest('[data-adventure]');
  return control?{data:{...control.dataset},label:control.getAttribute('aria-label')||control.textContent.trim()}:null;
 }
 function restoreFocus(token){
  if(!token)return false;
  const element=token.id?[...container.querySelectorAll('[id]')].find(e=>e.id===token.id):[...container.querySelectorAll('[data-adventure]')].find(e=>Object.entries(token.data).every(([k,v])=>e.dataset[k]===v)&&(e.getAttribute('aria-label')||e.textContent.trim())===token.label);
  if(!element||element.disabled)return false;element.focus();return true;
 }
 function focusPanel(){queueMicrotask(()=>{if(!disposed)container.querySelector('#atlas-panel-title')?.focus()})}
 function open(next){stop();if(!panel)previousFocus=focusToken(document.activeElement);panel=next;render();focusPanel()}
 function close(){panel=null;feedback='';render();if(!restoreFocus(previousFocus))container.querySelector('.atlas-scene')?.focus();previousFocus=null}
 function apply(action){const result=reduceAdventure(pack,state,action);state=result.state;persist();return result}
 function message(result,after=null){open({type:'message',title:result.title||'Along the thread',text:result.message,sourceRefs:result.sourceRefs,after})}
 function showEnding(){if(!state.completed)return;const choice=pack.decision.choices.find(c=>c.id===state.choice);if(!choice)return;open({type:'ending',title:'A thread restored',text:choice.ending,sourceRefs:choice.sourceRefs})}
 function hotspotName(id){if(id==='clue')return pack.rooms[state.room].clue.title;if(id==='npc')return `Talk to ${pack.rooms[state.room].npc.name}`;if(id==='machine')return pack.repair.targetName;if(id==='tool')return pack.items.tool.name;if(id==='sequence')return pack.sequence.title;return `Go to ${pack.rooms[id]?.title||roomNames[id]}`}
 function available(){return Object.entries(anchors[state.room]).filter(([id])=>id!=='tool'||!state.collected)}
 function interact(id){
  if(!Object.hasOwn(anchors[state.room],id))return;
  if(['workshop','woods','archive'].includes(id)){const r=apply({type:'travel',room:id});if(r.message)message(r);else{selectedItem=null;render();container.querySelector('.atlas-scene')?.focus()}return}
  if(id==='clue'){message(apply({type:'inspect'}));return}
  if(id==='npc'){message(apply({type:'talk'}));return}
  if(id==='tool'){message(apply({type:'collect'}));return}
  if(id==='machine'){
   if(state.repaired){message(apply({type:'repair',item:selectedItem}));return}
   if(verb==='use'&&selectedItem){const r=apply({type:'repair',item:selectedItem});if(state.repaired)selectedItem=null;message(r);return}
   open({type:'repair'});return;
  }
  if(id==='sequence'){if(state.completed){showEnding();return}if(state.solved){open({type:'decision'});return}open({type:'sequence'});return}
 }
 function walk(x,y,callback=null){if(panel||!state.started||document.querySelector('[aria-modal="true"]'))return;destination={x:clamp(x,5,95),y:clamp(y,72,88)};arrival=callback;feedback='';}
 function walkTo(id){const p=anchors[state.room][id];if(p)walk(p.x,p.y,()=>interact(id))}
 function puzzleHTML(){
  const q=pack.sequence,mode=q.mode||'order',labels=mode==='sort'?q.targets:q.steps;
  const slots=[0,1,2].map(i=>`<div class="${state.plates[i]===undefined?'':'filled'}"><small>${i+1}${mode==='order'?'':'. '+esc(mode==='sort'?q.steps[i]:q.targets[i])}</small><span>${state.plates[i]===undefined?(mode==='order'?'Empty socket':'Awaiting a match'):esc(labels[state.plates[i]])}</span></div>`).join('');
  const next=state.plates.length,callout=mode!=='order'&&next<3?`<p class="atlas-puzzle-current" role="status">${mode==='sort'?'Choose a category for':'Match'} <strong>${esc(mode==='sort'?q.steps[next]:q.targets[next])}</strong></p>`:'';
  return `<div class="atlas-plate-slots ${mode==='order'?'':'atlas-mapping-slots'}" aria-label="Your ${mode==='sort'?'sorted items':mode==='match'?'matched descriptions':'connected route'}">${slots}</div>${callout}<div class="atlas-plates" aria-label="Available ${mode==='sort'?'categories':'brass plates'}">${labels.map((label,index)=>button(`<span class="atlas-plate-pin">◆</span>${esc(label)}`,'plate',`data-index="${index}" ${next===3||mode!=='sort'&&state.plates.includes(index)?'disabled':''}`,'atlas-brass-plate')).join('')}</div>`;
 }
 function panelHTML(){
  if(!panel)return '';
  let title='',content='',wide=false;
  if(panel.type==='intro'){
   title=pack.title;content=`<p>${esc(pack.hook)}</p><div class="atlas-hero-choices" role="group" aria-label="Choose your adventurer">${['female','male'].map(hero=>{const clip=assets.heroes?.[hero]?.idle;return button(`<span class="atlas-portrait" ${clip&&safeURL(clip.url)?`style="background-image:url('${safeURL(clip.url)}');background-size:${(clip.columns||1)*100}% ${(clip.rows||1)*100}%;"`:''}></span><strong>${hero==='female'?'Mira':'Ren'}</strong><small>${hero==='female'?'Female':'Male'} adventurer</small>`,'choose-hero',`data-hero="${hero}" aria-pressed="${state.hero===hero}"`,'atlas-hero-choice')}).join('')}</div><p class="atlas-help">Click the path to walk. Select a glowing marker to inspect or talk. You can also use arrow keys or WASD, then E near an object.</p>${button('Begin the adventure','begin','','atlas-primary')}${button('Back to games','exit')}`;
  }else if(panel.type==='message'){
   title=panel.title;content=`<p>${esc(panel.text)}</p>${refs(panel.sourceRefs)}${button(panel.after==='decision'?'Choose the next thread':'Return to the path',panel.after==='decision'?'decision':'close','','atlas-primary')}`;
  }else if(panel.type==='repair'){
   title=pack.repair.title;content=`<p>${esc(pack.repair.prompt)}</p><div class="atlas-use-items">${state.inventory.map(id=>button(`${icon(pack.items[id].icon)}<span>Use ${esc(pack.items[id].name)}</span>`,'use-item',`data-item="${id}"`)).join('')}</div>${refs(pack.repair.sourceRefs)}${button('A hint from the journal','hint','data-which="repair"')}`;
  }else if(panel.type==='sequence'){
   title=pack.sequence.title;wide=true;content=`<p>${esc(pack.sequence.prompt)}</p>${puzzleHTML()}<div class="atlas-sequence-controls">${button(pack.sequence.mode==='match'?'Check the matches':pack.sequence.mode==='sort'?'Check the categories':'Send the current','run-sequence',state.plates.length!==3?'disabled':'','atlas-primary')}${button('Lift the plates','clear-plates',state.plates.length?'':'disabled')}${button('Read a hint','hint','data-which="sequence"')}</div>${feedback?`<p class="atlas-feedback" role="status">${esc(feedback)}</p>`:''}${refs(pack.sequence.sourceRefs)}${supportLink(pack,'sequence','game-support-link')}`;
  }else if(panel.type==='decision'){
   title='Where the thread leads';content=`<p>${esc(pack.decision.prompt)}</p><div class="atlas-ending-choices">${pack.decision.choices.map(c=>button(esc(c.label),'choose-ending',`data-choice="${esc(c.id)}"`)).join('')}</div><p class="atlas-help">This is a story choice. Both paths keep the evidence you discovered.</p>`;
  }else if(panel.type==='ending'){
   title=panel.title;content=`<p>${esc(panel.text)}</p><div class="atlas-completion"><span>Three rooms explored</span><span>Mechanism restored</span><span>Evidence connected</span></div>${refs(panel.sourceRefs)}<div class="atlas-sequence-controls">${button('Keep exploring','close','','atlas-primary')}${button('Read your journal','journal')}${button('Choose another game','exit')}</div>`;
  }else if(panel.type==='journal'){
   title='The thread journal';content=`<p>${esc(adventureGoal(state,pack))}</p><ol class="atlas-objectives"><li class="${state.collected?'done':''}">Recover ${esc(pack.items.tool.name.toLowerCase())} from the path.</li><li class="${state.repaired?'done':''}">Restore ${esc(pack.repair.targetName.toLowerCase())}.</li><li class="${state.inspected.includes('archive')?'done':''}">Read the archive’s evidence.</li><li class="${state.solved?'done':''}">${esc(pack.sequence.title)}.</li><li class="${state.completed?'done':''}">Choose the story’s next step.</li></ol><p class="atlas-help">${state.attempts} mechanism attempt${state.attempts===1?'':'s'}. ${state.hints.length?'Hints used: '+state.hints.length+'.':'No hints used.'} This records play, not a validated measure of learning.</p>${state.inspected.map(room=>`<details><summary>${esc(pack.rooms[room].clue.title)}</summary><p>${esc(pack.rooms[room].clue.text)}</p>${refs(pack.rooms[room].clue.sourceRefs)}</details>`).join('')}${state.completed?`<h3>The ending you chose</h3><p>${esc(pack.decision.choices.find(c=>c.id===state.choice).ending)}</p>`:''}${button('Show me a useful hint','hint',`data-which="${state.repaired?'sequence':'repair'}"`)}`;
  }else if(panel.type==='menu'){
   title='Set down the atlas';content=`<p>Your progress is saved on this device for this topic and chapter version.</p><div class="atlas-menu-actions">${button('Return to the path','close','','atlas-primary')}${button('Read the journal','journal')}${button('Change adventurer','character')}${button('Learning material & chapters','library')}${button('Replay this adventure','replay-prompt')}${button('Choose another game','exit')}</div><p class="atlas-help">Arrow keys or WASD to walk; E to use a nearby marker. Tab reaches every hotspot and item. Escape closes panels. ${reduceMotion.matches?'Reduced motion is on.':''}</p>`;
  }else if(panel.type==='character'){
   title='Choose your adventurer';content=`<div class="atlas-ending-choices">${button('Mira · female adventurer','change-hero','data-hero="female"')}${button('Ren · male adventurer','change-hero','data-hero="male"')}</div><p>Your story and inventory stay with you.</p>`;
  }else if(panel.type==='replay'){
   title='Begin a new thread?';content=`<p>This starts this adventure again. A copy of the current save is kept on this device until the next replay.</p>${button('Start a fresh adventure','restart','','atlas-primary')}${button('Keep this adventure','close')}`;
  }else if(panel.type==='objects'){
   title='Places and objects';content=`<div class="atlas-object-list">${available().map(([id])=>button(esc(hotspotName(id)),'object-list',`data-object="${id}"`)).join('')}</div><p class="atlas-help">Choosing an object walks to it before interacting.</p>`;
  }else if(panel.type==='item'){
   const item=pack.items[panel.item];title=item.name;content=`<div class="atlas-item-detail">${icon(item.icon)}<p>${esc(item.description)}</p></div>${refs(item.sourceRefs)}${button('Select this object','select-item',`data-item="${panel.item}"`,'atlas-primary')}`;
  }
  return `<div class="atlas-scrim"><section class="atlas-panel ${wide?'atlas-panel-wide':''}" role="dialog" aria-modal="true" aria-labelledby="atlas-panel-title">${panel.type!=='intro'?button('×','close','aria-label="Close adventure panel"','atlas-close'):''}<h2 id="atlas-panel-title" tabindex="-1">${esc(title)}</h2>${content}</section></div>`;
 }
 function render(){
  const focused=focusToken(document.activeElement);
  const room=pack.rooms[state.room],variant=state.room==='workshop'?(pack.setting==='market'?assets.extended?.backgrounds?.vn?.url:pack.setting==='observatory'?assets.extended?.backgrounds?.quiz?.url:null):null,background=safeURL(variant||assets.rooms?.[state.room]),keeper=safeURL(assets.npc?.keeper),npcAnchor=anchors[state.room].npc;
  container.innerHTML=`<section class="atlas-game" aria-label="The Thread Atlas adventure"><header class="atlas-top"><div class="atlas-brand"><span aria-hidden="true">✧</span><div><strong>The Thread Atlas</strong><small>${esc(pack.title)}</small></div></div><h1>${esc(room.title)}</h1><nav aria-label="Adventure tools">${supportLink(pack,'sequence','game-support-link','Learning help')}${button('Journal','journal')}${button('Menu','menu')}</nav></header><div class="atlas-scene" tabindex="0" role="group" aria-label="${esc(room.title)}. Click the path to walk." ${background?`style="background-image:url('${background}')"`:''}><div class="atlas-goal" role="status"><span aria-hidden="true">◇</span>${esc(adventureGoal(state,pack))}</div><div class="atlas-scene-shade"></div>${keeper?`<img class="atlas-npc" src="${esc(keeper)}" alt="" aria-hidden="true" style="left:${npcAnchor.x}%;top:${npcAnchor.y}%" draggable="false">`:""}${variant?`<div class="atlas-world-prop" style="left:${anchors.workshop.machine.x}%;top:${anchors.workshop.machine.y}%" aria-hidden="true">${icon(pack.items.tool.icon)}</div>`:''}${available().map(([id,p])=>['workshop','woods','archive'].includes(id)?'':`<button type="button" class="atlas-hotspot ${id==='machine'&&state.repaired||id==='sequence'&&state.solved?'atlas-restored':''}" style="left:${p.x}%;top:${p.y-13}%" data-adventure="hotspot" data-object="${id}" aria-label="${esc(hotspotName(id))}"><span aria-hidden="true">${id==='npc'?'◌':'◇'}</span><small>${esc(hotspotName(id))}</small></button>`).join('')}<div class="atlas-hero" aria-hidden="true"><div class="atlas-hero-shadow"></div><div class="atlas-sprite"></div></div><span class="atlas-destination" aria-hidden="true"></span></div><div class="atlas-location"><strong class="atlas-room-label">${esc(room.title)}</strong><div class="atlas-room-ways">${available().filter(([id])=>['workshop','woods','archive'].includes(id)).map(([id])=>button(`${id==='woods'?'‹ ':''}${esc(pack.rooms[id].title)}${id==='archive'?' ›':''}`,'hotspot',`data-object="${id}"`,'atlas-door')).join('')}</div><p class="atlas-scene-caption">${esc(room.description)}</p></div><footer class="atlas-satchel"><div class="atlas-verbs" role="group" aria-label="Adventure actions">${button('Look','verb','data-verb="look" aria-pressed="'+(verb==='look')+'"')}${button('Talk','verb','data-verb="talk" aria-pressed="'+(verb==='talk')+'"')}${button('Use','verb','data-verb="use" aria-pressed="'+(verb==='use')+'"')}</div><div class="atlas-inventory" aria-label="Your satchel">${state.inventory.map(id=>button(`${icon(pack.items[id].icon)}<span>${esc(pack.items[id].name)}</span>`,'inventory',`data-item="${id}" aria-pressed="${selectedItem===id}" title="${esc(pack.items[id].name)}"`,'atlas-inventory-item')).join('')}${state.inventory.length<3?'<div class="atlas-empty-slot" aria-hidden="true">✧</div>':''}</div>${button('Places & objects','objects','','atlas-objects-toggle')}<span class="atlas-selection" aria-live="polite">${selectedItem?`Use ${esc(pack.items[selectedItem].name)}`:verb==='talk'?'Choose a character to talk to.':verb==='use'?'Select an object from your satchel.':'Follow the glowing markers.'}</span></footer>${storageNotice?`<div class="atlas-storage" role="status">${esc(storageNotice)}</div>`:''}${panelHTML()}</section>`;
  updateSprite(0);if(!restoreFocus(focused)&&panel&&focused?.data?.adventure==='plate')(container.querySelector('[data-adventure="plate"]:not(:disabled)')||container.querySelector('[data-adventure="run-sequence"]:not(:disabled)'))?.focus();
 }
 function updateSprite(dt){
  const hero=container.querySelector('.atlas-hero'),sprite=container.querySelector('.atlas-sprite');if(!hero||!sprite)return;
  const pos=state.positions[state.room];hero.style.left=pos.x+'%';hero.style.top=pos.y+'%';
  const next=moving?'walk':'idle';if(next!==animation){animation=next;animationTime=0}else animationTime+=dt;
  const clip=assets.heroes?.[state.hero]?.[animation]||assets.heroes?.[state.hero]?.idle,url=safeURL(clip?.url);
  if(url){const columns=Math.max(1,clip.columns||1),rows=Math.max(1,clip.rows||1),frames=Math.max(1,Math.min(clip.frames||columns*rows,columns*rows)),frame=reduceMotion.matches?0:Math.floor(animationTime*(clip.fps||8))%frames,col=frame%columns,row=Math.floor(frame/columns);sprite.style.backgroundImage=`url('${url}')`;sprite.style.backgroundSize=`${columns*100}% ${rows*100}%`;sprite.style.backgroundPosition=`${columns===1?0:col/(columns-1)*100}% ${rows===1?0:row/(rows-1)*100}%`;sprite.style.transform=`scaleX(${state.facing})`;sprite.dataset.animation=animation;hero.hidden=false}else hero.hidden=true;
  const marker=container.querySelector('.atlas-destination');if(marker){marker.hidden=!destination;if(destination){marker.style.left=destination.x+'%';marker.style.top=destination.y+'%'}}
 }
 function step(now){
  if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;moving=false;
  const paused=panel||!state.started||Boolean(document.querySelector('[aria-modal="true"]'));
  if(!paused){const pos=state.positions[state.room];let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
   if(dx||dy){destination=null;arrival=null;const len=Math.hypot(dx,dy),oldX=pos.x,oldY=pos.y;pos.x=clamp(pos.x+dx/len*28*dt,5,95);pos.y=clamp(pos.y+dy/len*16*dt,72,88);moving=Math.hypot(pos.x-oldX,pos.y-oldY)>.001;if(Math.abs(dx)>.001)state.facing=dx>0?1:-1;}
   else if(destination){const vx=destination.x-pos.x,vy=(destination.y-pos.y)*1.75,len=Math.hypot(vx,vy),distance=Math.min(len,28*dt);if(len>.001){pos.x+=vx/len*distance;pos.y+=vy/len*distance/1.75;moving=distance>.001;if(Math.abs(vx)>.01)state.facing=vx>0?1:-1;}if(len<=28*dt+.001){pos.x=destination.x;pos.y=destination.y;destination=null;const callback=arrival;arrival=null;persist();if(callback)callback()}}
   if(moving){saveDue+=dt;if(saveDue>.75){persist();saveDue=0}}
  }else keys.clear();
  updateSprite(dt);raf=requestAnimationFrame(step);
 }
 function action(event){
  const b=event.target.closest('[data-adventure]');if(!b||!container.contains(b)||b.disabled)return;const a=b.dataset.adventure;
  if(a==='close'){close();return}if(a==='journal'){open({type:'journal'});return}if(a==='menu'){open({type:'menu'});return}if(a==='objects'){open({type:'objects'});return}
  if(a==='hotspot'){walkTo(b.dataset.object);return}if(a==='object-list'){const id=b.dataset.object;close();walkTo(id);return}
  if(a==='choose-hero'){state.hero=b.dataset.hero;render();return}if(a==='begin'){apply({type:'hero',hero:state.hero});close();return}
  if(a==='character'){open({type:'character'});return}if(a==='change-hero'){apply({type:'hero',hero:b.dataset.hero});close();return}
  if(a==='verb'){verb=b.dataset.verb;if(verb!=='use')selectedItem=null;render();return}
  if(a==='inventory'){const id=b.dataset.item;if(verb==='look'){open({type:'item',item:id})}else{selectedItem=id;verb='use';render()}return}
  if(a==='select-item'){selectedItem=b.dataset.item;verb='use';close();return}
  if(a==='use-item'){selectedItem=b.dataset.item;verb='use';const r=apply({type:'repair',item:selectedItem});if(state.repaired)selectedItem=null;message(r);return}
  if(a==='plate'){apply({type:'plate',index:+b.dataset.index});feedback='';render();return}if(a==='clear-plates'){apply({type:'clear-plates'});feedback='';render();return}
  if(a==='run-sequence'){const r=apply({type:'sequence'});if(state.solved)message(r,'decision');else{feedback=r.message;render();container.querySelector('.atlas-feedback')?.scrollIntoView({block:'nearest'})}return}
  if(a==='hint'){const r=apply({type:'hint',which:b.dataset.which});message(r);return}if(a==='decision'){open({type:'decision'});return}
  if(a==='choose-ending'){apply({type:'choice',id:b.dataset.choice});showEnding();return}
  if(a==='replay-prompt'){open({type:'replay'});return}if(a==='restart'){try{storage.setItem(saveKey+':previous',JSON.stringify(state))}catch{}state=initialAdventureState(pack);persist();selectedItem=null;open({type:'intro'});return}
  if(a==='exit'){stop();persist();onExit();return}if(a==='library'){close();stop();persist();onLibrary();return}
 }
 function pointer(event){if(event.target.closest('button,summary,a,input,select,textarea')||!event.target.closest('.atlas-scene')||panel)return;const rect=container.querySelector('.atlas-scene').getBoundingClientRect();walk((event.clientX-rect.left)/rect.width*100,(event.clientY-rect.top)/rect.height*100);container.querySelector('.atlas-scene')?.focus()}
 function keydown(event){
  if(!container.isConnected||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(panel){if(event.key==='Escape'&&panel.type!=='intro'){event.preventDefault();close()}if(event.key==='Tab'){const controls=[...container.querySelectorAll('.atlas-panel button:not(:disabled),.atlas-panel summary')];if(controls.length){const first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){last.focus();event.preventDefault()}else if(!event.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement))){first.focus();event.preventDefault()}}}return}
  if(document.querySelector('[aria-modal="true"]'))return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(key)){event.preventDefault();keys.add(key)}
  if(key==='e'){event.preventDefault();const pos=state.positions[state.room],nearest=available().map(([id,p])=>({id,distance:Math.hypot(p.x-pos.x,(p.y-pos.y)*1.75)})).sort((a,b)=>a.distance-b.distance)[0];if(nearest&&nearest.distance<12)interact(nearest.id);else open({type:'objects'})}
  if(key==='Escape'){event.preventDefault();open({type:'menu'})}
 }
 const keyup=e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key),blur=()=>{keys.clear();persist()},pagehide=()=>persist();
 container.addEventListener('click',action);container.addEventListener('pointerdown',pointer);document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);window.addEventListener('blur',blur);window.addEventListener('pagehide',pagehide);
 if(!state.started)panel={type:'intro'};render();if(panel)focusPanel();raf=requestAnimationFrame(step);
 return {destroy(){if(disposed)return;disposed=true;persist();cancelAnimationFrame(raf);container.removeEventListener('click',action);container.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',pagehide);container.innerHTML=''}};
}
