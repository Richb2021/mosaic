import {progressIdentity} from './learning-model.js';
import './save-status.css';

// Kept outside each game's render root so autosave updates never move game focus.
export function mountSaveStatus({journal,getCurrent,beforeFlush=()=>{},onReview=()=>{}}){
 const bar=document.createElement('aside');bar.className='game-save-status';bar.setAttribute('aria-label','Game saving');bar.hidden=true;
 bar.innerHTML='<details><summary><span class="game-save-dot" aria-hidden="true"></span><span role="status" aria-live="polite" aria-atomic="true">Autosave ready</span><span class="game-save-more">Save details</span></summary><div class="game-save-panel"><h2>Your game progress</h2><p></p><div><button type="button" data-save-retry>Save to account now</button><button type="button" data-save-reload>Reload game</button><button type="button" data-save-review>Review save versions</button><a href="/account.html" data-save-account>Sign in</a><button type="button" data-save-close>Close</button></div><small>Closing the browser can interrupt an upload. Progress saved on this device can sync when you reopen this game.</small></div></details>';
 document.body.prepend(bar);
 const details=bar.querySelector('details'),label=bar.querySelector('[role=status]'),copy=bar.querySelector('p'),retry=bar.querySelector('[data-save-retry]'),review=bar.querySelector('[data-save-review]'),account=bar.querySelector('[data-save-account]');
 function refresh(){
  const current=getCurrent();bar.hidden=!current;document.body.classList.toggle('has-game-save-status',!!current);if(!current){details.open=false;return}
  const status=journal.saveStatus(current.pack,current.kind);bar.dataset.state=status.state;
  if(label.textContent!==status.label)label.textContent=status.label;
  copy.textContent=status.detail;bar.querySelector('small').textContent=journal.user?'Closing the browser can interrupt an upload. Progress saved on this device can sync when you reopen this game.':'Guest progress stays on this device. Signed-in account saves are separate.';bar.querySelector('[data-save-reload]').hidden=!status.canReload;retry.hidden=!status.canRetry;review.hidden=!status.canReview;account.hidden=!!journal.user;
 }
 async function flush(){beforeFlush();const c=getCurrent();if(c)await journal.flush(progressIdentity(c.pack,c.kind));refresh()}
 async function beforeLeave(){
  // Do not trap the learner on a failed connection. Local recovery remains available.
  let timer;try{await Promise.race([flush(),new Promise(resolve=>{timer=setTimeout(resolve,8000)})])}finally{clearTimeout(timer)}
 }
 bar.querySelector('[data-save-reload]').addEventListener('click',()=>location.reload());
 retry.addEventListener('click',()=>void flush());review.addEventListener('click',()=>{details.open=false;onReview()});
 bar.querySelector('[data-save-close]').addEventListener('click',()=>{details.open=false;details.querySelector('summary').focus()});
 bar.addEventListener('keydown',event=>{if(event.key==='Escape'&&details.open){details.open=false;details.querySelector('summary').focus();event.stopPropagation()}});
 const hidden=()=>{if(document.visibilityState==='hidden')void flush()},leaving=()=>queueMicrotask(()=>void flush()),online=()=>void flush();
 document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leaving);window.addEventListener('online',online);
 journal.listeners.add(refresh);refresh();
 return {refresh,beforeLeave,destroy(){journal.listeners.delete(refresh);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leaving);window.removeEventListener('online',online);bar.remove();document.body.classList.remove('has-game-save-status')}};
}
