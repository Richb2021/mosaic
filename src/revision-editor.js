// Editable copy of a validated chapter. Identity, evidence and asset identifiers
// remain fixed; all edited values still pass the canonical server validator.
const locked=new Set(['learningMap','id','topicId','schemaVersion','template','revision','sources','sourceRefs','asset','icon','art','image','type']);
const label=s=>/^\d+$/.test(s)?String(Number(s)+1):s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());
export function revisionFields(content){
 const fields=[];
 const at=path=>path.reduce((v,key)=>v?.[key],content);
 function walk(value,path=[]){
  for(const [key,item] of Object.entries(value)){
   if(locked.has(key)||(['town-v1','economy-v1'].includes(content.template)&&key==='ending'))continue;
   const next=[...path,key];
   if(item&&typeof item==='object')walk(item,next);
   else if(typeof item==='string'||typeof item==='number'){
    const owner=Array.isArray(value)?at(path.slice(0,-1)):value;
    const answer=key==='solution'||path.at(-1)==='solution';
    const options=answer&&!owner?.total?(owner.options||owner.steps||owner.labels):path[0]==='recipes'&&path.at(-1)==='inputs'?content.items:null;
    const choices=typeof item==='number'&&Array.isArray(options)?options.map(x=>typeof x==='string'?x:x.label||x.name):null;
    fields.push({path:next.join('/'),label:next.map(label).join(' · '),type:typeof item,value:item,group:path[0]||'Overview',choices});
   }
  }
 }
 walk(content);return fields;
}
export function revisionEditorHTML(content,esc,{rawValues={},fieldErrors={}}={}){
 const fields=revisionFields(content),groups=[...new Set(fields.map(f=>f.group))];
 const control=f=>{const value=Object.hasOwn(rawValues,f.path)?rawValues[f.path]:f.value,attrs=`data-revision-path="${esc(f.path)}" aria-invalid="${fieldErrors[f.path]?'true':'false'}"`;return f.choices?`<select ${attrs}>${f.choices.map((choice,n)=>`<option value="${n}" ${Number(value)===n?'selected':''}>${esc(choice)}</option>`).join('')}</select>`:f.type==='number'?`<input ${attrs} type="number" step="1" value="${esc(value)}">`:`<textarea ${attrs} rows="${String(value).length>160?4:2}" maxlength="${f.path==='title'?100:5000}">${esc(value)}</textarea>`;};
 return groups.map((group,i)=>`<details class="review-group revision-group" ${i===0||fields.some(f=>f.group===group&&fieldErrors[f.path])?'open':''}><summary>${esc(label(group))}</summary>${fields.filter(f=>f.group===group).map(f=>`<label class="revision-field">${esc(f.label)}${control(f)}<small class="revision-error" role="status">${esc(fieldErrors[f.path]||'')}</small></label>`).join('')}</details>`).join('');
}
export function editRevisionField(content,path,value){
 const field=revisionFields(content).find(f=>f.path===path);if(!field)throw Error('That chapter field cannot be edited.');
 const keys=path.split('/');let parent=content;for(const key of keys.slice(0,-1))parent=parent[key];
 if(field.type==='number'){if(value===''||!Number.isSafeInteger(Number(value)))throw Error(field.label+': use a whole number.');parent[keys.at(-1)]=Number(value);}
 else parent[keys.at(-1)]=String(value);
}
