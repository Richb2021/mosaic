export const LEVELS=['Not sure yet','Starting out','Building confidence','Applying ideas independently','Looking for a challenge'];
export const STAGES=['Independent learning','Primary','Secondary','College','University','Professional learning'];
export const INTERESTS=['Football','Stories & animation','Cooking','Music','Nature','Space','Building & business','History','Anime & manga','Gaming','Animals','Superheroes & comics','Art & drawing','Science & inventions','Other sports','Fantasy & myths','Mysteries & puzzles','Dance'];
export function profileContext(raw,text,need){
 const choice=(value,choices,fallback)=>{const v=value??fallback;need(choices.includes(v),'Choose an available profile option.');return v;};
 const interests=raw.interests??[];need(Array.isArray(interests)&&interests.length<=8&&interests.every(i=>INTERESTS.includes(i)),'Choose up to eight interests.');
 const access=raw.access??{};need(access&&typeof access==='object'&&!Array.isArray(access),'Invalid access preferences.');
 for(const k of ['captions','reducedMotion','textFirst'])need(access[k]===undefined||typeof access[k]==='boolean','Access choices must be on or off.');
 const minutes=raw.minutes??25;need([10,25,45].includes(minutes),'Choose 10, 25 or 45 minutes.');
 const examDate=text(raw.examDate??'',10);need(!examDate||/^\d{4}-\d{2}-\d{2}$/.test(examDate)&&!Number.isNaN(Date.parse(examDate))&&new Date(examDate).toISOString().slice(0,10)===examDate,'Use an exam date in YYYY-MM-DD format.');
 return {schemaVersion:2,stage:choice(raw.stage,STAGES,STAGES[0]),level:choice(raw.level,LEVELS,LEVELS[0]),interests:[...new Set(interests)],struggles:text(raw.struggles??'',1000),exam:text(raw.exam??'',240),examDate,minutes,access:{captions:access.captions??true,reducedMotion:access.reducedMotion??false,textFirst:access.textFirst??false}};
}
