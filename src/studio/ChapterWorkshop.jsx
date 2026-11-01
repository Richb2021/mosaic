import React,{useEffect,useRef,useState} from 'react';
import {ResourceWorkshop} from '../resource-workshop.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Embed the existing reviewed-source pipeline. It owns its request IDs and
// resumes provider jobs; this wrapper never submits inference independently.
export function ChapterWorkshop({request,topic,client,onAttach,onClose}){
 const host=useRef(null),[current,setCurrent]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let closed=false,modal=null;const root=host.current;
  const render=()=>{if(closed||!modal)return;const focused=root.contains(document.activeElement)?document.activeElement.id:null;
   root.innerHTML=workshop.panel(modal,{esc,button:(label,action,attrs='',kind='')=>action==='resource-use'?'':`<button type="button" data-act="${action}" ${attrs} class="${kind}">${label}</button>`,wrap:html=>html});setLoading(false);
   if(focused)root.querySelector('#'+CSS.escape(focused))?.focus();
   if(modal.resource)setCurrent({type:'resource',value:modal.resource});if(modal.job?.draft)setCurrent({type:'chapter',value:modal.job});
  };
  const context={get:()=>({pack:{id:'water-and-systems'},get modal(){return modal},openModal:m=>{if(closed)return;modal=m;render();const title=root.querySelector('h2');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true})},renderModal:render}),download:(data,name)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}};
  const workshop=new ResourceWorkshop(context,{template:'quiz-v1'});
  const click=async e=>{const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;if(['close','resource-use'].includes(b.dataset.act)){onClose();return;}try{await workshop.act(b.dataset.act,b)}catch(e){setError(e.message)}};
  const change=e=>{void workshop.change(e).catch(e=>setError(e.message))};root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',change);
  void (async()=>{try{await workshop.refresh();if(closed)return;workshop.selected=new Set(topic.resources.filter(r=>workshop.resources.some(x=>x.id===r.id&&x.checksum===r.checksum&&x.status==='reviewed')).map(r=>r.id));workshop.form.goal=topic.goal;workshop.form.level=[client.journal.profile.level,client.journal.profile.context,client.journal.profile.interests.join(', ')].filter(Boolean).join('; ').slice(0,240);
   if(request.kind==='job'){await workshop.showJob(request.id,null);return;}
   const resource=workshop.resources.find(r=>r.id===request.id);
   context.get().openModal({kind:request.kind==='source'&&resource?'resource-source':request.kind==='add'?'resource-add':request.kind==='plan'?'resource-plan':'resource-library',...(resource?{resource}:{})});
  }catch(e){setError(e.message)}})();
  return()=>{closed=true;modal=null;clearTimeout(workshop.timer);root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',change)};
 },[request]);
 return <section className="cw-workshop"><div className="cw-workshop-top"><button onClick={onClose}>Back to topic</button><span>{topic.title}</span></div>{error&&<p role="alert" className="message error">{error}</p>}{current&&<div className="cw-attach"><p><strong>{current.value.draft?.title||current.value.title}</strong><br/>Keep this {current.type} with this topic. Linking it does not publish or assign it.</p><button className="primary" disabled={saving} onClick={async()=>{setSaving(true);setError('');try{await onAttach(current);setCurrent(null);onClose()}catch(e){setError(e.message)}finally{setSaving(false)}}}>Add {current.type} to topic</button></div>}{loading&&!error&&<p role="status">Opening the source workshop…</p>}<div ref={host} aria-busy={loading&&!error}/></section>;
}
