import water from '../public/topics/water-and-systems.json' with {type:'json'};
import fractions from '../public/topics/fractions-and-proportion.json' with {type:'json'};
import evidence from '../public/topics/evidence-and-arguments.json' with {type:'json'};
import waterTown from '../public/settlements/water-and-systems.json' with {type:'json'};
import fractionsTown from '../public/settlements/fractions-and-proportion.json' with {type:'json'};
import evidenceTown from '../public/settlements/evidence-and-arguments.json' with {type:'json'};
import waterChapter from '../public/chapters/water-and-systems.json' with {type:'json'};
import fractionsChapter from '../public/chapters/fractions-and-proportion.json' with {type:'json'};
import evidenceChapter from '../public/chapters/evidence-and-arguments.json' with {type:'json'};
import {validatePack} from '../src/engine.js';
import {validateSettlement} from '../src/quests.js';
import {validateChapterContent} from '../src/chapter-content.js';
import {rpgBundle} from '../src/rpg-progress.js';
export const RPG_WORLDS=[water,fractions,evidence].map((p,i)=>({world:validatePack(p),settlement:validateSettlement([waterTown,fractionsTown,evidenceTown][i]),chapter:validateChapterContent([waterChapter,fractionsChapter,evidenceChapter][i])}));
export const RPG_PACKS=RPG_WORLDS.map(p=>rpgBundle(p.world,p.settlement,p.chapter));
export function bundlePublishedChapter(chapter){const base=RPG_WORLDS.find(p=>p.world.id===chapter.topicId);return base?rpgBundle(base.world,base.settlement,chapter):null;}
