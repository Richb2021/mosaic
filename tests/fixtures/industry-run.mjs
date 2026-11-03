import * as E from '../../src/game-modes/economy-engine.js';
export function playIndustryCampaign(pack){
 let state=E.newEconomy(pack);const step=a=>{try{return state=E.actEconomy(pack,state,a)}catch(e){throw Error(`Month ${state.month}, cash ${state.funds}, ${JSON.stringify(a)}: ${e.message}`)}},build=(kind,region,index)=>step({type:'build',kind,region,index});
 step({type:'price',good:'bread',value:12});step({type:'research',tech:'textiles'});build('garden',0,28);
 if(pack.preset==='regional')step({type:'policy',policy:'tax',value:0});
 while(state.status==='playing'){
  const m=state.month,event=E.pendingCouncil(state);if(event>=0)step({type:'decision',choice:[1,3].includes(event)||(pack.preset==='regional'&&event===2)?0:1});
  for(const good of ['flour','timber','iron']){const quantity=Math.min(Math.max(0,state.stock[good]-10),Math.max(0,E.tradeQuote(state,good).capacity-state.tradeUsed));if(quantity)step({type:'trade',good,side:'sell',quantity});}
  if(m===2){step({type:'remove',region:0,index:24});step({type:'remove',region:0,index:27});build('sheep',0,24);build('weavery',0,25);build('tailor',0,27);}
  if(m===4){step({type:'loan',amount:100});step({type:'loan',amount:100});step({type:'expand',region:1});step({type:'research',tech:'machinery'});}
  if(m===6){step({type:'loan',amount:100});build('forestry',1,12);build('mine',1,13);build('toolworks',1,14);build('home',1,24);build('home',1,26);}
  if(m===8)step({type:'research',tech:'sanitation'});
  if(m===14)step({type:'quality',good:'garments'});
  if(m===10){step({type:'research',tech:'joinery'});build('school',1,28);}
  if(m===12){step({type:'expand',region:2});build('garden',1,25);if(pack.preset==='regional')step({type:'policy',policy:'services',value:4});}
  if(m===13){build('sheep',2,12);build('weavery',2,13);build('forestry',2,14);build('furnitureworks',2,15);build('home',2,24);build('market',2,16);}
  for(const c of E.economyCatalog(pack).contracts)if(m===c.start){const quantity=Math.max(0,c.quantity-state.stock[c.good]);if(quantity)step({type:'trade',good:c.good,side:'buy',quantity});step({type:'contract',id:c.id});}
  // Compare the public current forecast; no hidden state or future rival data.
  for(const good of E.economyCatalog(pack).retailGoods){let best=state.prices[good],net=-Infinity;for(let value=E.RETAIL[good].min;value<=E.RETAIL[good].max;value++){const f=E.forecastEconomy({...state,prices:{...state.prices,[good]:value}});if(f.net>net){best=value;net=f.net;}}if(best!==state.prices[good])step({type:'price',good,value:best});}
  step({type:'advance'});
 }
 return state;
}
