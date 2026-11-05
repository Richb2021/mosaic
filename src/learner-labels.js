// Names that teachers and organisers see in lists. Built only from labels (the teacher's or
// inviter's label, else the learner's display name), never from an email or account reference.
// When two people in one list share a name, the later joiners get " · 2", " · 3" so rows can be told apart.
export function distinctLabels(items,{label=x=>x.label,joined=x=>x.joined,fallback='Learner'}={}){
 const names=items.map(x=>String(label(x)||'').trim().replace(/\s+/g,' ')||fallback),groups=new Map();
 names.forEach((n,i)=>{const k=n.toLocaleLowerCase();if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i)});
 const out=[...names];
 for(const idx of groups.values()){
  if(idx.length<2)continue;
  const order=[...idx].sort((a,b)=>(Number(joined(items[a]))||0)-(Number(joined(items[b]))||0)||a-b);
  order.forEach((i,n)=>{if(n)out[i]=names[i]+' · '+(n+1)});
 }
 return out;
}
