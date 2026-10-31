import {ResourceWorkshop} from './resource-workshop.js';
import {initialChapter,contentKey,bindChapter,enterWorks,leaveWorks,moveRoom,roomLock,recruit,restWorks,solveMechanism,beginEncounter,chapterTurn,finishWorks,newBoard,playBoard,CHALLENGES} from './chapter.js';
import {validateChapterContent} from './chapter-content.js';
import {worksPanel,worksHUD} from './chapter-ui.js';
import {defaultSettings,validateSettings,keyAction,movementKey,playerPanel} from './player-tools.js';
import {Sound} from './sound.js';
import {validSave,hashPack,copy} from './engine.js';
import {getMap} from './maps.js';
export {keyAction,movementKey,worksHUD};
export class Expansion{
 constructor(get){this.get=get;this.resources=new ResourceWorkshop(this);this.content=new Map();this.customContent=new Map();this.sound=new Sound();this.settings=defaultSettings();try{this.settings=validateSettings(JSON.parse(localStorage.getItem('lanternbound:settings')))}catch{}this.gamepadButtons=[];this.gamepadKeys=new Set();this.lastFocus=0;}
 async load(packs){for(const p of packs){const r=await fetch('/chapters/'+p.id+'.json');if(!r.ok)throw Error('Chapter content unavailable');this.content.set(p.id,validateChapterContent(await r.json()))}try{const list=JSON.parse(localStorage.getItem('lanternbound:chapters')||'[]');if(Array.isArray(list)&&list.length<=20)for(const c of list){const v=validateChapterContent(c);this.content.set(v.topicId,v);this.customContent.set(v.topicId,v)}}catch{}}
 current(){return this.content.get(this.get().pack?.id)}
 bind(){const {state}=this.get(),c=this.current();if(c)bindChapter(state,c);else if(state.chapter.room){state.chapter=initialChapter();state.pos={x:4,z:7}}this.applySettings()}
 applySettings(){const {world}=this.get();document.documentElement.style.setProperty('--text-scale',this.settings.text/100);if(world)world.renderer.shadowMap.enabled=this.settings.quality!=='low';try{localStorage.setItem('lanternbound:settings',JSON.stringify(this.settings))}catch{}}
 slotKey(i){const {pack}=this.get();return `lanternbound:slot:${pack.id}:${hashPack(pack)}:${i}`}
 slot(i){try{const v=JSON.parse(localStorage.getItem(this.slotKey(i)));return v&&v.format===1&&typeof v.savedAt==='string'?v:null}catch{return null}}
 envelope(){const {state,pack}=this.get();return {format:1,packHash:hashPack(pack),chapter:this.current()?contentKey(this.current()):null,label:getMap(state).name,savedAt:new Date().toISOString(),state:copy(state)}}
 readSave(raw){const {pack}=this.get();if(typeof raw==='string'){if(new TextEncoder().encode(raw).length>262144)throw Error('Save must be smaller than 256 KB');raw=JSON.parse(raw)}if(!raw||raw.format!==1||raw.packHash!==hashPack(pack)||raw.chapter!==(this.current()?contentKey(this.current()):null))throw Error('This backup belongs to another topic or chapter revision.');const s=validSave(raw.state,pack);if(!s||s.chapter.content!==raw.chapter)throw Error('Save data is invalid.');return s}
 download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 panel(m,helpers){const resourcePanel=this.resources.panel(m,helpers);if(resourcePanel!==null)return resourcePanel;const {state}=this.get(),c=this.current();if(m.kind==='battle-pause'){const {button,wrap}=helpers;return wrap(`<h2 id="modal-title">A moment to think</h2><p>The battle waits while you are here.</p><div class="stack">${button('Player settings','player-settings')}${button('Save journal','save-slots')}${button('Music on / off','music')}${button('Return to battle','close')}</div>`)}const extra=playerPanel(m,state,this.settings,{...helpers,slots:i=>this.slot(i)});if(extra!==null)return extra;if(m.kind==='content-workshop'){
  const {esc,button,wrap}=helpers;return wrap(`<p class="town-kicker">Authored content · local preview</p><h2 id="modal-title">Chapter workshop</h2>${button('Create from learning material','resource-open','','primary')}<p>Export a chapter, replace its story, mechanisms and cited teaching notes, then import it for review. Geometry and game rules stay fixed. These files stay on this device; they are not a school account or a published class resource.</p>${c?`<p>Active: <b>${esc(c.title)}</b> · revision ${c.revision}</p>${button('Export chapter template','content-export')}`:'<p>This topic needs its own Underlight chapter. Export a template from another topic, then set its topicId to this topic’s id.</p>'}<label for="chapter-file">Import chapter JSON</label><input id="chapter-file" type="file" accept="application/json,.json"><p id="chapter-status" role="status">${esc(m.feedback||'')}</p><p class="muted">Use the resource library to generate a chapter with Muse Wonder from reviewed learning material. Manual imports remain available here.</p>${button('Return to the world','close')}`);
 }if(m.kind==='content-review'){const {esc,button,wrap}=helpers,d=m.draft;return wrap(`<p class="town-kicker">Review before activation</p><h2 id="modal-title">${esc(d.title)}</h2><p>Revision ${d.revision}. Activating a different revision starts a new Underlight chapter. Your previous progress is retained as a recovery copy on this device. The original eight-area adventure is preserved.</p><p>${esc(d.hook)}</p>${Object.entries(d.challenges).map(([id,q])=>`<section><h3>${esc(q.title)}</h3><p>${esc(q.objective)}</p><p>${esc(q.prompt)}</p><p><b>Expected configuration:</b> ${esc(Array.isArray(q.solution)?q.solution.map(v=>q.options?.[v]||q.labels[v]).join(' → '):q.solution)}</p><p>${esc(q.explanation)}</p></section>`).join('')}<h3>Source excerpts</h3>${d.sources.map(s=>`<blockquote>${esc(s.excerpt)}<footer>${esc(s.title)} · ${esc(s.locator)}</footer></blockquote>`).join('')}${button('Activate reviewed chapter','content-activate','','primary')}${button('Cancel','content-workshop')}`,{wide:true})}
 return c?worksPanel(m,state,c,helpers):null;
 }
 afterChange({rebuild=true}={}){const g=this.get();if(rebuild)g.rebuildWorld();g.save();g.renderHUD();g.music.set(g.state.battle||g.state.chapter.battle?'battle':getMap(g.state).music)}
 interact(e){const g=this.get(),{state,openModal,toast,world}=g,c=state.chapter;
  if(e.kind==='works-entrance'){if(!this.current()){openModal({kind:'content-workshop'});return true}if(enterWorks(state)){this.afterChange();toast('Underlight Works · a new chapter beneath the mill')}return true}
  if(e.kind!=='works')return false;
  if(e.to){const reason=roomLock(state,e.to);if(reason)openModal({kind:'dialogue',speaker:'The old passages',text:reason});else if(moveRoom(state,e.to))this.afterChange();return true}
  if(e.id==='works-leave'){leaveWorks(state);this.afterChange();return true}
  if(e.id==='nessa'){openModal({kind:'works-nessa'});return true}
  if(e.id==='works-rest'){restWorks(state);this.afterChange({rebuild:false});openModal({kind:'dialogue',speaker:'The maintenance camp',text:'A flask of tea, a checked tether and fresh charge in the lanterns. All three travellers recover their HP and MP for the Works.'});return true}
  if(e.id==='repair-lift'){if(!c.recruited)toast('Nessa knows how to repair this lift.');else{c.shortcut=true;this.sound.play('mechanism');this.afterChange();openModal({kind:'dialogue',speaker:'Nessa',text:'“There. A counterweight, not a stronger motor. This lift runs straight between the workshop and the Heart. We still need to stabilise the main system before we can face what’s inside.”'})}return true}
  if(e.id==='works-cache'){if(!c.cache){c.cache=true;state.gold=Math.min(9999,state.gold+25);this.afterChange();this.sound.play('reward');openModal({kind:'dialogue',speaker:'An engineer’s rainy-day fund',text:'Twenty-five coins and a note: “If you found the quiet route, you probably need these more than I do.”'})}else toast('The cache is empty.');return true}
  if(CHALLENGES.includes(e.id)){openModal({kind:'works-mechanism',id:e.id});return true}
  if(e.encounter){if(!c.recruited){openModal({kind:'dialogue',speaker:'A plan before the plunge',text:'Nessa is waiting in the concourse. Ask her to join before approaching the machines.'});return true}if(!beginEncounter(state,e.encounter)){toast('Configure the new load before starting the Heart.');return true}world.chapterBattle(state);g.save();g.renderHUD();g.music.set('battle');return true}
  if(e.id==='works-aftermath')openModal({kind:'works-aftermath'});
  if(e.id==='works-board')openModal({kind:'works-board',board:newBoard(),value:1});return true;
 }
 async act(a,el){
  if(await this.resources.act(a,el))return true;
  const g=this.get(),{state,world,modal:m,openModal,closeModal,renderModal,save,renderHUD,toast}=g,c=state.chapter;
  if(['works-journal','content-workshop','player-settings','save-slots'].includes(a)){openModal({kind:a==='works-journal'&&!this.current()?'content-workshop':a,sound:this.sound.enabled});return true}
  if(!/^(works-|player-|content-)/.test(a))return false;
  if(a==='works-recruit'&&m?.kind==='works-nessa'){recruit(state);closeModal();this.afterChange();toast('Nessa joined. Her field repair opens service lifts.');return true}
  if(a==='works-target'&&c.battle){const i=+el.dataset.index;if(c.battle.foes[i]?.hp>0)c.battle.target=i;world.sync(state);save();renderHUD();return true}
  if(a==='works-action'&&c.battle){const before=copy(state),r=chapterTurn(state,el.dataset.action,c.battle.target,this.settings.difficulty);if(!r.ok)return true;document.querySelectorAll('[data-act^="works-"]').forEach(b=>b.disabled=true);this.sound.play(el.dataset.action==='attack'?'strike':'magic');await world.playChapterAction(el.dataset.action,before,state,r);world.sync(state);save();renderHUD();if(!state.chapter.battle){this.afterChange();openModal({kind:r.result==='victory'&&before.chapter.battle.id==='heart'?'works-aftermath':'dialogue',speaker:r.result==='victory'?'The passage opens':'Together again',text:r.message});if(r.result==='victory')this.sound.play('reward')}return true}
  if(m?.kind==='works-mechanism'){
   const id=m.id,q=this.current().challenges[id];if(!c.solved.includes(id)){
    if(a==='works-route'&&c.mechanisms.route.length<3){const v=+el.dataset.index;if([0,1,2].includes(v)&&!c.mechanisms.route.includes(v))c.mechanisms.route.push(v)}
    if(a==='works-route-clear')c.mechanisms.route=[];
    if(a==='works-balance')c.mechanisms.balance=Math.max(0,Math.min(q.total,c.mechanisms.balance+(+el.dataset.delta)));
    if(a==='works-dial'){const i=+el.dataset.index;if([0,1,2].includes(i))c.mechanisms.transfer[i]=(c.mechanisms.transfer[i]+1)%3}
    if(a==='works-hint'){m.hint=true;if(!c.hints.includes(id))c.hints.push(id)}
    if(a==='works-test'){const r=solveMechanism(state,this.current(),id);m.feedback=r.message;if(r.ok){this.sound.play('mechanism');g.rebuildWorld();world.paused=true;renderHUD()}}
   }save();renderModal();return true;
  }
  if(a==='works-finish'&&m?.kind==='works-aftermath'){if(finishWorks(state,el.dataset.choice)){this.afterChange();world.paused=true;renderModal();this.sound.play('reward')}return true}
  if(m?.kind==='works-board'){
   if(a==='works-board-new'){m.board=newBoard();m.value=1}
   if(a==='works-board-value'&&m.board.hand.includes(+el.dataset.value))m.value=+el.dataset.value;
   if(a==='works-board-cell'&&playBoard(m.board,+el.dataset.index,m.value)){if(!m.board.hand.includes(m.value))m.value=m.board.hand[0];if(m.board.finished&&m.board.result==='win'){c.boardWins=Math.min(999,c.boardWins+1);if(!c.boardReward){state.gold=Math.min(9999,state.gold+20);c.boardReward=true}save();this.sound.play('reward')}}renderModal();return true;
  }
  if(a==='player-sound'){await this.sound.enable(!this.sound.enabled);m.sound=this.sound.enabled;this.sound.play('ui');renderModal();return true}
  if(a==='player-bindings'){const keys=Object.fromEntries([...document.querySelectorAll('[data-binding]')].map(i=>[i.dataset.binding,i.value.length===1?i.value.toLowerCase():i.value]));const proposed={...this.settings,keys};const clean=validateSettings(proposed);if(JSON.stringify(clean)!==JSON.stringify(proposed))m.feedback='Use six different letters or digits, or Escape. The old keys are unchanged.';else{this.settings=clean;this.applySettings();m.feedback='Key bindings saved.'}renderModal();return true}
  if(a==='player-slot-save'){const i=+el.dataset.slot;if(![1,2,3].includes(i))return true;if(this.slot(i))openModal({kind:'save-confirm',title:'Replace slot '+i+'?',description:'The current adventure will replace this manual save. Autosave continues separately.',operation:'save',slot:i});else{localStorage.setItem(this.slotKey(i),JSON.stringify(this.envelope()));m.feedback='Saved to slot '+i+'.';renderModal()}return true}
  if(a==='player-slot-load'){const i=+el.dataset.slot;if(![1,2,3].includes(i))return true;try{const restored=this.readSave(this.slot(i));openModal({kind:'save-confirm',title:'Load slot '+i+'?',description:'Your current autosave will be kept as a recovery copy before loading.',operation:'load',restored})}catch(e){m.feedback=e.message;renderModal()}return true}
  if(a==='player-save-confirm'&&m?.kind==='save-confirm'){if(m.operation==='save')localStorage.setItem(this.slotKey(m.slot),JSON.stringify(this.envelope()));else{localStorage.setItem(this.slotKey('recovery'),JSON.stringify(this.envelope()));g.setState(m.restored);this.afterChange()}openModal({kind:'save-slots',feedback:'Save journal updated.'});return true}
  if(a==='player-export'){this.download(this.envelope(),'lanternbound-save.json');return true}
  if(a==='content-export'&&this.current()){this.download(this.current(),this.current().id+'.json');return true}
  if(a==='content-activate'&&m?.kind==='content-review'){
   const draft=m.draft;localStorage.setItem(this.slotKey('chapter-recovery'),JSON.stringify(this.envelope()));const old=this.content.get(draft.topicId),oldCustom=this.customContent.get(draft.topicId);this.content.set(draft.topicId,draft);this.customContent.set(draft.topicId,draft);try{localStorage.setItem('lanternbound:chapters',JSON.stringify([...this.customContent.values()]))}catch(e){if(old)this.content.set(draft.topicId,old);else this.content.delete(draft.topicId);if(oldCustom)this.customContent.set(draft.topicId,oldCustom);else this.customContent.delete(draft.topicId);throw e}bindChapter(state,draft);this.afterChange();openModal({kind:'content-workshop',feedback:'Reviewed chapter activated. Previous progress retained as a recovery copy.'});return true;
  }return true;
 }
 async change(e){if(await this.resources.change(e))return true;const g=this.get(),el=e.target;
  if(el.dataset.setting){const key=el.dataset.setting;this.settings=validateSettings({...this.settings,[key]:key==='text'?+el.value:el.value});this.applySettings();return true}
  if(el.id==='save-file'&&el.files[0]){try{if(el.files[0].size>262144)throw Error('Save is too large');const restored=this.readSave(await el.files[0].text());g.openModal({kind:'save-confirm',title:'Load imported backup?',description:'The current autosave will be kept as a recovery copy.',operation:'load',restored})}catch(err){document.querySelector('#save-status').textContent='Import rejected: '+err.message}return true}
  if(el.id==='chapter-file'&&el.files[0]){try{if(el.files[0].size>131072)throw Error('Chapter is too large');const draft=validateChapterContent(await el.files[0].text());if(draft.topicId!==g.pack.id)throw Error('The chapter topicId must match the selected topic.');const old=this.current();if(old&&draft.id===old.id&&draft.revision<=old.revision&&JSON.stringify(draft)!==JSON.stringify(old))throw Error('Increase the revision for changed content.');g.openModal({kind:'content-review',draft})}catch(err){document.querySelector('#chapter-status').textContent='Import rejected: '+err.message}return true}return false;
 }
 focusStep(direction){const {modal}=this.get(),root=document.querySelector(modal?'#overlay':'#hud'),items=[...root.querySelectorAll('button:not(:disabled),select,input,textarea,summary')].filter(e=>e.getClientRects().length);if(!items.length)return;const i=items.indexOf(document.activeElement);items[(i+direction+items.length)%items.length].focus()}
 tick(){const g=this.get(),pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected&&p.mapping==='standard');if(!pad){for(const key of this.gamepadKeys)g.world.keys.delete(key);this.gamepadKeys.clear();this.gamepadButtons=[];return}const pressed=i=>!!pad.buttons[i]?.pressed,edge=i=>pressed(i)&&!this.gamepadButtons[i],menu=!!g.modal||!!g.state.chapter.battle||!!g.state.battle;
  for(const key of this.gamepadKeys)g.world.keys.delete(key);this.gamepadKeys.clear();
  if(!menu&&!g.world.actionBusy){const directions=[['ArrowLeft',pressed(14)||pad.axes[0]<-.35],['ArrowRight',pressed(15)||pad.axes[0]>.35],['ArrowUp',pressed(12)||pad.axes[1]<-.35],['ArrowDown',pressed(13)||pad.axes[1]>.35]];for(const [key,yes] of directions)if(yes){g.world.keys.add(key);this.gamepadKeys.add(key)}if(edge(0)){const near=g.world.nearest();if(near?.dist<2.3)g.interact(near)}if(edge(9))g.openModal({kind:'menu'})}
  else if(!g.world.actionBusy){if(edge(12)||edge(14))this.focusStep(-1);if(edge(13)||edge(15))this.focusStep(1);if(edge(0)){if(!document.activeElement?.closest('#overlay,#hud'))this.focusStep(1);else document.activeElement.click()}if(edge(9)&&!g.modal&&(g.state.battle||g.state.chapter.battle))g.openModal({kind:'battle-pause'});if(edge(1)&&g.modal&&!['intro','dialogue'].includes(g.modal.kind))g.closeModal()}
  this.gamepadButtons=pad.buttons.map(b=>b.pressed);
 }
}
