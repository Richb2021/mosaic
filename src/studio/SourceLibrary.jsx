import React,{useEffect,useState} from 'react';
import {readLibrary} from '../resource-client.js';

function usePage(path,revision=0){
 const [state,setState]=useState({busy:false,data:null,error:''});
 useEffect(()=>{
  if(!path){setState({busy:false,data:null,error:''});return}
  const controller=new AbortController();setState({busy:true,data:null,error:''});
  readLibrary(path,controller.signal).then(data=>{if(!controller.signal.aborted)setState({busy:false,data,error:''})}).catch(e=>{if(!controller.signal.aborted)setState({busy:false,data:null,error:e.message})});
  return()=>controller.abort();
 },[path,revision]);return state;
}
function PageButtons({page,busy,history,cursor,onMove}){
 return <div className="library-page-actions"><button type="button" disabled={busy||!history.length} onClick={()=>onMove(history.at(-1),history.slice(0,-1))}>Previous page</button><button type="button" disabled={busy||!page?.nextCursor} onClick={()=>onMove(page.nextCursor,[...history,cursor])}>Next page</button></div>;
}
export function LibraryPicker({linked,onPick,disabled=false}){
 const [draft,setDraft]=useState(''),[status,setStatus]=useState('all'),[query,setQuery]=useState({q:'',status:'all'}),[cursor,setCursor]=useState(null),[history,setHistory]=useState([]),[revision,setRevision]=useState(0);
 const params=new URLSearchParams(query);if(cursor)params.set('cursor',cursor);
 const {busy,data:page,error}=usePage('resources?'+params,revision);
 const move=(c,h)=>{setCursor(c);setHistory(h)};
 return <div className="source-library"><form className="library-filters" onSubmit={e=>{e.preventDefault();setRevision(r=>r+1);setQuery({q:draft.trim(),status});move(null,[])}}><label>Find a source by title<input type="search" maxLength={240} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="For example, field notes"/></label><label>Review status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All sources</option><option value="reviewed">Reviewed</option><option value="unreviewed">Needs review</option></select></label><button disabled={busy}>Find sources</button></form>
 <div aria-live="polite">{busy&&<p>Opening this page of sources…</p>}{error&&<p role="alert">{error}</p>}{page&&<p>{page.total} of {page.limit} sources in your library. {page.matching} match this view; {page.resources.length} shown. Newest first.</p>}</div>
 {page?.resources.map(r=><div className="cw-existing" key={r.id}><div><b>{r.title}</b><small>{r.unitCount} passages · {r.status==='reviewed'?'Reviewed':'Needs review'}</small></div><button disabled={disabled||linked.includes(r.id)} onClick={()=>onPick(r)}>{linked.includes(r.id)?'Linked to topic':'Add source'}</button></div>)}{page&&!page.resources.length&&<p>No sources match. Clear the title or change the review filter.</p>}
 <PageButtons page={page} busy={busy} history={history} cursor={cursor} onMove={move}/></div>;
}
export function PassageFinder({sources,onOpen}){
 const [draft,setDraft]=useState(''),[scope,setScope]=useState('topic'),[query,setQuery]=useState(null),[cursor,setCursor]=useState(null),[history,setHistory]=useState([]),[revision,setRevision]=useState(0);
 const params=query?new URLSearchParams(query):null;if(params&&cursor)params.set('cursor',cursor);
 const {busy,data:page,error}=usePage(params?'search?'+params:null,revision),move=(c,h)=>{setCursor(c);setHistory(h)};
 return <section className="cw-search"><h3>Find the passage behind an idea</h3><form className="library-filters" onSubmit={e=>{e.preventDefault();setRevision(r=>r+1);setQuery({q:draft.trim(),...(scope==='topic'?{ids:sources.map(r=>r.id).join(','),status:'reviewed'}:{})});move(null,[])}}><label>Search source text<input type="search" maxLength={240} required value={draft} onChange={e=>setDraft(e.target.value)} placeholder="For example, denominator or steam engine"/></label><label>Search in<select value={scope} onChange={e=>{setScope(e.target.value);setQuery(null);move(null,[])}}><option value="topic">Reviewed topic sources</option><option value="library">My whole library</option></select></label><button disabled={busy||scope==='topic'&&!sources.length}>Find passages</button></form>
 <p>Word matches help you locate evidence; they do not prove it supports a learning goal. Sources appear newest first.</p>
 <div aria-live="polite">{busy&&<p>Searching your sources…</p>}{error&&<p role="alert">{error}</p>}{page&&<p>{page.results.length} matching passages on this page for “{query.q}”. {page.sourceCount} sources in scope. {page.nextCursor?'Continue to search the remaining passages.':'Reached the end of this search.'}</p>}</div>
 {page?.results.map(r=><details key={r.resourceId+r.id}><summary>{r.title} — {r.locator} <span>{r.status==='reviewed'?'Reviewed':'Needs review'}</span></summary><blockquote><p>{r.excerpt}</p></blockquote><button onClick={()=>onOpen(r.resourceId)}>Open source</button></details>)}
 {page&&<PageButtons page={page} busy={busy} history={history} cursor={cursor} onMove={move}/>}</section>;
}
