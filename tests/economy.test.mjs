import test from 'node:test';import assert from 'node:assert/strict';
import * as E from '../src/game-modes/economy-engine.js';
import {ECONOMY_PACKS} from '../src/game-modes/economy-packs.js';
import {validateEconomyContent,ECONOMY_ENDING} from '../src/game-modes/economy-content.js';
import {playCampaign} from './fixtures/economy-run.mjs';
import {observeProgress,normaliseProfile,LEARNING_TEMPLATES} from '../src/game-modes/learning-model.js';
import {generationRequest,bindGeneratedEvidence} from '../server/content-service.js';
import {learningActivities} from '../src/learning-map.js';
import {supportActivity} from '../src/studio/support-model.js';
import {TOWN_PACKS} from '../src/game-modes/town-packs.js';
import {newTown,encodeTown,restoreTown} from '../src/game-modes/town-engine.js';
import {gameSaveKey} from '../src/game-modes/learning-client.js';
const p=ECONOMY_PACKS[0],step=(s,a)=>E.actEconomy(p,s,a),start=()=>E.newEconomy(p);
for(const pack of ECONOMY_PACKS)test(`${pack.preset}: distinct complete campaign, source-backed decisions and exact replay`,()=>{
 const s=playCampaign(pack);assert.equal(s.month,24);assert.equal(s.status,'complete');assert.equal(s.decisions.length,6);assert.ok(s.contracts.length>=3);assert.ok(s.tech.includes('machinery'));assert.ok(s.tech.includes('sanitation'));assert.ok(s.boards[1].some(b=>b?.kind==='toolworks'));assert.deepEqual(E.restoreEconomy(E.encodeEconomy(pack,s),pack),s);assert.ok(E.economyGoals(pack,s).every(g=>g.value>=g.target));
 const record=observeProgress(pack,'classic',E.encodeEconomy(pack,s));assert.equal(record.summary.completed,true);assert.equal(record.summary.observations.length,6);assert.ok(record.summary.observations.every(o=>o.correct===null&&o.attempts===0&&o.sources.length));
 let cash=300;for(let month=0;month<24;month++){cash+=s.transactions.filter(t=>t.month===month).reduce((n,t)=>n+t.change,0);cash+=s.history[month].net;assert.equal(cash,s.history[month].funds);const h=s.history[month];assert.equal(h.expenses,h.wages+h.upkeep+h.materials+h.interest+h.services);assert.equal(h.net,h.sales+h.taxes-h.expenses);}
 assert.throws(()=>E.actEconomy(pack,s,{type:'advance'}),/ended/);
});
test('stock and cash conservation through production, retail, contracts and trade',()=>{
 let s=start();const f=E.forecastEconomy(s);assert.deepEqual(f.made,{grain:6,flour:5,bread:4,timber:0,iron:0,tools:0});assert.deepEqual(f.stock,{grain:1,flour:1,bread:0,timber:0,iron:0,tools:0});assert.equal(f.sales,36);assert.equal(f.wages,12);assert.equal(f.materials,6);assert.equal(f.net,2);
 s=step(s,{type:'trade',good:'bread',side:'buy',quantity:6});assert.equal(s.funds,234);s=step(s,{type:'contract',id:0});assert.equal(s.funds,300);assert.equal(s.stock.bread,0);assert.throws(()=>step(s,{type:'contract',id:0}),/not available/);
});
test('trade spread prevents immediate arbitrage; transport and storage caps are enforced',()=>{
 let s=start();for(const g of Object.keys(E.GOODS)){const q=E.tradeQuote(s,g);assert.ok(q.buy>q.sell);}
 s=step(s,{type:'trade',good:'grain',side:'buy',quantity:6});s=step(s,{type:'trade',good:'grain',side:'sell',quantity:6});assert.equal(s.funds,276);assert.equal(s.stock.grain,0);assert.throws(()=>step(s,{type:'trade',good:'grain',side:'buy',quantity:1}),/capacity/);
 assert.throws(()=>step(start(),{type:'trade',good:'grain',side:'sell',quantity:1}),/stock/);assert.throws(()=>step(start(),{type:'trade',good:'grain',side:'buy',quantity:-1}),/valid trade/);
});
test('placement rejects occupied, water, locked region, wrong resource and unresearched facility',()=>{
 for(const [kind,region,index] of [['home',0,18],['road',0,5],['home',2,12],['mine',0,0],['toolworks',0,0]])assert.throws(()=>step(start(),{type:'build',kind,region,index}));
 const s=step(start(),{type:'build',kind:'home',region:0,index:0});assert.equal(E.economyAssets(s).people,18);assert.equal(E.forecastEconomy(s).upkeep,E.forecastEconomy(start()).upkeep+1);assert.throws(()=>step(s,{type:'remove',region:0,index:18}),/hall/);
 for(const [r,board] of start().boards.entries())board?.forEach((b,i)=>{if(b)assert.equal(E.waterTile(i),false,`${r}/${i} starts on river`);});
});
test('road removal stops connected production; pause stops wages but not upkeep',()=>{
 const a=start(),paused=step(a,{type:'operate',region:0,index:13,enabled:false}),f=E.forecastEconomy(paused);assert.equal(f.made.grain,0);assert.equal(f.made.bread,0);assert.equal(f.wages,8);assert.equal(f.upkeep,E.forecastEconomy(a).upkeep);
 const cut=step(a,{type:'remove',region:0,index:19}),g=E.forecastEconomy(cut);assert.equal(g.made.bread,0);assert.equal(g.wages,0);assert.equal(g.upkeep,16);
});
test('worker allocation, wage bands and capacity have real consequences',()=>{
 let s=start();s=step(s,{type:'remove',region:0,index:12});s=step(s,{type:'remove',region:0,index:24});s=step(s,{type:'remove',region:0,index:26});assert.equal(E.forecastEconomy(s).workersUsed,0);assert.equal(E.forecastEconomy(s).sales,0);
 assert.equal(E.forecastEconomy(step(start(),{type:'policy',policy:'wage',value:3})).made.bread,5);
 assert.equal(E.forecastEconomy(step(start(),{type:'policy',policy:'wage',value:1})).made.bread,3);
 assert.throws(()=>step(start(),{type:'policy',policy:'tax',value:1}),/regional/);
});
test('price, rival cycle and marketing affect demand; old forecasts do not mutate state',()=>{
 const s=start(),before=JSON.stringify(s);const low=step(s,{type:'price',good:'bread',value:6}),high=step(s,{type:'price',good:'bread',value:12});assert.ok(E.demandFor(low,'bread')>E.demandFor(high,'bread'));E.forecastEconomy(s);assert.equal(JSON.stringify(s),before);
 const m=step(s,{type:'marketing'});assert.equal(E.demandFor(m,'bread'),E.demandFor(s,'bread')+4);assert.throws(()=>step(m,{type:'marketing'}),/already/);assert.equal(step(m,{type:'advance'}).marketing,false);assert.notEqual(step(s,{type:'advance'}).rival.bread,s.rival.bread);
});
test('loans separate principal from revenue; interest and repayments reconcile',()=>{
 let s=step(start(),{type:'loan',amount:100});assert.equal(s.funds,400);assert.equal(s.debt,100);assert.equal(E.forecastEconomy(s).interest,3);assert.equal(E.forecastEconomy(s).sales,36);s=step(s,{type:'repay',amount:50});assert.equal(s.funds,350);assert.equal(s.debt,50);assert.equal(E.forecastEconomy(s).interest,2);
 s=step(step(step(start(),{type:'loan',amount:100}),{type:'loan',amount:100}),{type:'loan',amount:100});assert.throws(()=>step(s,{type:'loan',amount:100}),/300/);
});
test('research takes months, cannot duplicate and unlocks only on completion',()=>{
 let s=step(start(),{type:'research',tech:'machinery'});assert.equal(s.funds,240);assert.throws(()=>step(s,{type:'research',tech:'logistics'}),/already/);s=step(s,{type:'advance'});assert.equal(s.tech.length,0);s=step(s,{type:'advance'});assert.deepEqual(s.tech,['machinery']);assert.equal(E.forecastEconomy(s).made.bread,5);assert.throws(()=>step(s,{type:'research',tech:'machinery'}),/already/);
});
test('council effects apply once and block other economic actions until resolved',()=>{
 let s=start();for(let i=0;i<3;i++)s=step(s,{type:'advance'});assert.equal(E.pendingCouncil(s),0);assert.throws(()=>step(s,{type:'loan',amount:100}),/council/);s=step(s,{type:'decision',choice:0});assert.equal(s.boost,3);assert.equal(s.decisions.length,1);assert.throws(()=>step(s,{type:'decision',choice:0}),/available/);
});
test('missed contract closes; insolvency and review are genuine terminal paths',()=>{
 let s=start();while(s.status==='playing'){if(E.pendingCouncil(s)>=0)s=step(s,{type:'decision',choice:1});s=step(s,{type:'advance'});}assert.equal(s.status,'review');assert.equal(s.failedContracts.length,6);
 let loss=start();for(const i of [13,14,15])loss=step(loss,{type:'operate',region:0,index:i,enabled:false});while(loss.status==='playing'){if(E.pendingCouncil(loss)>=0)loss=step(loss,{type:'decision',choice:1});loss=step(loss,{type:'advance'});}assert.equal(loss.status,'insolvent');assert.ok(loss.funds<0);assert.throws(()=>step(loss,{type:'loan',amount:100}),/ended/);
});
test('saved history rejects forged actions, foreign pack, impossible trade and excessive history',()=>{
 const raw=E.encodeEconomy(p,start());assert.throws(()=>E.restoreEconomy({...raw,actions:[{type:'award',cash:999}]},p));assert.throws(()=>E.restoreEconomy({...raw,actions:[{type:'trade',side:'sell',good:'bread',quantity:20}]},p));assert.throws(()=>E.restoreEconomy({...raw,fingerprint:'foreign'},p));assert.throws(()=>E.restoreEconomy({...raw,actions:Array(601).fill({type:'advance'})},p));assert.equal(E.restoreEconomy({...raw,funds:999999},p).funds,300);
});
test('all action fields reject nonfinite/fractional/out-of-range and prototype identifiers',()=>{
 for(const a of [{type:'price',good:'bread',value:NaN},{type:'build',kind:'home',region:0,index:1.1},{type:'trade',good:'__proto__',side:'buy',quantity:1},{type:'policy',policy:'services',value:7},{type:'research',tech:'constructor'},{type:'expand',region:-1},{type:'loan',amount:Infinity}])assert.throws(()=>step(start(),a));
});
test('stock reservation actually retains goods for delivery and overflow is recorded',()=>{
 let s=step(start(),{type:'selling',good:'bread',enabled:false});for(let i=0;i<3;i++)s=step(s,{type:'advance'});assert.equal(s.stock.bread,12);s=step(s,{type:'decision',choice:1});s=step(s,{type:'contract',id:0});assert.equal(s.stock.bread,6);
 let a=start();a.stock.grain=36;const f=E.forecastEconomy(a);assert.equal(f.waste.grain,1);assert.equal(f.stock.grain,36);
});
test('dynamic content is bounded, citations validated and generated mechanics cannot override authored rules',()=>{
 assert.equal(validateEconomyContent({...p,ending:'you mastered it'}).ending,ECONOMY_ENDING);assert.throws(()=>validateEconomyContent({...p,preset:'freeform'}));assert.throws(()=>validateEconomyContent({...p,rules:{funds:999}}));const invalid=structuredClone(p);invalid.concepts[0].sourceRefs=['foreign'];assert.throws(()=>validateEconomyContent(invalid));
 const job={template:'economy-v1',chapterId:'generated-economy',topicId:'business',goal:'Compare costs and capacity',evidence:p.sources,level:'Beginner'};const request=generationRequest(job);assert.deepEqual(request.text.format.schema.properties.learningMap.items.properties.activityKeys.items.enum,Array.from({length:6},(_,i)=>'council-'+i));const generated=bindGeneratedEvidence({...p,id:job.chapterId,topicId:job.topicId,sources:[{id:'fake'}]},job);assert.equal(generated.template,'economy-v1');assert.ok(generated.sources.every(s=>p.sources.some(t=>t.excerpt===s.excerpt)));
});
test('shared library, support, profile and storage keys accept the new format without changing classic towns',()=>{
 assert.equal(normaliseProfile({formats:LEARNING_TEMPLATES}).formats.length,9);assert.equal(gameSaveKey(p,'classic'),E.economySaveKey(p));assert.equal(learningActivities(p).length,6);assert.ok(supportActivity(p,'council-5').sources.length);
 for(const t of TOWN_PACKS){const save=encodeTown(t,newTown());assert.deepEqual(restoreTown(save,t),newTown());assert.notEqual(gameSaveKey(t,'classic'),gameSaveKey(p,'classic'));}
});

