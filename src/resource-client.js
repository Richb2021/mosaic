import {learningJournal} from './game-modes/learning-client.js';
export async function workshopRequest(path,body,{dataEpoch,signal}={}){
 if(!learningJournal.connected)await learningJournal.connect();const account=learningJournal.user?.id||'';
 const response=await fetch('/api/workshop/'+path,{method:body?'POST':'GET',credentials:'same-origin',signal,headers:{'X-Mosaic-Learner':account,...(body?{'Content-Type':'application/json','X-Lanternbound-Workshop':'1','X-Mosaic-Data-Epoch':dataEpoch||'0:0'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json()}catch{throw Error('The resource service is unavailable. Your saved work is preserved.')}
 if((learningJournal.user?.id||'')!==account)throw Error('Your account changed. Reopen the library.');
 if(!response.ok)throw Object.assign(Error(data.error||data.message||'The request did not finish.'),{status:response.status});
 return {data,account,epoch:response.headers.get('X-Mosaic-Data-Epoch')};
}
export const readLibrary=async(path,signal)=>(await workshopRequest(path,undefined,{signal})).data;
