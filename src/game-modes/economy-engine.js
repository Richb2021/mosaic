// Pack version selects the rules. Original packs and replays remain unchanged.
import * as classic from './economy-classic.js';
import * as industry from './economy-industry.js';
export {GOODS,FACILITIES,REGIONS,TECHNOLOGIES,PRESETS,COUNCIL_RULES,COUNCIL_MONTHS,CONTRACTS,SHOCKS,ECONOMY_MONTHS,ECONOMY_SIZE,adjacent,waterTile,connectedEconomy,economySaveKey} from './economy-classic.js';
export {RETAIL,RETAIL_GOODS} from './economy-competition.js';
const engine=value=>value?.rulesVersion===2?industry:classic;
export const economyCatalog=value=>{const e=engine(value);return {goods:e.GOODS,facilities:e.FACILITIES,technologies:e.TECHNOLOGIES,contracts:e.CONTRACTS,councilRules:e.COUNCIL_RULES,retailGoods:value?.rulesVersion===2?['bread','tools','garments','furniture']:['bread','tools']};};
export const newEconomy=pack=>engine(pack).newEconomy(pack);
export const loadEconomy=(storage,pack)=>engine(pack).loadEconomy(storage,pack);
export const actEconomy=(pack,state,action)=>{if((pack.rulesVersion===2)!==(state.rulesVersion===2))throw Error('This campaign belongs to different rules.');return engine(pack).actEconomy(pack,state,action);};
export const encodeEconomy=(pack,state)=>engine(pack).encodeEconomy(pack,state);
export const restoreEconomy=(raw,pack)=>{if((raw?.rulesVersion===2)!==(pack.rulesVersion===2)||raw?.rulesVersion!==undefined&&raw.rulesVersion!==2)throw Error('This save belongs to different economic rules.');return engine(pack).restoreEconomy(raw,pack);};
export const forecastEconomy=s=>engine(s).forecastEconomy(s);
export const economyAssets=s=>engine(s).economyAssets(s);
export const economyGoals=(pack,s)=>engine(pack).economyGoals(pack,s);
export const pendingCouncil=s=>engine(s).pendingCouncil(s);
export const placementIssue=(s,...args)=>engine(s).placementIssue(s,...args);
export const tradeQuote=(s,...args)=>engine(s).tradeQuote(s,...args);
export const demandFor=(s,...args)=>engine(s).demandFor(s,...args);
