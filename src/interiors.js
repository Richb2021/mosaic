// Buildings and residents belong to the world; learning stories bind to their IDs.
const building=(id,area,x,z,name,type,resident,model='polyfork_villager',shop=null)=>({id,area,x,z,name,type,resident,model,shop});
export const BUILDINGS=Object.fromEntries([
 building('inn','quay',-6,-3,'The Amber Lantern','inn','Maren, innkeeper','polyfork_villager_female'),
 building('provisioner','quay',5,-4,'Borin’s Provisions','shop','Borin, provisioner','polyfork_merchant','provisions'),
 building('harbour-hall','quay',-13,-11,'Harbour Hall','library','Sera, harbour clerk','polyfork_villager_female'),
 building('navigator','quay',13,-11,'The Chart House','study','Orin, navigator'),
 building('weaver','quay',-13,10,'Tess’s House','home','Tess, weaver','polyfork_villager_female'),
 building('bakery','quay',13,10,'The Copper Oven','bakery','Pell, baker','polyfork_tradesman'),
 building('millhouse','mill',-5,-4,'Rook’s Millhouse','workshop','Rook, millwright','polyfork_tradesman'),
 building('pumphouse','mill',-13,-11,'Pumpkeeper’s Lodge','study','Ada, pumpkeeper','polyfork_villager_female'),
 building('gardener','mill',13,-11,'The Garden Cottage','home','Fern, gardener'),
 building('workshop','forge',-5,-3,'Jori’s Workshop','workshop','Jori, lantern smith','polyfork_tradesman'),
 building('outfitter','forge',5,-4,'The Brass Thread','shop','Rennick, outfitter','polyfork_merchant','outfitter'),
 building('apprentice','forge',-13,-11,'Apprentices’ House','home','Lio, apprentice'),
 building('carpenter','forge',13,-11,'The Joinery','workshop','Dara, carpenter','polyfork_villager_female'),
 building('library','archive',-13,-11,'Cloudscript Reading Room','library','Sable, archivist','polyfork_villager_female'),
 building('apothecary','archive',13,-11,'The Blue Bottle','shop','Nella, apothecary','polyfork_merchant','apothecary'),
 building('scribe','archive',-13,10,'The Scribe’s House','study','Iris, scribe','polyfork_villager_female'),
 building('records','archive',13,10,'The Record House','library','Fen, record keeper'),
 building('star-room','observatory',-5,-4,'The Star Room','study','Edda, skywatcher','polyfork_villager_female'),
].map(b=>[b.id,b]));

const roomProp=(asset,x,z,rotation=0)=>({asset,x,z,scale:1,rotation});
export function makeInteriors(maps){
 const rooms={};
 for(const b of Object.values(BUILDINGS)){
  const exterior=maps[b.area],shell=exterior.props.find(p=>p.x===b.x&&p.z===b.z);
  if(!shell)throw Error('Missing building shell: '+b.id);
  const footprint=exterior.obstacles.find(o=>o[0]===b.x&&o[1]===b.z);
  b.door={x:b.x,z:b.z+footprint[3]/2+.85};shell.building=b.id;
  exterior.entities.push({id:'door-'+b.id,kind:'door',building:b.id,name:'Enter '+b.name,...b.door,asset:'sign'});
  const props=[],obstacles=[];
  const put=(asset,x,z,w,h,r=0)=>{props.push(roomProp(asset,x,z,r));if(w)obstacles.push([x,z,w,h])};
  put('room_counter',-3,-3.5,3.5,1);put('room_chair',-4,-1.6,.6,.6);
  put('lamp',5,-4.5,.5,.5);put('polyfork_barrel',5.5,3.2,.89,.89);
  if(['library','study'].includes(b.type)){
   for(const x of [-5.4,-2,1.4])put('shelf',x,-5,2.8,1.1);
   put('room_table',-4,1.1,2.4,1.3);put('room_chair',-4,2.4,.6,.6,Math.PI);
   if(b.id==='star-room')put('telescope',5,-2,1.2,1.2);
  }else if(b.type==='workshop'){
   put('forge',-5.4,1.1,2.1,1.8);put('room_crate',4.8,-4,1.3,1.1);put('room_table',3.8,-1.2,2.4,1.3);
  }else if(b.type==='shop'){
   for(const x of [-5,0,4])put('shelf',x,-5,2.8,1.1);
   put('room_crate',-5,2.2,1.3,1.1);put('room_crate',5,-1,1.3,1.1);
  }else{
   put('room_hearth',5,-4.8,2.3,1.1);put('room_table',-3.5,.8,2.4,1.3);
   put('room_chair',-3.5,2.1,.6,.6,Math.PI);put('bed',-5.4,3.6,1.3,1.9);
   if(b.type==='inn')put('bed',-5.4,-.7,1.3,1.9);
  }
  const entities=[
   {id:'resident',kind:'resident',name:b.resident,asset:b.model,x:-.8,z:-1.8},
   {id:'ledger',kind:'clue',name:['library','study'].includes(b.type)?'Read the desk notes':'Read the household ledger',asset:'room_ledger',x:3,z:-3.5},
   {id:'workbench',kind:'workbench',name:b.type==='inn'?'The supper table':b.type==='workshop'?'The repair bench':'The planning table',asset:'room_ledger',x:3,z:1.6},
   {id:'leave',kind:'leave',name:'Leave '+b.name,asset:'sign',x:0,z:5.25},
  ];
  if(['inn','library','shop'].includes(b.type))entities.push({id:'visitor',kind:'visitor',name:b.type==='inn'?'Hollis, travelling musician':b.type==='library'?'Anik, visiting reader':'A traveller',asset:'polyfork_villager',x:5,z:1.3});
  rooms[b.id]={name:b.name,tag:exterior.name,interior:true,building:b.id,type:b.type,music:'discovery',bounds:{x:6.7,z:5.6},color:0x765d46,sky:0x192a35,props,obstacles,entities,roads:[],backdrop:[],boundaries:[]};
 }
 return rooms;
}

export const RESIDENT_LINES={
 'harbour-hall':'The roads brought strangers here. Keeping our promises is what made us neighbours. Maren at the Amber Lantern is trying to bring everyone together tonight.',
 weaver:'Every thread matters, but a pattern tells you how they belong together. When a plan goes wrong, I check the smallest part before unpicking the whole cloth.',
 gardener:'Rook and I share the mill’s supplies. We used to argue over who took more. Now we write down what each of us actually needs.',
 pumphouse:'I keep yesterday’s marks beside today’s readings. A single mark tells a story; several help me check whether it is the right story.',
 apprentice:'Jori lets me make mistakes with scrap before I touch a real lantern. It is much easier to be brave when you can try again.',
 carpenter:'Measure, mark, cut. If I change the unit halfway through, even a beautiful drawing makes a crooked shelf.',
 provisioner:'I keep travelling supplies within reach. Tonics restore health; ether restores focus. Spend on what you need for the road ahead.',
 outfitter:'A good charm should do more than shine. The brass pin helps you weather a blow. The focus clasp gives a little more room for magic.',
 apothecary:'My tonics are for this adventure’s HP and MP. You can use them from your satchel before setting out again.',
};
