import {ROOM_PROPS,adventureNavigation,adventureRoute,safeAdventurePosition,floorPoint,scenePoint,canReachObject,FLOOR_SCALE} from './adventure-navigation.js';
import {advancePath,moveWithSlide} from '../movement.js';
import {worldAnchors,roomsOf,worldChanged,roomLock} from './adventure-world.js';
import {worldPanel} from './adventure-world-ui.js';
import {supportLink} from '../studio/support-link.js';
import '../studio/support-link.css';
import {validateAdventureContent} from './adventure-content.js';
import {adventureAnchors,adventureSaveKey,initialAdventureState,validateAdventureSave,adventureGoal,reduceAdventure} from './adventure-engine.js';
import './adventure-style.css';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const safeURL=u=>typeof u==='string'&&/^\/game-modes\/(?:art|extended-art|depth-art|expansion-art|variety-art)\/[a-zA-Z0-9_./-]+$/.test(u)&&!u.includes('..')?u:'';
const roomNames={workshop:'Workshop',woods:'Woodland path',archive:'Archive'};
const button=(label,action,extra='',className='')=>`<button type="button" class="${className}" data-adventure="${action}" ${extra}>${label}</button>`;

export function mountAdventure(container,{pack:raw,assets={},onExit=()=>{},onLibrary=()=>{},onProgress=()=>{},storage=localStorage}={}){
 const pack=validateAdventureContent(raw),baseAnchors=adventureAnchors(pack),saveKey=adventureSaveKey(pack),rooms=roomsOf(pack),roomIds=Object.keys(rooms);let anchors=baseAnchors,state=initialAdventureState(pack),storageNotice='',panel=null,selectedItem=null,destination=null,arrival=null,verb='look',raf=0,last=performance.now(),animation='idle',animationTime=0,moving=false,disposed=false,saveDue=0,feedback='',previousFocus=null;
 let walkingPath=[];
 const keys=new Set(),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let preferences={motion:false,direct:false,text:1};try{const v=JSON.parse(storage.getItem('mosaic:adventure:accessibility')||'{}');preferences={motion:v.motion===true,direct:v.direct===true,text:[1,1.5,2].includes(v.text)?v.text:1}}catch{}
 const noMotion=()=>reduceMotion.matches||preferences.motion;
 const announcer=document.createElement('div');announcer.className='atlas-announcer';announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');announcer.setAttribute('aria-atomic','true');container.after(announcer);
 function announce(text){announcer.textContent=text}
 const inertSiblings=new Map();
 function modalIsolation(on){if(on){for(let node=container;node&&node!==document.body;node=node.parentElement)for(const sibling of node.parentElement?.children||[]){if(sibling===node||sibling===announcer||['SCRIPT','STYLE','LINK'].includes(sibling.tagName))continue;if(!inertSiblings.has(sibling))inertSiblings.set(sibling,sibling.inert);sibling.inert=true}}else{for(const [el,prior] of inertSiblings)el.inert=prior;inertSiblings.clear()}}

 try{const stored=storage.getItem(saveKey);if(stored){const valid=validateAdventureSave(stored,pack);if(valid)state=valid;else storageNotice='An incompatible save was ignored. A new adventure is ready.'}}catch{storageNotice='Saving is unavailable. This adventure will last for this visit.'}
 function persist(){try{storage.setItem(saveKey,JSON.stringify(state));if(storageNotice.startsWith('Saving'))storageNotice='';}catch{storageNotice='Saving is unavailable. Keep this page open to retain your adventure.'}onProgress({pack,record:state,kind:'classic'});}
 function icon(key,alt=''){const url=safeURL(assets.icons?.[key]);return url?`<img src="${esc(url)}" alt="${esc(alt)}" draggable="false">`:''}
 function refs(ids){return ids?.length?`<details class="atlas-evidence"><summary>Read the source</summary>${ids.map(id=>{const s=pack.sources.find(x=>x.id===id);return s?`<article><h4>${esc(s.title)}</h4><small>${esc(s.locator)}</small><p>${esc(s.excerpt)}</p></article>`:''}).join('')}</details>`:''}
 function stop(){walkingPath=[];destination=null;arrival=null;moving=false;keys.clear();}
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
 function close(){if(!state.started){panel={type:'intro'};render();focusPanel();return}panel=null;feedback='';render();if(!restoreFocus(previousFocus))container.querySelector('.atlas-scene')?.focus();previousFocus=null}
 function apply(action){const result=reduceAdventure(pack,state,action);state=result.state;persist();announce(result.message||adventureGoal(state,pack));return result}
 function message(result,after=null){open({type:'message',title:result.title||'Along the thread',text:result.message,sourceRefs:result.sourceRefs,after})}
 function showEnding(){if(!state.completed)return;const choice=pack.decision.choices.find(c=>c.id===state.choice);if(!choice)return;open({type:'ending',title:'A thread restored',text:choice.ending,sourceRefs:choice.sourceRefs})}
 function hotspotName(id){if(id==='request')return pack.world.delivery.title;if(id==='field')return pack.world.field.title;if(id==='relay')return pack.world.relay.title;if(id==='token')return 'Collect a trail token';if(id==='clue')return rooms[state.room].clue.title;if(id==='npc')return `Talk to ${rooms[state.room].npc.name}`;if(id==='machine')return pack.repair.targetName;if(id==='tool')return pack.items.tool.name;if(id==='sequence')return pack.sequence.title;return `Go to ${rooms[id]?.title||roomNames[id]}`}
 function available(){anchors=pack.world?worldAnchors(state,baseAnchors):baseAnchors;return Object.entries(anchors[state.room]).filter(([id])=>id!=='tool'||!state.collected)}
 function interact(id){
  if(!Object.hasOwn(anchors[state.room],id))return;
  if(roomIds.includes(id)){const r=apply({type:'travel',room:id});if(r.message)message(r);else{selectedItem=null;render();container.querySelector('.atlas-scene')?.focus()}return}
  if(id==='request'){message(apply({type:'delivery'}));return}if(id==='token'){message(apply({type:'token'}));return}if(id==='field'||id==='relay'){open({type:id});return}
  if(id==='clue'){message(apply({type:'inspect'}));return}
  if(id==='npc'){message(apply({type:'talk'}));return}
  if(id==='tool'){message(apply({type:'collect'}));return}
  if(id==='machine'){
   if(state.repaired){message(apply({type:'repair',item:selectedItem}));return}
   if(verb==='use'&&selectedItem){const r=apply({type:'repair',item:selectedItem});if(state.repaired)selectedItem=null;message(r);return}
   open({type:'repair'});return;
  }
  if(id==='sequence'){if(state.completed){showEnding();return}if(state.solved){if(pack.world)message({title:'The tower awaits',message:adventureGoal(state,pack)});else open({type:'decision'});return}open({type:'sequence'});return}
 }
 function walk(x,y,callback=null){
  if(panel||!state.started||document.querySelector('[aria-modal="true"]'))return;
  stop();
  const point={x:clamp(x,5,95),y:clamp(y,72,88)},route=adventureRoute(pack,state,point,!!callback);
  if(!route.length){announce('There is no clear path to that spot. Try another side.');return}
  const end=scenePoint(route.at(-1));state.facing=end.x>=state.positions[state.room].x?1:-1;
  if(noMotion()||preferences.direct){state.positions[state.room]=end;persist();updateSprite(0);if(callback)callback();return}
  walkingPath=route;destination=end;arrival=callback;feedback='';
 }
 function walkTo(id){const p=anchors[state.room][id];if(p)walk(p.x,p.y,()=>interact(id))}
 function scenery(){return ROOM_PROPS[state.room].map(([key,x,y,width])=>{const src=safeURL(assets.expansion?.props?.[key]?.url);return src?`<img class="atlas-prop" src="${src}" alt="" aria-hidden="true" style="left:${x}%;top:${y}%;width:${width}%;z-index:${Math.round(y*10)}">`:''}).join('')}
 function puzzleHTML(){
  const q=pack.sequence,mode=q.mode||'order',labels=mode==='sort'?q.targets:q.steps;
  const slots=[0,1,2].map(i=>`<div class="${state.plates[i]===undefined?'':'filled'}"><small>${i+1}${mode==='order'?'':'. '+esc(mode==='sort'?q.steps[i]:q.targets[i])}</small><span>${state.plates[i]===undefined?(mode==='order'?'Empty socket':'Awaiting a match'):esc(labels[state.plates[i]])}</span></div>`).join('');
  const next=state.plates.length,callout=mode!=='order'&&next<3?`<p class="atlas-puzzle-current" role="status">${mode==='sort'?'Choose a category for':'Match'} <strong>${esc(mode==='sort'?q.steps[next]:q.targets[next])}</strong></p>`:'';
  return `<div class="atlas-plate-slots ${mode==='order'?'':'atlas-mapping-slots'}" aria-label="Your ${mode==='sort'?'sorted items':mode==='match'?'matched descriptions':'connected route'}">${slots}</div>${callout}<div class="atlas-plates" aria-label="Available ${mode==='sort'?'categories':'brass plates'}">${labels.map((label,index)=>button(`<span class="atlas-plate-pin">◆</span>${esc(label)}`,'plate',`data-index="${index}" ${next===3||mode!=='sort'&&state.plates.includes(index)?'disabled':''}`,'atlas-brass-plate')).join('')}</div>`;
 }
 function panelHTML(){
  if(!panel)return '';
  let title='',content='',wide=false;
  const wp=worldPanel(panel.type,{p:pack,s:state,esc,button,refs});
  if(wp){({title,content,wide=false}=wp)}else if(panel.type==='settings'){title='Make yourself comfortable';content=`<p>These choices are saved on this device. The story and puzzle rules stay the same.</p><div class="atlas-menu-actions">${button(preferences.motion?'Motion off':'Turn motion off','motion',`aria-pressed="${preferences.motion}"`)}${button(preferences.direct?'Direct interaction on':'Use direct interaction','direct',`aria-pressed="${preferences.direct}"`)}</div><p>Direct interaction opens places and objects immediately. System reduced-motion also stops walking transitions and idle animation. Arrow keys then move one step per press, without gliding.</p><div class="atlas-text-options" role="group" aria-label="Text size">${[1,1.5,2].map(n=>button(n*100+'% text','text-size',`data-size="${n}" aria-pressed="${preferences.text===n}"`)).join('')}</div>`}
  else if(panel.type==='intro'){
   title=pack.title;content=`<p>${esc(pack.hook)}</p><div class="atlas-hero-choices" role="group" aria-label="Choose your adventurer">${['female','male'].map(hero=>{const clip=assets.heroes?.[hero]?.idle;return button(`<span class="atlas-portrait" ${clip&&safeURL(clip.url)?`style="background-image:url('${safeURL(clip.url)}');background-size:${(clip.columns||1)*100}% ${(clip.rows||1)*100}%;"`:''}></span><strong>${hero==='female'?'Mira':'Ren'}</strong><small>${hero==='female'?'Female':'Male'} adventurer</small>`,'choose-hero',`data-hero="${hero}" aria-pressed="${state.hero===hero}"`,'atlas-hero-choice')}).join('')}</div><p class="atlas-help">Click the path to walk. Select a glowing marker to inspect or talk. You can also use arrow keys or WASD, then E near an object.</p>${button('Comfort & controls','settings')}${button('Begin the adventure','begin','','atlas-primary')}${button('Back to games','exit')}`;
  }else if(panel.type==='message'){
   title=panel.title;content=`<p>${esc(panel.text)}</p>${refs(panel.sourceRefs)}${button(panel.after==='decision'?'Choose the next thread':'Return to the path',panel.after==='decision'?'decision':'close','','atlas-primary')}`;
  }else if(panel.type==='repair'){
   title=pack.repair.title;content=`<p>${esc(pack.repair.prompt)}</p><div class="atlas-use-items">${state.inventory.map(id=>button(`${icon(pack.items[id].icon)}<span>Use ${esc(pack.items[id].name)}</span>`,'use-item',`data-item="${id}"`)).join('')}</div>${refs(pack.repair.sourceRefs)}${button('A hint from the journal','hint','data-which="repair"')}`;
  }else if(panel.type==='sequence'){
   title=pack.sequence.title;wide=true;content=`<p>${esc(pack.sequence.prompt)}</p>${puzzleHTML()}<div class="atlas-sequence-controls">${button(pack.sequence.mode==='match'?'Check the matches':pack.sequence.mode==='sort'?'Check the categories':'Send the current','run-sequence',state.plates.length!==3?'disabled':'','atlas-primary')}${button('Lift the plates','clear-plates',state.plates.length?'':'disabled')}${button('Read a hint','hint','data-which="sequence"')}</div>${feedback?`<p class="atlas-feedback" role="status">${esc(feedback)}</p>`:''}${refs(pack.sequence.sourceRefs)}${supportLink(pack,'sequence','game-support-link')}`;
  }else if(panel.type==='decision'){
   title='Where the thread leads';content=`<p>${esc(pack.decision.prompt)}</p><div class="atlas-ending-choices">${pack.decision.choices.map(c=>button(esc(c.label),'choose-ending',`data-choice="${esc(c.id)}"`)).join('')}</div><p class="atlas-help">This is a story choice. Both paths keep the evidence you discovered.</p>`;
  }else if(panel.type==='ending'){
   title=panel.title;content=`<p>${esc(panel.text)}</p><div class="atlas-completion"><span>${state.visited.length} places explored</span><span>Mechanism restored</span><span>Evidence connected</span></div>${pack.world?`<p>${state.world.delivery===3?'The quay delivery is complete.':'The quay still has a neighbour to help.'} ${state.world.field.solved?'The garden path is open.':'The garden request remains available.'} You found ${state.world.tokens.length} of 3 trail tokens.</p>`:''}${refs(panel.sourceRefs)}<div class="atlas-sequence-controls">${button('Keep exploring','close','','atlas-primary')}${button('Read your journal','journal')}${button('Choose another game','exit')}</div>`;
  }else if(panel.type==='journal'){
   title='The thread journal';content=`<p>${esc(adventureGoal(state,pack))}</p><ol class="atlas-objectives"><li class="${state.collected?'done':''}">Recover ${esc(pack.items.tool.name.toLowerCase())} from the path.</li><li class="${state.repaired?'done':''}">Restore ${esc(pack.repair.targetName.toLowerCase())}.</li><li class="${state.inspected.includes('archive')?'done':''}">Read the archive’s evidence.</li><li class="${state.solved?'done':''}">${esc(pack.sequence.title)}.</li>${pack.world?`<li class="${state.world.relay.solved?'done':''}">Restore the tower signal.</li>`:''}<li class="${state.completed?'done':''}">Choose the story’s next step.</li></ol><p class="atlas-help">${state.attempts} mechanism attempt${state.attempts===1?'':'s'}. ${state.hints.length?'Hints used: '+state.hints.length+'.':'No hints used.'} This records play, not a validated measure of learning.</p>${state.inspected.map(room=>`<details><summary>${esc(rooms[room].clue.title)}</summary><p>${esc(rooms[room].clue.text)}</p>${refs(rooms[room].clue.sourceRefs)}</details>`).join('')}${state.completed?`<h3>The ending you chose</h3><p>${esc(pack.decision.choices.find(c=>c.id===state.choice).ending)}</p>`:''}${pack.world?button('Requests & discoveries','quests')+button('Open the world map','map'):''}${button('Show me a useful hint','hint',`data-which="${state.repaired?'sequence':'repair'}"`)}`;
  }else if(panel.type==='menu'){
   title='Set down the atlas';content=`<p>Your progress is saved on this device for this topic and chapter version.</p><div class="atlas-menu-actions">${button('Return to the path','close','','atlas-primary')}${button('Read the journal','journal')}${button('Change adventurer','character')}${button('Comfort & controls','settings')}${pack.world?button('World map','map')+button('Requests','quests'):''}${button('Learning material & chapters','library')}${button('Replay this adventure','replay-prompt')}${button('Choose another game','exit')}</div><p class="atlas-help">Arrow keys or WASD to walk; E to use a nearby marker. Tab reaches every hotspot and item. Escape closes panels. ${reduceMotion.matches?'Reduced motion is on.':''}</p>`;
  }else if(panel.type==='character'){
   title='Choose your adventurer';content=`<div class="atlas-ending-choices">${button('Mira · female adventurer','change-hero','data-hero="female"')}${button('Ren · male adventurer','change-hero','data-hero="male"')}</div><p>Your story and inventory stay with you.</p>`;
  }else if(panel.type==='replay'){
   title='Begin a new thread?';content=`<p>This starts this adventure again. A copy of the current save is kept on this device until the next replay.</p>${button('Start a fresh adventure','restart','','atlas-primary')}${button('Keep this adventure','close')}`;
  }else if(panel.type==='objects'){
   title='Places and objects';content=`<div class="atlas-object-list">${available().map(([id])=>button(esc(hotspotName(id)),'object-list',`data-object="${id}"`)).join('')}</div><p class="atlas-help">Direct interaction and reduced motion let you open any listed object immediately.</p>`;
  }else if(panel.type==='item'){
   const item=pack.items[panel.item];title=item.name;content=`<div class="atlas-item-detail">${icon(item.icon)}<p>${esc(item.description)}</p></div>${refs(item.sourceRefs)}${button('Select this object','select-item',`data-item="${panel.item}"`,'atlas-primary')}`;
  }
  return `<div class="atlas-scrim"><section class="atlas-panel ${wide?'atlas-panel-wide':''}" role="dialog" aria-modal="true" aria-labelledby="atlas-panel-title">${panel.type!=='intro'?button('×','close','aria-label="Close adventure panel"','atlas-close'):''}<h2 id="atlas-panel-title" tabindex="-1">${esc(title)}</h2>${content}</section></div>`;
 }
 function render(){
  for(const room of roomIds)state.positions[room]=safeAdventurePosition(pack,state,room);
  const focused=focusToken(document.activeElement);
  anchors=pack.world?worldAnchors(state,baseAnchors):baseAnchors;
  const changed=pack.world&&worldChanged(state,state.room);
  const room=rooms[state.room],variant=!assets.scenery&&state.room==='workshop'?(pack.setting==='market'?assets.extended?.backgrounds?.vn?.url:pack.setting==='observatory'?assets.extended?.backgrounds?.quiz?.url:null):null,background=safeURL(variant||assets.rooms?.[state.room]),keeper=safeURL(assets.npc?.keeper),npcAnchor=anchors[state.room].npc;
  container.innerHTML=`<section class="atlas-game ${noMotion()?'atlas-still':''} ${preferences.text>1?'atlas-large-text':''}" style="--atlas-text:${preferences.text}" aria-label="The Thread Atlas adventure"><div class="atlas-surface" ${panel?'inert':''}><header class="atlas-top"><div class="atlas-brand"><span aria-hidden="true">✧</span><div><strong>The Thread Atlas</strong><small>${esc(pack.title)}</small></div></div><h1>${esc(room.title)}</h1><nav aria-label="Adventure tools">${supportLink(pack,'sequence','game-support-link','Learning help')}${pack.world?button('Map','map')+button('Requests','quests'):''}${button('Journal','journal')}${button('Menu','menu')}</nav><div class="atlas-goal" role="status"><span aria-hidden="true">◇</span>${esc(adventureGoal(state,pack))}</div></header><div class="atlas-scene" tabindex="0" role="group" aria-label="${esc(room.title)}. Click the path to walk." ${background?`style="background-image:url('${background}')"`:''}><div class="atlas-scene-shade"></div>${keeper?`<img class="atlas-npc" src="${esc(keeper)}" alt="" aria-hidden="true" style="left:${npcAnchor.x}%;top:${npcAnchor.y}%" draggable="false">`:""}${variant?`<div class="atlas-world-prop" style="left:${anchors.workshop.machine.x}%;top:${anchors.workshop.machine.y}%" aria-hidden="true">${icon(state.repaired?'gear':pack.items.tool.icon)}</div>`:''}${changed?'<div class="atlas-consequence" aria-hidden="true"><span>✦</span><span>✦</span><span>✦</span></div>':''}${available().map(([id,p])=>roomIds.includes(id)?'':`<button type="button" class="atlas-hotspot ${id==='machine'&&state.repaired||id==='sequence'&&state.solved?'atlas-restored':''}" style="left:${p.x}%;top:${p.y-13}%" data-adventure="hotspot" data-object="${id}" data-edge="${p.x<30?'left':p.x>70?'right':'centre'}" aria-label="${esc(hotspotName(id))}"><span aria-hidden="true">${id==='npc'?'◌':'◇'}</span><small>${esc(hotspotName(id))}</small></button>`).join('')}${scenery()}<div class="atlas-hero" aria-hidden="true"><div class="atlas-hero-shadow"></div><div class="atlas-sprite"></div></div><span class="atlas-destination" aria-hidden="true"></span></div><div class="atlas-location"><strong class="atlas-room-label">${esc(room.title)}</strong><div class="atlas-room-ways">${available().filter(([id])=>roomIds.includes(id)).map(([id])=>button(`${id==='woods'?'‹ ':''}${esc(rooms[id].title)}${id==='archive'?' ›':''}`,'hotspot',`data-object="${id}"`,'atlas-door')).join('')}</div><p class="atlas-scene-caption">${esc(changed?pack.world.after[state.room]:room.description)}</p></div><footer class="atlas-satchel"><div class="atlas-verbs" role="group" aria-label="Adventure actions">${button('Look','verb','data-verb="look" aria-pressed="'+(verb==='look')+'"')}${button('Talk','verb','data-verb="talk" aria-pressed="'+(verb==='talk')+'"')}${button('Use','verb','data-verb="use" aria-pressed="'+(verb==='use')+'"')}</div><div class="atlas-inventory" aria-label="Your satchel">${state.inventory.map(id=>button(`${icon(pack.items[id].icon)}<span>${esc(pack.items[id].name)}</span>`,'inventory',`data-item="${id}" aria-pressed="${selectedItem===id}" title="${esc(pack.items[id].name)}"`,'atlas-inventory-item')).join('')}${state.inventory.length<3?'<div class="atlas-empty-slot" aria-hidden="true">✧</div>':''}</div>${button('Places & objects','objects','','atlas-objects-toggle')}<span class="atlas-selection" aria-live="polite">${selectedItem?`Use ${esc(pack.items[selectedItem].name)}`:verb==='talk'?'Choose a character to talk to.':verb==='use'?'Select an object from your satchel.':'Follow the glowing markers.'}</span></footer>${storageNotice?`<div class="atlas-storage" role="status">${esc(storageNotice)}</div>`:''}</div>${panelHTML()}</section>`;
  modalIsolation(!!panel);updateSprite(0);if(!restoreFocus(focused)&&focused){const next=panel?(container.querySelector('[data-adventure="plate"]:not(:disabled)')||container.querySelector('#atlas-panel-title')):container.querySelector('.atlas-scene');next?.focus()}
 }
 function updateSprite(dt){
  const hero=container.querySelector('.atlas-hero'),sprite=container.querySelector('.atlas-sprite');if(!hero||!sprite)return;
  const pos=state.positions[state.room];hero.style.left=pos.x+'%';hero.style.top=pos.y+'%';hero.style.zIndex=String(Math.round(pos.y*10));const npc=container.querySelector('.atlas-npc');if(npc)npc.style.zIndex=String(Math.round(anchors[state.room].npc.y*10));
  const next=moving?'walk':'idle';if(next!==animation){animation=next;animationTime=0}else animationTime+=dt;
  const clip=assets.heroes?.[state.hero]?.[animation]||assets.heroes?.[state.hero]?.idle,url=safeURL(clip?.url);
  if(url){const columns=Math.max(1,clip.columns||1),rows=Math.max(1,clip.rows||1),frames=Math.max(1,Math.min(clip.frames||columns*rows,columns*rows)),frame=noMotion()?0:Math.floor(animationTime*(clip.fps||8))%frames,col=frame%columns,row=Math.floor(frame/columns);sprite.style.backgroundImage=`url('${url}')`;sprite.style.backgroundSize=`${columns*100}% ${rows*100}%`;sprite.style.backgroundPosition=`${columns===1?0:col/(columns-1)*100}% ${rows===1?0:row/(rows-1)*100}%`;sprite.style.transform=`scaleX(${state.facing})`;sprite.dataset.animation=animation;hero.hidden=false}else hero.hidden=true;
  const marker=container.querySelector('.atlas-destination');if(marker){marker.hidden=!destination;if(destination){marker.style.left=destination.x+'%';marker.style.top=destination.y+'%'}}
 }
 function step(now){
  if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;moving=false;
  const paused=panel||!state.started||Boolean(document.querySelector('[aria-modal="true"]'));
  if(!paused){const pos=state.positions[state.room];let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
   if(dx||dy){walkingPath=[];destination=null;arrival=null;const len=Math.hypot(dx,dy),point=floorPoint(pos),result=moveWithSlide(adventureNavigation(pack,state),point,dx/len*28*dt,dy/len*28*dt);Object.assign(pos,scenePoint(point));moving=result.moving;if(Math.abs(dx)>.001)state.facing=dx>0?1:-1;}
   else if(destination){const point=floorPoint(pos),result=advancePath(adventureNavigation(pack,state),point,walkingPath,28*dt);Object.assign(pos,scenePoint(point));moving=result.moving;if(Math.abs(result.dx)>.001)state.facing=result.dx>0?1:-1;if(!walkingPath.length){destination=null;const callback=result.blocked?null:arrival;arrival=null;persist();if(result.blocked)announce('The way is blocked. Choose another route.');if(callback)callback()}}
   if(moving){saveDue+=dt;if(saveDue>.75){persist();saveDue=0}}
  }else keys.clear();
  updateSprite(dt);raf=requestAnimationFrame(step);
 }
 function action(event){
  const b=event.target.closest('[data-adventure]');if(!b||!container.contains(b)||b.disabled)return;const a=b.dataset.adventure;
  if(['map','quests','settings'].includes(a)){open({type:a});return}
  if(a==='motion'||a==='direct'||a==='text-size'){if(a==='motion')preferences.motion=!preferences.motion;else if(a==='direct')preferences.direct=!preferences.direct;else preferences.text=+b.dataset.size;stop();try{storage.setItem('mosaic:adventure:accessibility',JSON.stringify(preferences))}catch{storageNotice='Preferences could not be saved on this device.'}render();announce('Comfort settings updated.');return}
  if(a==='map-travel'&&pack.world&&state.visited.includes(b.dataset.room)&&!roomLock(state,b.dataset.room)){state.room=b.dataset.room;persist();close();announce(rooms[state.room].title);return}
  if(a==='track'){apply({type:'track',quest:b.dataset.quest});render();return}
  if(a==='field-answer'){message(apply({type:'field-answer',answer:+b.dataset.index}));return}if(a==='field-hint'){message(apply({type:'field-hint'}));return}
  if(a==='relay-turn'){apply({type:'relay-turn',index:+b.dataset.index});render();return}if(a==='relay-check'){const r=apply({type:'relay-check'});message(r,state.world.relay.solved?'decision':null);return}
  if(a==='close'){close();return}if(a==='journal'){open({type:'journal'});return}if(a==='menu'){open({type:'menu'});return}if(a==='objects'){open({type:'objects'});return}
  if(a==='hotspot'){walkTo(b.dataset.object);return}if(a==='object-list'){const id=b.dataset.object;close();walkTo(id);return}
  if(a==='choose-hero'){state.hero=b.dataset.hero;render();return}if(a==='begin'){apply({type:'hero',hero:state.hero});close();return}
  if(a==='character'){open({type:'character'});return}if(a==='change-hero'){apply({type:'hero',hero:b.dataset.hero});close();return}
  if(a==='verb'){verb=b.dataset.verb;if(verb!=='use')selectedItem=null;render();return}
  if(a==='inventory'){const id=b.dataset.item;if(verb==='look'){open({type:'item',item:id})}else{selectedItem=id;verb='use';render()}return}
  if(a==='select-item'){selectedItem=b.dataset.item;verb='use';close();return}
  if(a==='use-item'){selectedItem=b.dataset.item;verb='use';const r=apply({type:'repair',item:selectedItem});if(state.repaired)selectedItem=null;message(r);return}
  if(a==='plate'){apply({type:'plate',index:+b.dataset.index});feedback='';render();return}if(a==='clear-plates'){apply({type:'clear-plates'});feedback='';render();return}
  if(a==='run-sequence'){const r=apply({type:'sequence'});if(state.solved)message(r,pack.world?null:'decision');else{feedback=r.message;render();container.querySelector('.atlas-feedback')?.scrollIntoView({block:'nearest'})}return}
  if(a==='hint'){const r=apply({type:'hint',which:b.dataset.which});message(r);return}if(a==='decision'){if(pack.world&&(!state.world.relay.solved||state.room!=='tower'))return;open({type:'decision'});return}
  if(a==='choose-ending'){apply({type:'choice',id:b.dataset.choice});showEnding();return}
  if(a==='replay-prompt'){open({type:'replay'});return}if(a==='restart'){try{storage.setItem(saveKey+':previous',JSON.stringify(state))}catch{}state=initialAdventureState(pack);persist();selectedItem=null;open({type:'intro'});return}
  if(a==='exit'){stop();persist();onExit();return}if(a==='library'){close();stop();persist();onLibrary();return}
 }
 function pointer(event){if(event.target.closest('button,summary,a,input,select,textarea')||!event.target.closest('.atlas-scene')||panel)return;const rect=container.querySelector('.atlas-scene').getBoundingClientRect();walk((event.clientX-rect.left)/rect.width*100,(event.clientY-rect.top)/rect.height*100);container.querySelector('.atlas-scene')?.focus()}
 function keydown(event){
  if(!container.isConnected||!container.contains(event.target)||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(panel){if(event.key==='Escape'&&panel.type!=='intro'){event.preventDefault();close()}if(event.key==='Tab'){const controls=[...container.querySelectorAll('.atlas-panel button:not(:disabled),.atlas-panel summary,.atlas-panel a[href],.atlas-panel input:not(:disabled),.atlas-panel select:not(:disabled)')].filter(el=>el.getClientRects().length);if(controls.length){const at=controls.indexOf(document.activeElement),next=at<0?(event.shiftKey?controls.length-1:0):(at+(event.shiftKey?-1:1)+controls.length)%controls.length;event.preventDefault();controls[next].focus()}}return}
  if(document.querySelector('[aria-modal="true"]'))return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(key)){event.preventDefault();if(noMotion()||preferences.direct){if(event.repeat)return;stop();const pos=state.positions[state.room],dx=['ArrowRight','d'].includes(key)?1:['ArrowLeft','a'].includes(key)?-1:0,dy=['ArrowDown','s'].includes(key)?1:['ArrowUp','w'].includes(key)?-1:0;const point=floorPoint(pos);moveWithSlide(adventureNavigation(pack,state),point,dx*7,dy*7);Object.assign(pos,scenePoint(point));if(dx)state.facing=dx;persist();updateSprite(0)}else keys.add(key)}
  if(key==='e'){event.preventDefault();const pos=state.positions[state.room],nearest=available().map(([id,p])=>({id,distance:Math.hypot(p.x-pos.x,(p.y-pos.y)*1.75)})).sort((a,b)=>a.distance-b.distance)[0];if(nearest&&nearest.distance<12&&canReachObject(pack,state,anchors[state.room][nearest.id]))interact(nearest.id);else open({type:'objects'})}
  if(key==='Escape'){event.preventDefault();open({type:'menu'})}
 }
 const keyup=e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key),blur=()=>{stop();persist()},pagehide=()=>persist();
 container.addEventListener('click',action);container.addEventListener('pointerdown',pointer);document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);window.addEventListener('blur',blur);window.addEventListener('pagehide',pagehide);
 if(!state.started)panel={type:'intro'};render();if(panel)focusPanel();raf=requestAnimationFrame(step);
 return {destroy(){if(disposed)return;disposed=true;modalIsolation(false);announcer.remove();persist();cancelAnimationFrame(raf);container.removeEventListener('click',action);container.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',pagehide);container.innerHTML=''}};
}
