const stop=new Set('the and for with from that this into what when where which how why who they them their about should would could learner learning explain understand learn describe able use using topic source material notes chapter game create make'.split(' '));
export function goalTerms(goal){return [...new Set((goal.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(t=>!stop.has(t)))].slice(0,80);}
export function evidencePacket(resources,goal,selectedIds){
 const terms=goalTerms(goal),ranked=resources.flatMap((r,ri)=>r.units.map((u,i)=>({u,ri,i,score:terms.reduce((n,t)=>n+(u.excerpt.toLowerCase().includes(t)?1:0),0)}))).sort((a,b)=>b.score-a.score||a.ri-b.ri||a.i-b.i);
 let evidence=[],size=0;
 if(selectedIds!==undefined){
  if(!Array.isArray(selectedIds)||!selectedIds.length||selectedIds.length>12||new Set(selectedIds).size!==selectedIds.length)throw Error('Select one to twelve different source passages.');
  evidence=selectedIds.map(id=>{const r=ranked.find(r=>r.u.id===id);if(!r)throw Error('A selected passage is outside these reviewed sources.');return r.u});size=evidence.reduce((n,u)=>n+u.excerpt.length,0);if(size>18000)throw Error('Selected passages exceed 18,000 characters. Remove a passage before continuing.');
 }else for(const {u} of ranked){if(evidence.length===12)break;if(size+u.excerpt.length>18000)continue;evidence.push(u);size+=u.excerpt.length;}
 if(!evidence.length)throw Error('No reviewed source passages are available.');
 const selectedText=evidence.map(u=>u.excerpt.toLowerCase()).join('\n'),allText=ranked.map(r=>r.u.excerpt.toLowerCase()).join('\n');
 return {evidence,coverage:{method:'keyword-match',totalPassages:ranked.length,selectedPassages:evidence.length,omittedPassages:ranked.length-evidence.length,characters:size,terms,matched:terms.filter(t=>selectedText.includes(t)),elsewhere:terms.filter(t=>!selectedText.includes(t)&&allText.includes(t)),notFound:terms.filter(t=>!allText.includes(t))}};
}
