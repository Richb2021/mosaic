import * as E from '../../src/game-modes/economy-engine.js';
export function playCampaign(pack){let state=E.newEconomy(pack);const step=action=>state=E.actEconomy(pack,state,action);
 step({type:'price',good:'bread',value:12});step({type:'research',tech:'machinery'});step({type:'build',kind:'garden',region:0,index:25});
 if(pack.preset==='regional')step({type:'policy',policy:'tax',value:1});
 while(state.status==='playing'){
  const event=E.pendingCouncil(state);if(event>=0)step({type:'decision',choice:pack.preset==='enterprise'?1:[0,3,4].includes(event)?1:0});
  if(state.month===4){step({type:'loan',amount:100});step({type:'expand',region:1});for(const [kind,index] of [['forestry',12],['mine',13],['toolworks',14]])step({type:'build',kind,region:1,index});}
  if(state.month===8)step({type:'research',tech:'sanitation'});
  if(state.month===10&&pack.preset==='regional')step({type:'expand',region:2});
  if(state.month===12){step({type:'build',kind:'school',region:0,index:28});if(pack.preset==='regional')step({type:'policy',policy:'services',value:4});}
  for(const c of E.CONTRACTS)if(state.month===c.start){const quantity=Math.max(0,c.quantity-state.stock[c.good]);if(quantity)step({type:'trade',good:c.good,side:'buy',quantity});step({type:'contract',id:c.id});}
  if(pack.preset==='enterprise')for(const good of ['bread','tools']){let best=state.prices[good],net=-Infinity;for(let value=good==='bread'?6:16;value<=(good==='bread'?12:28);value++){const f=E.forecastEconomy({...state,prices:{...state.prices,[good]:value}});if(f.net>net){best=value;net=f.net;}}if(best!==state.prices[good])step({type:'price',good,value:best});}
  step({type:'advance'});
 }
 return state;
}
