// Shared by authored game interfaces; no content or save-state changes.
export function focusToken(root, element = root.ownerDocument.activeElement) {
  if (!element || !root.contains(element)) return null;
  return {id: element.id, data: {...element.dataset}, label: element.getAttribute('aria-label') || element.textContent.trim()};
}

export function restoreFocus(root, token) {
  if (!token) return false;
  const element = [...root.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')].find(el =>
    token.id ? el.id === token.id : Object.entries(token.data).every(([key,value]) => el.dataset[key] === value) &&
    (el.getAttribute('aria-label') || el.textContent.trim()) === token.label);
  if (!element || element.disabled || element.closest('[inert]')) return false;
  element.focus({preventScroll:true});
  return root.ownerDocument.activeElement === element;
}

export function modalAccess(root) {
  const prior = new Map();
  const clear = () => { for (const [el,inert] of prior) el.inert = inert; prior.clear(); };
  return {
    sync(dialog) {
      clear();
      if (!dialog) return;
      // Include outer save bars as well as the game's own controls. Restore
      // original values on close, re-render and unmount, including nested UI.
      for (let node=dialog; node && node!==root.ownerDocument.body; node=node.parentElement) {
        for (const sibling of node.parentElement?.children || []) {
          if (sibling===node || sibling.hasAttribute('data-game-announcer') || ['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) continue;
          prior.set(sibling,sibling.inert); sibling.inert=true;
        }
      }
    },
    key(event,dialog) {
      if (event.key!=='Tab' || !dialog) return false;
      const items=[...dialog.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')].filter(el =>
        !el.disabled && el.tabIndex>=0 && !el.closest('[inert],[hidden]') && el.getClientRects().length);
      event.preventDefault();
      const index=items.indexOf(root.ownerDocument.activeElement);
      const next=index<0 ? (event.shiftKey?items.length-1:0) : (index+(event.shiftKey?-1:1)+items.length)%items.length;
      (items[next] || dialog).focus();
      return true;
    },
    destroy:clear,
  };
}

export function gameAnnouncer(root) {
  const node=root.ownerDocument.createElement('div');
  node.setAttribute('data-game-announcer',''); node.setAttribute('role','status');
  node.setAttribute('aria-live','polite'); node.setAttribute('aria-atomic','true');
  node.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
  root.after(node); let timer;
  return {say(text){clearTimeout(timer);node.textContent='';timer=setTimeout(()=>{node.textContent=text||'';},50);},destroy(){clearTimeout(timer);node.remove();}};
}
