import {draftHash} from './draft-engine.js';

// All coefficients are authored game assumptions, never real economic forecasts.
export const ECONOMY_MONTHS=24, ECONOMY_SIZE=6;
export const GOODS={grain:{name:'Grain',base:3,art:'seed'},flour:{name:'Flour',base:5,art:'sack'},bread:{name:'Bread',base:9,art:'bread'},timber:{name:'Timber',base:4,art:'crate'},iron:{name:'Iron',base:6,art:'gear'},tools:{name:'Tools',base:22,art:'lever'}};
export const FACILITIES={
 road:{name:'Road',cost:3,upkeep:0,art:null},home:{name:'Housing',cost:30,upkeep:1,art:'home'},
 farm:{name:'Grain farm',cost:40,upkeep:2,workers:2,output:'grain',quantity:6,inputs:{},art:'garden'},
 mill:{name:'Flour mill',cost:50,upkeep:2,workers:2,output:'flour',quantity:5,inputs:{grain:1},art:'workshop'},
 bakery:{name:'Bakery',cost:60,upkeep:3,workers:2,output:'bread',quantity:4,inputs:{flour:1},art:'market'},
 forestry:{name:'Timber yard',cost:45,upkeep:2,workers:2,output:'timber',quantity:4,inputs:{},art:'warehouse'},
 mine:{name:'Iron mine',cost:60,upkeep:3,workers:3,output:'iron',quantity:3,inputs:{},art:'workshop',district:1},
 toolworks:{name:'Tool works',cost:85,upkeep:4,workers:3,output:'tools',quantity:2,inputs:{timber:1,iron:1},art:'power',tech:'machinery'},
 market:{name:'Market',cost:40,upkeep:2,art:'market'},warehouse:{name:'Warehouse',cost:35,upkeep:1,art:'warehouse'},
 school:{name:'School',cost:55,upkeep:2,art:'school'},clinic:{name:'Clinic',cost:55,upkeep:2,art:'clinic'},garden:{name:'Public garden',cost:30,upkeep:1,art:'garden'}
};
export const REGIONS=[{name:'Rivergate',cost:0,opens:0},{name:'Ironwood',cost:110,opens:4},{name:'Port Meridian',cost:140,opens:10}];
export const TECHNOLOGIES={machinery:{name:'Workshop machinery',cost:60,months:2,description:'Unlock tool works. Mills and bakeries can make one extra unit each month.'},logistics:{name:'Rail connections',cost:70,months:3,description:'Trade capacity rises from 12 to 24 units per month. Transport fees fall by one.'},sanitation:{name:'Clean production',cost:65,months:2,description:'Each active production building causes one less nature loss; public services gain two points.'}};
export const PRESETS={enterprise:{name:'Trading company',funds:550,regions:2,contracts:3,services:2,nature:40},regional:{name:'Regional development',funds:350,regions:3,contracts:3,services:8,nature:70}};
export const COUNCIL_MONTHS=[3,7,11,15,19,23];
export const COUNCIL_RULES=[
 [{label:'Invest 25 in the fair · demand +4 for three months',cost:25,boost:3},{label:'Keep the reserve',cost:0}],
 [{label:'Spend 30 on safeguards · nature +12',cost:30,nature:12},{label:'Delay safeguards · nature −8',cost:0,nature:-8}],
 [{label:'Spend 35 on staff education · services +3',cost:35,care:3},{label:'Retain cash',cost:0}],
 [{label:'Spend 30 on flood repairs · nature +10',cost:30,nature:10},{label:'Defer repairs · nature −10',cost:0,nature:-10}],
 [{label:'Spend 25 on the trading fair · demand +4 for three months',cost:25,boost:3},{label:'Keep the reserve',cost:0}],
 [{label:'Spend 35 on the community fund · services +3',cost:35,care:3},{label:'Keep funds for the next year',cost:0}]
];
export const CONTRACTS=Array.from({length:6},(_,i)=>({id:i,start:i*4,deadline:(i+1)*4,good:i%3===2?'tools':'bread',quantity:i%3===2?3:6,reward:i%3===2?90:66,name:['The station canteen','The winter market','The repair guild','The riverside fair','The port kitchens','The regional works'][i]}));
export const SHOCKS=[{month:6,title:'A lean harvest',text:'Farms produce two fewer grain units this month.',farm:-2},{month:12,title:'A busy market season',text:'Bread and tool demand rise by four this month.',demand:4},{month:18,title:'Timber supply disruption',text:'Timber yards produce two fewer units; timber trade costs rise.',timber:-2},{month:22,title:'Regional exhibition',text:'Bread and tool demand rise by four this month.',demand:4}];
const need=(ok,m)=>{if(!ok)throw Error(m)},int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blankStock=()=>Object.fromEntries(Object.keys(GOODS).map(k=>[k,0]));
export const adjacent=i=>[i%6>0?i-1:-1,i%6<5?i+1:-1,i>=6?i-6:-1,i<30?i+6:-1].filter(x=>x>=0);
export const waterTile=i=>i%6===5&&Math.floor(i/6)!==3;
function newBoard(){const b=Array(36).fill(null);b[18]={kind:'hall',enabled:true};for(let i=19;i<24;i++)b[i]={kind:'road',enabled:true};return b;}
export function newEconomy(pack){need(Object.hasOwn(PRESETS,pack.preset),'Unknown campaign preset.');const board=newBoard();for(const [i,kind] of [[12,'home'],[24,'home'],[26,'home'],[13,'farm'],[14,'mill'],[15,'bakery'],[16,'market'],[27,'warehouse']])board[i]={kind,enabled:true};return {month:0,funds:300,debt:0,stock:blankStock(),boards:[board,null,null],wage:2,tax:0,services:0,prices:{bread:9,tools:22},selling:{bread:true,tools:true},nature:85,care:0,tech:[],research:null,decisions:[],contracts:[],failedContracts:[],history:[],transactions:[],actions:[],status:'playing',rival:{bread:9,tools:22},boost:0,marketing:false,tradeUsed:0,sales:0};}
export function connectedEconomy(board){if(!board)return new Set();const roads=new Set([18]),q=[18];for(let i=0;i<q.length;i++)for(const n of adjacent(q[i]))if(board[n]?.kind==='road'&&!roads.has(n)){roads.add(n);q.push(n);}return new Set([...roads,...board.flatMap((b,i)=>b&&adjacent(i).some(n=>roads.has(n))?[i]:[])]);}
export function economyAssets(s){let people=0,care=s.care+(s.tech.includes('sanitation')?2:0),warehouses=0,markets=0;const production=[],connected=s.boards.map(connectedEconomy);for(let r=0;r<3;r++)s.boards[r]?.forEach((b,i)=>{if(!b||!connected[r].has(i)||!b.enabled)return;const f=FACILITIES[b.kind];if(b.kind==='home')people+=6;if(['school','clinic'].includes(b.kind))care+=3;if(b.kind==='warehouse')warehouses++;if(b.kind==='market')markets++;if(f?.output)production.push({region:r,index:i,...f,kind:b.kind});});return {people,care:care+s.services/2,capacity:18+warehouses*18,markets,production,connected,regions:s.boards.filter(Boolean).length};}
export function pendingCouncil(s){return s.status==='playing'&&COUNCIL_MONTHS.includes(s.month)&&!s.decisions.some(d=>d.event===COUNCIL_MONTHS.indexOf(s.month))?COUNCIL_MONTHS.indexOf(s.month):-1;}
export function tradeQuote(s,good){need(Object.hasOwn(GOODS,good),'Choose a known good.');const fee=s.tech.includes('logistics')?1:2,scarce=good==='timber'&&s.month+1===18?2:0;return {buy:GOODS[good].base+fee+scarce,sell:Math.max(1,GOODS[good].base-fee+scarce),capacity:s.tech.includes('logistics')?24:12};}
export function demandFor(s,good,assets=economyAssets(s)){const shock=SHOCKS.find(e=>e.month===s.month+1),base=good==='bread'?Math.floor(assets.people/2)+assets.regions*2:3+assets.regions;const sensitivity=good==='bread'?2:1;return Math.max(0,base+s.rival[good]-s.prices[good]*sensitivity+(sensitivity-1)*GOODS[good].base+(s.boost?4:0)+(s.marketing?4:0)+(shock?.demand||0)-s.tax*2);}
export function forecastEconomy(s){
 const a=economyAssets(s),stock={...s.stock},made=blankStock(),sold=blankStock(),waste=blankStock(),operations=[],shock=SHOCKS.find(e=>e.month===s.month+1);let workers=a.people,wages=0,upkeep=3,sales=0,materials=0,natureDelta=0;
 for(const board of s.boards)board?.forEach(b=>{if(b)upkeep+=FACILITIES[b.kind]?.upkeep||0;});
 for(const kind of ['farm','forestry','mine','mill','bakery','toolworks'])for(const f of a.production.filter(x=>x.kind===kind)){
  if(workers<f.workers){operations.push({...f,amount:0,reason:'Not enough workers'});continue;}
  let count=f.quantity+(s.wage===3?1:s.wage===1?-1:0)+(s.tech.includes('machinery')&&['mill','bakery'].includes(kind)?1:0)+(kind==='farm'?shock?.farm||0:kind==='forestry'?shock?.timber||0:0);
  count=Math.max(0,Math.min(count,...Object.entries(f.inputs).map(([g,n])=>Math.floor(stock[g]/n))));
  // Staff are paid for enabled, connected shifts, including input shortages.
  workers-=f.workers;wages+=f.workers*s.wage;
  for(const [g,n] of Object.entries(f.inputs))stock[g]-=n*count;
  stock[f.output]+=count;made[f.output]+=count;materials+=count*(['farm','forestry','mine'].includes(kind)?1:0);
  natureDelta-=count>0?Math.max(0,(kind==='mine'?3:kind==='farm'?0:1)-(s.tech.includes('sanitation')?1:0)):0;
  operations.push({...f,amount:count,reason:count?'Operating':'Input shortage'});
 }
 // Overflow occurs after the whole chain, before retail; capacity is per good.
 for(const g of Object.keys(stock)){waste[g]=Math.max(0,stock[g]-a.capacity);stock[g]=Math.min(stock[g],a.capacity);}
 for(const good of ['bread','tools'])if(s.selling[good]){sold[good]=Math.min(stock[good],demandFor(s,good,a),a.markets*(good==='bread'?8:3));stock[good]-=sold[good];sales+=sold[good]*s.prices[good];}
 for(let r=0;r<3;r++)s.boards[r]?.forEach((b,i)=>{if(b?.kind==='garden'&&a.connected[r].has(i))natureDelta+=3;});
 natureDelta+=s.services/4;const taxes=a.people*s.tax,interest=Math.ceil(s.debt*0.03),expenses=wages+upkeep+materials+interest+s.services,net=sales+taxes-expenses;
 return {...a,stock,made,sold,waste,operations,wages,upkeep,materials,interest,sales,taxes,expenses,net,natureDelta,nextFunds:s.funds+net,nextNature:clamp(s.nature+natureDelta,0,100),workersUsed:a.people-workers,shock};
}
export function economyGoals(pack,s){const p=PRESETS[pack.preset],a=economyAssets(s);return [{label:'Cash after debt',value:s.funds-s.debt,target:p.funds},{label:'Connected districts',value:a.regions,target:p.regions},{label:'Contracts fulfilled',value:s.contracts.length,target:p.contracts},{label:'Public services',value:a.care,target:p.services},{label:'Nature',value:s.nature,target:p.nature},{label:'Research completed',value:s.tech.length,target:2}];}
export function placementIssue(s,kind,region,index){if(!Object.hasOwn(FACILITIES,kind)||!int(region,0,2)||!int(index,0,35))return 'Choose a building and a valid tile.';if(!s.boards[region])return 'Connect this district before building.';if(s.boards[region][index])return 'This tile is occupied.';if(waterTile(index))return 'Keep the river clear; use the existing bridge.';const f=FACILITIES[kind];if(f.district!==undefined&&f.district!==region)return 'Iron mines belong in Ironwood.';if(f.tech&&!s.tech.includes(f.tech))return 'Research workshop machinery first.';if(s.funds<f.cost)return 'There is not enough cash for this building.';return '';}
function applyEconomy(pack,state,action){
 need(state.status==='playing','This campaign has ended. Review the ledger or start a new campaign.');need(action&&typeof action==='object'&&!Array.isArray(action),'Invalid campaign action.');
 need(pendingCouncil(state)<0||action.type==='decision','Resolve the council meeting first.');
 const s=structuredClone(state);s.actions=[];const before=s.funds;let description='';
 const pay=n=>{need(s.funds>=n,'There is not enough cash for this choice.');s.funds-=n;};
 if(action.type==='build'){const error=placementIssue(s,action.kind,action.region,action.index);need(!error,error);pay(FACILITIES[action.kind].cost);s.boards[action.region][action.index]={kind:action.kind,enabled:true};description='Build '+FACILITIES[action.kind].name;}
 else if(['remove','operate'].includes(action.type)){need(int(action.region,0,2)&&int(action.index,0,35),'Choose a valid tile.');const b=s.boards[action.region]?.[action.index];need(b&&b.kind!=='hall','Select a building other than the district hall.');if(action.type==='remove'){s.funds+=Math.floor(FACILITIES[b.kind].cost/2);s.boards[action.region][action.index]=null;description='Remove '+FACILITIES[b.kind].name;}else{need(FACILITIES[b.kind]?.output,'Only production shifts can be paused.');need(typeof action.enabled==='boolean','Choose an operating state.');b.enabled=action.enabled;description=(action.enabled?'Resume ':'Pause ')+FACILITIES[b.kind].name;}}
 else if(action.type==='price'){need(['bread','tools'].includes(action.good)&&int(action.value,action.good==='bread'?6:16,action.good==='bread'?12:28),'Choose a price in the displayed range.');s.prices[action.good]=action.value;description='Set '+action.good+' price';}
 else if(action.type==='selling'){need(['bread','tools'].includes(action.good)&&typeof action.enabled==='boolean','Choose a retail setting.');s.selling[action.good]=action.enabled;description=(action.enabled?'Sell ':'Reserve ')+action.good;}
 else if(action.type==='policy'){need(['wage','tax','services'].includes(action.policy),'Choose a known policy.');need((action.policy==='wage'&&int(action.value,1,3))||(action.policy==='tax'&&int(action.value,0,2))||(action.policy==='services'&&[0,4,8].includes(action.value)),'Choose an available policy level.');need(action.policy!=='tax'||pack.preset==='regional','Only regional councils set household tax.');s[action.policy]=action.value;description='Set '+action.policy+' policy';}
 else if(action.type==='loan'){need(action.amount===100&&s.debt<=200,'Borrow in blocks of 100, up to 300 outstanding.');s.debt+=100;s.funds+=100;description='Loan principal received';}
 else if(action.type==='repay'){need([50,100].includes(action.amount)&&s.debt>=action.amount,'Repay 50 or 100 of outstanding principal.');pay(action.amount);s.debt-=action.amount;description='Repay principal';}
 else if(action.type==='trade'){need(Object.hasOwn(GOODS,action.good)&&['buy','sell'].includes(action.side)&&int(action.quantity,1,24),'Choose a valid trade.');const q=tradeQuote(s,action.good);need(s.tradeUsed+action.quantity<=q.capacity,'Monthly transport capacity is used up.');if(action.side==='buy'){need(s.stock[action.good]+action.quantity<=economyAssets(s).capacity,'There is not enough warehouse space.');pay(q.buy*action.quantity);s.stock[action.good]+=action.quantity;}else{need(s.stock[action.good]>=action.quantity,'There is not enough stock.');s.stock[action.good]-=action.quantity;s.funds+=q.sell*action.quantity;}s.tradeUsed+=action.quantity;description=action.side+' '+action.quantity+' '+action.good;}
 else if(action.type==='research'){need(Object.hasOwn(TECHNOLOGIES,action.tech),'Choose a known research project.');need(!s.research&&!s.tech.includes(action.tech),'This research is already running or complete.');pay(TECHNOLOGIES[action.tech].cost);s.research={id:action.tech,remaining:TECHNOLOGIES[action.tech].months};description='Research '+TECHNOLOGIES[action.tech].name;}
 else if(action.type==='expand'){need(int(action.region,1,2)&&!s.boards[action.region]&&s.boards[action.region-1],'Connect districts in order.');need(s.month>=REGIONS[action.region].opens,'This route opens later in the campaign.');pay(REGIONS[action.region].cost);s.boards[action.region]=newBoard();description='Connect '+REGIONS[action.region].name;}
 else if(action.type==='marketing'){need(!s.marketing,'This month’s campaign is already funded.');pay(10);s.marketing=true;description='Fund one-month marketing';}
 else if(action.type==='contract'){const c=CONTRACTS.find(c=>c.id===action.id);need(c&&s.month>=c.start&&s.month<c.deadline&&!s.contracts.includes(c.id),'This contract is not available.');need(s.stock[c.good]>=c.quantity,'Reserve or buy the goods before delivering.');s.stock[c.good]-=c.quantity;s.funds+=c.reward;s.contracts.push(c.id);description='Deliver '+c.name;}
 else if(action.type==='decision'){const event=pendingCouncil(s);need(event>=0&&int(action.choice,0,1),'Choose an available council decision.');const effect=COUNCIL_RULES[event][action.choice];pay(effect.cost);s.nature=clamp(s.nature+(effect.nature||0),0,100);s.care+=effect.care||0;s.boost=Math.max(s.boost,effect.boost||0);s.decisions.push({event,choice:action.choice});description='Council: '+pack.events[event].choices[action.choice].label;}
 else if(action.type==='advance'){
  const f=forecastEconomy(s);s.month++;s.funds=f.nextFunds;s.stock=f.stock;s.nature=f.nextNature;s.sales+=f.sales;s.history.push({month:s.month,funds:s.funds,debt:s.debt,sales:f.sales,taxes:f.taxes,wages:f.wages,upkeep:f.upkeep,materials:f.materials,interest:f.interest,services:s.services,expenses:f.expenses,net:f.net,made:f.made,sold:f.sold,waste:f.waste,nature:s.nature});
  s.boost=Math.max(0,s.boost-1);s.marketing=false;s.tradeUsed=0;
  if(s.research&&--s.research.remaining===0){s.tech.push(s.research.id);s.research=null;}
  for(const c of CONTRACTS)if(c.deadline===s.month&&!s.contracts.includes(c.id))s.failedContracts.push(c.id);
  // Rival follows a public deterministic cycle; it cannot read hidden learner data.
  s.rival={bread:[9,8,10,9][s.month%4],tools:[22,20,24,21][s.month%4]};
  if(s.funds<0)s.status='insolvent';else if(s.month===ECONOMY_MONTHS)s.status=economyGoals(pack,s).every(g=>g.value>=g.target)?'complete':'review';
 }else throw Error('Unknown campaign action.');
 if(action.type!=='advance')s.transactions.push({month:s.month,description,change:s.funds-before,funds:s.funds});return s;
}
const ACTION_FIELDS={build:['kind','region','index'],remove:['region','index'],operate:['region','index','enabled'],price:['good','value'],selling:['good','enabled'],policy:['policy','value'],loan:['amount'],repay:['amount'],trade:['good','side','quantity'],research:['tech'],expand:['region'],marketing:[],contract:['id'],decision:['choice'],advance:[]};
export function actEconomy(pack,state,action){need(state.actions.length<600,'This campaign has reached its action limit.');need(state.actions.length<550||['advance','decision'].includes(action?.type),'Construction and trading limit reached. Finish the campaign using its remaining turns.');need(Object.hasOwn(ACTION_FIELDS,action?.type),'Unknown campaign action.');const clean={type:action.type};for(const key of ACTION_FIELDS[action.type])clean[key]=action[key];const next=applyEconomy(pack,state,clean);next.actions=[...state.actions,clean];return next;}
export const economySaveKey=pack=>`mosaic:economy:${pack.id}@${pack.revision}:${draftHash(pack)}`;
export const encodeEconomy=(pack,state)=>({format:1,packId:pack.id,revision:pack.revision,fingerprint:draftHash(pack),actions:state.actions});
export function restoreEconomy(raw,pack){need(raw&&raw.format===1&&raw.packId===pack.id&&raw.revision===pack.revision&&raw.fingerprint===draftHash(pack),'This campaign save belongs to different content.');need(Array.isArray(raw.actions)&&raw.actions.length<=600,'Invalid campaign history.');let s=newEconomy(pack);for(const action of raw.actions)s=actEconomy(pack,s,action);return s;}
export function loadEconomy(storage,pack){try{const raw=storage.getItem(economySaveKey(pack));if(raw===null)return {state:newEconomy(pack),notice:''};need(raw.length<=60000,'Campaign save is too large.');return {state:restoreEconomy(JSON.parse(raw),pack),notice:'Your campaign has been restored.'};}catch{return {state:newEconomy(pack),notice:'This campaign save could not be read. Its stored copy is preserved until you take a new action.'};}}