test('economy cloud saves use existing owner checks, replay validation and optimistic versions',async()=>{
 const {learningAPI}=await import('../server/learning-api.js');const {StoreError}=await import('../server/ncb-store.js');const {draftHash}=await import('../src/game-modes/draft-engine.js');
 class Store{rows=new Map();async latest(table,owner,slot){return this.rows.get([table,owner,slot].join(':'))||null;}async list(owner){return [...this.rows.values()].filter(r=>r.owner===owner&&r.table==='learner_saves');}async write(table,owner,slot,version,payload,now){const key=[table,owner,slot].join(':');if((this.rows.get(key)?.version||0)!==version)throw new StoreError('conflict',409);const row={table,owner,version:version+1,payload:JSON.stringify(payload),updated_ms:now};this.rows.set(key,row);return row;}}
 const store=new Store(),body={packId:p.id,contentHash:draftHash(p),kind:'classic',expectedVersion:0,snapshot:E.encodeEconomy(p,step(start(),{type:'advance'}))};
 const call=async(path,data,owner='alice')=>learningAPI(new Request('https://game.test/api/learning/'+path,{method:data?'POST':'GET',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':owner},body:data?JSON.stringify(data):undefined}),{},{store,session:async()=>({id:owner})});
 const response=await call('save',body);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.save.summary.template,'economy-v1');assert.equal(saved.save.summary.engagement,1);assert.equal((await call('save',body)).status,409);assert.equal((await (await call('journal',null,'bob')).json()).records.length,0);
 assert.equal((await call('save',{...body,expectedVersion:1,snapshot:{...body.snapshot,actions:[{type:'trade',good:'tools',side:'sell',quantity:24}]}})).status,400);
});
