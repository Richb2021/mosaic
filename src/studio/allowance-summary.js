// One plain line about today's AI allowance, built from the pilot `budget`.
// aboutGenerations is already the lower of the dollar and generation limits, so the
// Studio shows only that number, never dollars or request counts.
export const ALLOWANCE_HREF='/welcome.html#allowance';
const clock=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const line=(used,main,when)=>({used,main,when,text:main+(when?' · '+when:'')});
export function allowanceSummary(budget,time=clock){
 if(!budget||budget.configured===false)return null;
 const n=budget.aboutGenerations;
 if(budget.appLimitReached)return line(true,'AI creation is paused for everyone today',budget.resetsAt?'resets '+time(budget.resetsAt):'');
 if(typeof n!=='number'||!Number.isFinite(n))return null;
 const g=budget.generations,next=n===0&&g&&g.remaining===0&&g.nextAvailableAt?g.nextAvailableAt:budget.resetsAt;
 if(n<=0)return line(true,'No AI creations left today',next?'more from '+time(next):'');
 return line(false,`About ${n} AI creation${n===1?'':'s'} left today`,budget.resetsAt?'resets '+time(budget.resetsAt):'');
}
