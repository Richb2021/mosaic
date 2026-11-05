// Per-person AI allowances set by the administrator. An allowance replaces one person's
// daily spending limit and 24-hour generation count until it expires. It never lifts the
// app-wide daily cap (PILOT_GLOBAL_DAILY_BUDGET_USD), which startCost still enforces.
const HOUR=3600000;
export const ALLOWANCE_HINT='Ask for a higher allowance on the Welcome page.';
export const ALLOWANCE_PRESETS={judge:{label:'Judge',dailyUsd:5,generations:40},extended:{label:'Extended',dailyUsd:3,generations:25}};
export const ALLOWANCE_REASONS={judge:'I’m a hackathon judge',more:'I need more for my class or project',pay:'I’d like to pay for more'};
export const REQUEST_CHANGES_PER_DAY=3;
// A typical generation reserves about this much before its usage is measured; used only for "about N more" wording.
export const TYPICAL_GENERATION_USD=0.2;
export const allowanceScope=siteOwner=>'allowance:'+siteOwner;
export const requestScope=siteOwner=>'allowance-request:'+siteOwner;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
// Validates an administrator's choice and returns the stored policy.
export function allowancePolicy({preset,custom,hours},{now,setBy,reason=null}){
 const h=hours===undefined||hours===null?72:hours;
 if(!Number.isInteger(h)||h<1||h>720)fail('Choose how long the allowance lasts: 1 hour to 30 days.');
 let base;
 if(preset==='judge'||preset==='extended')base={preset,...ALLOWANCE_PRESETS[preset]};
 else if((preset===undefined||preset==='custom')&&custom&&typeof custom==='object'){
  const dailyUsd=Math.round(Number(custom.dailyUsd)*100)/100,generations=Number(custom.generations);
  if(!Number.isFinite(dailyUsd)||dailyUsd<0.5||dailyUsd>50)fail('Choose a daily amount between $0.50 and $50.');
  if(!Number.isInteger(generations)||generations<1||generations>500)fail('Choose between 1 and 500 generations a day.');
  base={preset:'custom',label:'Custom',dailyUsd,generations};
 }else fail('Choose Judge, Extended or a custom allowance.');
 return {...base,reason,expires:now+h*HOUR,setBy,updated:now};
}
// A stored policy counts only while it is well-formed and unexpired.
export function activeAllowance(policy,now){
 if(!policy||typeof policy!=='object')return null;
 const {dailyUsd,generations,expires}=policy;
 if(!Number.isFinite(dailyUsd)||dailyUsd<0.5||dailyUsd>50||!Number.isInteger(generations)||generations<1||generations>500||!Number.isFinite(expires)||expires<=now)return null;
 return policy;
}
// `one` is a (sql,...values)=>row function. A failed lookup falls back to the default limits.
export async function readAllowance(one,siteOwner,now){
 try{const row=await one('SELECT policy FROM data_controls WHERE scope=?',allowanceScope(siteOwner));return activeAllowance(JSON.parse(row?.policy||'null'),now)}catch{return null}
}
export const publicAllowance=a=>a?{label:a.label,preset:a.preset,dailyUsd:a.dailyUsd,generations:a.generations,expires:a.expires}:null;
