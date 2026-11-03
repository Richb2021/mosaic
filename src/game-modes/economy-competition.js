// Authored, deterministic opponents. They see public market results only.
export const RETAIL = {
 bread:{min:6,max:12,unitCost:5,base:9,capacity:8},
 tools:{min:16,max:28,unitCost:11,base:22,capacity:3},
 garments:{min:12,max:24,unitCost:8,base:18,capacity:5},
 furniture:{min:24,max:40,unitCost:15,base:32,capacity:3}
};
export const RETAIL_GOODS=Object.keys(RETAIL);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function newRivals(){return [
 {id:'meridian',name:'Meridian Trading',strategy:'Volume trader',funds:180,quality:0,prices:{bread:8,tools:20,garments:16,furniture:28},capacity:{bread:4,tools:1,garments:2,furniture:1}},
 {id:'bramble',name:'Bramble & Co.',strategy:'Craft specialist',funds:220,quality:1,prices:{bread:10,tools:24,garments:21,furniture:36},capacity:{bread:3,tools:1,garments:1,furniture:1}}
 ].map(r=>({...r,stock:Object.fromEntries(RETAIL_GOODS.map(g=>[g,0])),history:[],decision:'Opening prices posted. Production is paid from our own treasury.'}));}
// Highest averages allocation gives whole-unit, supply-capped market shares.
// Unsupplied orders can go to another seller; ties rotate by month, not learner identity.
export function allocateMarket(buyers,offers,month=0){
 const sales=offers.map(()=>0),total=Math.max(0,Math.floor(buyers));
 for(let n=0;n<total;n++){
  let best=-1,score=-1;
  for(let k=0;k<offers.length;k++){const i=(k+month)%offers.length,o=offers[i];if(sales[i]>=o.supply)continue;const next=o.weight/(sales[i]+1);if(next>score){best=i;score=next;}}
  if(best<0)break;sales[best]++;
 }
 return {sales,unserved:total-sales.reduce((a,b)=>a+b,0)};
}
export function forecastCompetition(s,assets,playerStock,shock={}){
 const rivals=s.rivals.map(r=>{let cash=r.funds;const stock={...r.stock},made={},costs={};
  // Keep four cash for upkeep. Existing inventory is sold before restocking.
  for(const g of RETAIL_GOODS){const unit=RETAIL[g].unitCost+r.quality,qty=Math.min(Math.max(0,r.capacity[g]-stock[g]),Math.max(0,Math.floor((cash-4)/unit)));made[g]=qty;costs[g]=qty*unit;cash-=costs[g];stock[g]+=qty;}
  return {...r,stock,made,costs,productionCost:r.funds-cash,upkeep:Math.min(4,cash),sales:{},revenue:0};
 });
 const market={},sold={};let revenue=0,qualityCosts=0;
 for(const g of RETAIL_GOODS){
  const base={bread:12+assets.regions,tools:3+Math.floor(assets.regions/2),garments:5+Math.floor(assets.people/12),furniture:2+Math.floor(assets.regions/2)}[g];
  const buyers=Math.max(0,base+(shock?.demand||0)-s.tax*2),spec=RETAIL[g];
  const playerSupply=s.selling[g]?Math.min(playerStock[g],assets.markets*spec.capacity):0;
  const weight=(price,quality,promotion=0)=>Math.max(1,(spec.max+3-price)*2+quality*6+promotion);
  const offers=[{id:'player',name:'Your company',price:s.prices[g],quality:s.quality[g],supply:playerSupply,weight:weight(s.prices[g],s.quality[g],(s.boost?6:0)+(s.marketing?8:0))},...rivals.map(r=>({id:r.id,name:r.name,price:r.prices[g],quality:r.quality,supply:Math.min(r.stock[g],r.capacity[g]),weight:weight(r.prices[g],r.quality)}))];
  const allocation=allocateMarket(buyers,offers,s.month),rows=offers.map((o,i)=>({...o,sold:allocation.sales[i]}));
  sold[g]=rows[0].sold;revenue+=sold[g]*s.prices[g];qualityCosts+=sold[g]*s.quality[g];
  rivals.forEach((r,i)=>{r.sales[g]=rows[i+1].sold;r.revenue+=r.sales[g]*r.prices[g];r.stock[g]-=r.sales[g];});
  market[g]={buyers,unserved:allocation.unserved,offers:rows};
 }
 return {market,sold,revenue,qualityCosts,rivals:rivals.map(r=>({...r,closing:r.funds-r.productionCost-r.upkeep+r.revenue}))};
}
export function settleRivals(s,forecast){return forecast.rivals.map(r=>{
 const next={id:r.id,name:r.name,strategy:r.strategy,funds:r.closing,quality:r.quality,prices:{...r.prices},capacity:{...r.capacity},stock:{...r.stock},history:r.history},notes=[];let investment=0;
 for(const g of RETAIL_GOODS){const offer=forecast.market[g].offers.find(o=>o.id===r.id),spec=RETAIL[g];let price=r.prices[g];
  if(offer.sold<Math.ceil(offer.supply/2)&&offer.supply>0)price--;
  else if(offer.supply>0&&offer.sold===offer.supply&&r.prices[g]<s.prices[g])price++;
  else if(s.prices[g]<r.prices[g]&&forecast.market[g].offers[0].sold>offer.sold)price--;
  next.prices[g]=clamp(price,spec.min,spec.max);
  if(next.prices[g]!==r.prices[g])notes.push(`${g} price ${r.prices[g]} → ${next.prices[g]}`);
 }
 if((s.month+1)%3===0&&next.funds>=190){
  if(r.id==='bramble'&&r.quality<2){investment=85;next.quality++;notes.push('invested 85 in product quality');}
  else{const eligible=RETAIL_GOODS.filter(g=>r.capacity[g]<RETAIL[g].capacity&&r.sales[g]>=r.capacity[g]);eligible.sort((a,b)=>r.sales[b]-r.sales[a]);if(eligible.length){const g=eligible[0];investment=80;next.capacity[g]++;notes.push(`invested 80 in ${g} capacity`);}}
 }
 next.funds-=investment;
 next.history=[...r.history,{month:s.month+1,opening:r.funds,production:r.productionCost,upkeep:r.upkeep,revenue:r.revenue,investment,closing:next.funds,sold:{...r.sales}}];
 next.decision=notes.length?notes.join('; ')+'.':'Held prices and retained cash. No capacity investment this month.';return next;
 });}
