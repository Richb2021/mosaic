import {draftHash} from './draft-engine.js';
export const SIZE=8,MONTHS=12;
export const BUILDINGS={
 road:{name:'Road',cost:3,upkeep:0,rule:'Connects orthogonally to the town hall. A bridge can cross the river only on row 4.'},
 home:{name:'Home',cost:16,upkeep:1,rule:'4 residents and 3 income each month when connected.'},
 workshop:{name:'Workshop',cost:28,upkeep:4,rule:'Makes 4 goods with 4 residents available to work; input cost 1 per good, plus upkeep. Nature −3 each month.'},
 market:{name:'Market',cost:24,upkeep:3,rule:'Sells up to 6 goods at 4 each, limited by total demand (one per resident).'},
 warehouse:{name:'Storehouse',cost:22,upkeep:2,rule:'Adds 16 storage to the base capacity of 12; surplus goods are lost.'},
 school:{name:'School',cost:36,upkeep:3,rule:'2 service points for each connected home within 3 tiles (Manhattan distance).'},
 clinic:{name:'Clinic',cost:40,upkeep:4,rule:'2 service points for each connected home within 3 tiles. One school and one clinic can serve each home.'},
 garden:{name:'Garden',cost:20,upkeep:1,rule:'Adds 2 nature each month when connected.'},
 water:{name:'Water store',cost:26,upkeep:2,rule:'Adds 3 nature each month when connected. Must border the river.'}
};
export const GOALS={enterprise:{funds:180,people:12,care:4,nature:50},stewardship:{funds:80,people:12,care:8,nature:80}};
export const EVENT_MONTHS=[2,5,8,11];
export const EVENTS=[
 [{cost:12,nature:0,care:0,demand:4,label:'Spend 12 · next month demand +4'},{cost:0,nature:0,care:0,demand:0,label:'Keep funds · no extra demand'}],
 [{cost:8,nature:5,care:0,demand:0,label:'Spend 8 · nature +5'},{cost:0,nature:-5,care:0,demand:0,label:'Spend 0 · nature −5'}],
 [{cost:10,nature:6,care:0,demand:0,label:'Spend 10 · nature +6'},{cost:0,nature:-6,care:0,demand:0,label:'Defer repairs · nature −6'}],
 [{cost:12,nature:0,care:4,demand:0,label:'Spend 12 · permanent services +4'},{cost:0,nature:0,care:0,demand:0,label:'Keep funds · services unchanged'}]
];
const need=(ok,msg)=>{if(!ok)throw Error(msg)};
export const tileId=(x,y)=>y*SIZE+x;
export const tileXY=i=>({x:i%SIZE,y:Math.floor(i/SIZE)});
export const isRiver=i=>i%SIZE===6;
export const neighbors=i=>{const{x,y}=tileXY(i);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&a<SIZE&&b>=0&&b<SIZE).map(([a,b])=>tileId(a,b))};
function initial(){const board=Array(64).fill(null);board[tileId(2,3)]='hall';for(const x of[0,1,3,4,5,6,7])board[tileId(x,3)]='road';board[tileId(2,2)]='home';board[tileId(3,2)]='workshop';board[tileId(4,2)]='market';return {month:0,board,funds:200,goods:0,nature:72,training:0,demandBonus:0,decisions:[],history:[],status:'playing',actions:[]}}
export function newTown(){return initial()}
export function connectedTiles(state){const seen=new Set([tileId(2,3)]),queue=[tileId(2,3)];for(let q=0;q<queue.length;q++){for(const i of neighbors(queue[q]))if(state.board[i]==='road'&&!seen.has(i)){seen.add(i);queue.push(i)}}return new Set([...seen,...state.board.flatMap((kind,i)=>kind&&kind!=='road'&&neighbors(i).some(n=>seen.has(n))?[i]:[])])}
export function townStats(state){
 const connected=connectedTiles(state),of=kind=>state.board.flatMap((v,i)=>v===kind&&connected.has(i)?[i]:[]),homes=of('home'),people=homes.length*4;
 const distance=(a,b)=>{const p=tileXY(a),q=tileXY(b);return Math.abs(p.x-q.x)+Math.abs(p.y-q.y)};
 const care=homes.reduce((n,h)=>n+['school','clinic'].reduce((m,k)=>m+(of(k).some(i=>distance(i,h)<=3)?2:0),0),state.training);
 const workshops=of('workshop').length,activeWorkshops=Math.min(workshops,Math.floor(people/4)),production=activeWorkshops*4,capacity=12+16*of('warehouse').length;
 const stock=Math.min(capacity,state.goods+production),waste=Math.max(0,state.goods+production-capacity),demand=people+state.demandBonus,sold=Math.min(stock,demand,of('market').length*6);
 // Every built facility incurs upkeep even when disconnected; roads are free to maintain.
 const upkeep=2+state.board.reduce((n,k)=>n+(BUILDINGS[k]?.upkeep||0),0),inputCosts=production,expenses=upkeep+inputCosts,civicIncome=8+homes.length*3,sales=sold*4,revenue=civicIncome+sales,net=revenue-expenses;
 const natureDelta=2*of('garden').length+3*of('water').length-3*activeWorkshops;
 return {connected,people,care,workshops,activeWorkshops,production,capacity,stock,waste,demand,sold,civicIncome,sales,revenue,expenses,upkeep,inputCosts,net,natureDelta,nextNature:Math.max(0,Math.min(100,state.nature+natureDelta)),nextGoods:stock-sold,nextFunds:state.funds+net};
}
export function pendingEvent(state){const i=EVENT_MONTHS.indexOf(state.month);return state.status==='playing'&&i>=0&&state.decisions.length===i?i:-1}
export function townOutcome(pack,state){const stats=townStats(state),target=GOALS[pack.focus];const measures={funds:state.funds,people:stats.people,care:stats.care,nature:state.nature};return {target,measures,passed:Object.entries(target).every(([k,v])=>measures[k]>=v)}}
export function placementProblem(state,kind,index){if(state.status!=='playing')return 'This town’s year is finished.';if(pendingEvent(state)>=0)return 'Resolve the council decision first.';if(!Object.hasOwn(BUILDINGS,kind)||!Number.isInteger(index)||index<0||index>=64)return 'Choose a valid building and tile.';if(state.board[index])return 'This tile is occupied. Inspect or remove its building first.';if(isRiver(index)&&!(kind==='road'&&Math.floor(index/8)===3))return 'Keep the river clear. Cross at the existing bridge.';if(kind==='water'&&!neighbors(index).some(isRiver))return 'Water gardens must border the river.';if(state.funds<BUILDINGS[kind].cost)return 'There are not enough funds for this building.';return ''}
function apply(state,action,pack){
 need(state.status==='playing','This town’s year is finished.');need(action&&typeof action==='object','Invalid town action.');
 const s=structuredClone(state);s.actions=[];
 if(action.type==='build'){const why=placementProblem(state,action.kind,action.index);need(!why,why);s.board[action.index]=action.kind;s.funds-=BUILDINGS[action.kind].cost}
 else if(action.type==='remove'){need(pendingEvent(state)<0,'Resolve the council decision first.');need(Number.isInteger(action.index)&&action.index>=0&&action.index<64,'Choose a tile.');const kind=s.board[action.index];need(kind&&kind!=='hall','The town hall cannot be removed.');s.board[action.index]=null;s.funds+=Math.floor(BUILDINGS[kind].cost/2)}
 else if(action.type==='decision'){const e=pendingEvent(state);need(e>=0&&Number.isInteger(action.choice)&&action.choice>=0&&action.choice<2,'No such decision is available.');const effect=EVENTS[e][action.choice];need(s.funds>=effect.cost,'Not enough funds for this decision. Remove a building before the event, or choose the affordable option.');s.funds-=effect.cost;s.nature=Math.max(0,Math.min(100,s.nature+effect.nature));s.training+=effect.care;s.demandBonus+=effect.demand;s.decisions.push({event:e,choice:action.choice});}
 else if(action.type==='advance'){
  need(pendingEvent(state)<0,'Resolve the council decision before advancing.');const p=townStats(state);s.month++;s.funds=p.nextFunds;s.goods=p.nextGoods;s.nature=p.nextNature;s.demandBonus=0;s.history.push({month:s.month,funds:s.funds,goods:s.goods,nature:s.nature,people:p.people,care:p.care,revenue:p.revenue,expenses:p.expenses,upkeep:p.upkeep,inputCosts:p.inputCosts,sales:p.sales,civicIncome:p.civicIncome,sold:p.sold,production:p.production,waste:p.waste,net:p.net});if(s.funds<0)s.status='insolvent';else if(s.month===MONTHS)s.status=townOutcome(pack,s).passed?'complete':'review';
 }else throw Error('Unknown town action.');return s;
}
export function actTown(pack,state,action){need(state.actions.length<500,'This run has reached its 500-action limit. Start a new town.');const canonical=action.type==='build'?{type:'build',kind:action.kind,index:action.index}:action.type==='remove'?{type:'remove',index:action.index}:action.type==='decision'?{type:'decision',choice:action.choice}:{type:action.type};const s=apply(state,canonical,pack);s.actions=[...state.actions,canonical];return s}
export const townSaveKey=pack=>`mosaic:living-town:${pack.id}@${pack.revision}:${draftHash(pack)}`;
export function encodeTown(pack,state){return {format:1,packId:pack.id,revision:pack.revision,fingerprint:draftHash(pack),actions:state.actions}}
export function restoreTown(raw,pack){need(raw&&raw.format===1&&raw.packId===pack.id&&raw.revision===pack.revision&&raw.fingerprint===draftHash(pack),'This save belongs to different town content.');need(Array.isArray(raw.actions)&&raw.actions.length<=500,'Invalid town action history.');let state=newTown();for(const action of raw.actions)state=actTown(pack,state,action);return state}
export function loadTown(storage,pack){try{const raw=storage.getItem(townSaveKey(pack));if(raw===null)return {state:newTown(),notice:''};need(raw.length<=50000,'Save too large.');return {state:restoreTown(JSON.parse(raw),pack),notice:'Your town has been restored.'}}catch{return {state:newTown(),notice:'This saved town could not be restored. A new town is ready.'}}}
export function saveTown(storage,pack,state){try{storage.setItem(townSaveKey(pack),JSON.stringify(encodeTown(pack,state)));return ''}catch{return 'Saving is unavailable. Keep this page open to preserve your progress.'}}

export function townTransactions(pack,state){let current=newTown();const rows=[];for(const action of state.actions){const before=current;current=apply(current,action,pack);if(action.type==='advance')continue;const description=action.type==='build'?`Build ${BUILDINGS[action.kind].name}`:action.type==='remove'?`Remove ${BUILDINGS[before.board[action.index]].name} (half refund)`:pack.events[pendingEvent(before)].choices[action.choice].label;rows.push({afterMonth:before.month,description,change:current.funds-before.funds,funds:current.funds});}return rows}
