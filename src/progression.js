// Original Lanternbound loadouts. Game AP measures practice with equipment,
// never a learner's academic mastery. Data stays separate from teaching packs.
export const ABILITIES={
 feint:{name:'Feint',owner:0,ap:6,mp:3,kind:'active',description:'A light strike exposes the foe. The next two damaging hits deal 50% more.'},
 lunge:{name:'Lantern lunge',owner:0,ap:9,mp:5,kind:'active',description:'A powerful strike that ignores a hardened shell.'},
 galeedge:{name:'Gale edge',owner:0,ap:9,mp:5,kind:'active',description:'A wind-infused sword strike; especially effective against crystal.'},
 ward:{name:'Shelter',owner:1,ap:6,mp:4,kind:'active',description:'Halves incoming damage to both heroes for two enemy turns.'},
 mend:{name:'Mending light',owner:1,ap:9,mp:6,kind:'active',description:'Restores 20 HP to both heroes, including a fallen companion.'},
 focus:{name:'Gather light',owner:1,ap:9,mp:0,kind:'active',description:'Restores 3 MP and empowers the next elemental spell by 50%.'},
 steadfast:{name:'Steadfast',ap:12,cost:2,kind:'support',description:'Reduces heavy attacks by another 25%.'},
 emberguard:{name:'Ember guard',ap:12,cost:1,kind:'support',description:'Prevents scorch damage.'},
 keen:{name:'Keen eye',ap:12,cost:2,kind:'support',description:'Reveals a foe’s weakness at the start of battle.'},
};
export const EQUIPMENT={
 'courier-blade':{name:'Courier blade',slot:'weapon',owner:0,attack:0,magic:0,price:0,ability:'feint',description:'A reliable blade, balanced for misdirection.'},
 'brass-sabre':{name:'Brass sabre',slot:'weapon',owner:0,attack:5,magic:0,price:44,ability:'lunge',description:'A weighted tip that finds the seam in a shell.'},
 'prism-edge':{name:'Prism edge',slot:'weapon',owner:0,attack:3,magic:3,price:58,ability:'galeedge',description:'A crystal edge humming with the wind.'},
 'keeper-staff':{name:'Keeper staff',slot:'weapon',owner:1,attack:0,magic:0,price:0,ability:'ward',description:'Made to hold a light steady in bad weather.'},
 'tide-rod':{name:'Tide rod',slot:'weapon',owner:1,attack:1,magic:4,price:44,ability:'mend',description:'A gentler light, shared between companions.'},
 'ember-staff':{name:'Ember staff',slot:'weapon',owner:1,attack:2,magic:5,price:58,ability:'focus',description:'Stores a little heat between spells.'},
 'travel-coat':{name:'Traveller’s coat',slot:'armor',defence:0,price:0,description:'Mended many times. Ready for another road.'},
 'reed-coat':{name:'Reed-woven coat',slot:'armor',defence:2,price:32,ability:'steadfast',description:'Bends under a blow without breaking.'},
 'cinder-cloak':{name:'Cinder cloak',slot:'armor',defence:1,price:36,ability:'emberguard',description:'Keeps flying embers away from the wearer.'},
 'survey-jacket':{name:'Surveyor’s jacket',slot:'armor',defence:3,price:48,ability:'keen',description:'Pockets full of careful field notes.'},
};
const own=(o,k)=>Object.hasOwn(o,k),integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
export const initialGrowth=()=>({inventory:['courier-blade','keeper-staff','travel-coat'],loadout:[{weapon:'courier-blade',armor:'travel-coat',support:[]},{weapon:'keeper-staff',armor:'travel-coat',support:[]}],ap:[{},{}],rally:[0,0]});
export function validGrowth(raw){
 if(raw===undefined)return initialGrowth();
 if(!raw||!Array.isArray(raw.inventory)||raw.inventory.length>10||new Set(raw.inventory).size!==raw.inventory.length||raw.inventory.some(id=>!own(EQUIPMENT,id))||!['courier-blade','keeper-staff','travel-coat'].every(id=>raw.inventory.includes(id)))return null;
 if(!Array.isArray(raw.loadout)||raw.loadout.length!==2||!Array.isArray(raw.ap)||raw.ap.length!==2||!Array.isArray(raw.rally)||raw.rally.length!==2||raw.rally.some(v=>!integer(v,100)))return null;
 const g=initialGrowth();g.inventory=[...raw.inventory];g.rally=[...raw.rally];
 for(let i=0;i<2;i++){
  const l=raw.loadout[i],ap=raw.ap[i];if(!l||!raw.inventory.includes(l.weapon)||EQUIPMENT[l.weapon]?.owner!==i||EQUIPMENT[l.weapon]?.slot!=='weapon'||!raw.inventory.includes(l.armor)||EQUIPMENT[l.armor]?.slot!=='armor'||!Array.isArray(l.support)||l.support.length>3||new Set(l.support).size!==l.support.length)return null;
  if(!ap||typeof ap!=='object'||Array.isArray(ap)||Object.entries(ap).some(([id,v])=>!own(ABILITIES,id)||!integer(v,ABILITIES[id].ap)||(ABILITIES[id].owner!==undefined&&ABILITIES[id].owner!==i)))return null;
  g.ap[i]={...ap};g.loadout[i]={weapon:l.weapon,armor:l.armor,support:[...l.support]};
  if(l.support.some(id=>!own(ABILITIES,id)||ABILITIES[id].kind!=='support'||!hasAbility(g,i,id))||l.support.reduce((n,id)=>n+ABILITIES[id].cost,0)>3)return null;
 }
 return g;
}
export const learned=(g,i,id)=>(g.ap[i][id]||0)>=ABILITIES[id].ap;
export function hasAbility(g,i,id){const a=ABILITIES[id];return !!a&&(a.owner===undefined||a.owner===i)&&(learned(g,i,id)||['weapon','armor'].some(slot=>EQUIPMENT[g.loadout[i][slot]].ability===id));}
export const availableSkills=(g,i)=>Object.keys(ABILITIES).filter(id=>ABILITIES[id].kind==='active'&&hasAbility(g,i,id));
export const bonus=(g,i,stat)=>['weapon','armor'].reduce((n,slot)=>n+(EQUIPMENT[g.loadout[i][slot]][stat]||0),0);
export const hasSupport=(g,i,id)=>g.loadout[i].support.includes(id)&&hasAbility(g,i,id);
export function equip(g,i,id){const e=EQUIPMENT[id];if(![0,1].includes(i)||!e||!g.inventory.includes(id)||e.owner!==undefined&&e.owner!==i)return false;g.loadout[i][e.slot]=id;g.loadout[i].support=g.loadout[i].support.filter(a=>hasAbility(g,i,a));return true;}
export function toggleSupport(g,i,id){if(![0,1].includes(i)||!Object.hasOwn(ABILITIES,id)||ABILITIES[id].kind!=='support'||!hasAbility(g,i,id))return false;const list=g.loadout[i].support;if(list.includes(id)){g.loadout[i].support=list.filter(a=>a!==id);return true}if(list.reduce((n,a)=>n+ABILITIES[a].cost,0)+ABILITIES[id].cost>3)return false;list.push(id);return true;}
export function awardAP(g,amount){const learnedNow=[];for(let i=0;i<2;i++)for(const slot of ['weapon','armor']){const id=EQUIPMENT[g.loadout[i][slot]].ability;if(!id)continue;const before=g.ap[i][id]||0;g.ap[i][id]=Math.min(ABILITIES[id].ap,before+amount);if(before<ABILITIES[id].ap&&learned(g,i,id))learnedNow.push({hero:i,id});}return learnedNow;}
export function buyEquipment(s,id){const e=EQUIPMENT[id];if(!e||!e.price||s.interior!=='outfitter'||s.battle||s.growth.inventory.includes(id)||s.gold<e.price)return false;s.gold-=e.price;s.growth.inventory.push(id);return true;}
