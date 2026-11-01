import {validatePlayableContent} from './content-registry.js';

export const REVIEWED_GAMES_KEY='mosaic:reviewed-games:v1';
export function readReviewedGames(storage){
 const data=JSON.parse(storage.getItem(REVIEWED_GAMES_KEY)||'[]');
 if(!Array.isArray(data)||data.length>20)throw Error('Saved game catalogue is invalid.');
 return data.map(validatePlayableContent).filter(p=>p.template!=='underlight-v1');
}
export function storeReviewedGame(storage,pack){
 const clean=validatePlayableContent(pack);
 if(clean.template==='underlight-v1')throw Error('Open this chapter through the RPG.');
 // Read at the time of registration. Another tab may have added a chapter
 // since this page loaded. Never replace its additions with a stale cache.
 const current=readReviewedGames(storage);
 const next=[clean,...current.filter(p=>p.id!==clean.id)].slice(0,20);
 storage.setItem(REVIEWED_GAMES_KEY,JSON.stringify(next));
 return next;
}
