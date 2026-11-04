const prop=(asset,x,z,scale=1,rotation=0)=>({asset,x,z,scale,rotation});
const entity=(id,name,x,z,asset,extra={})=>({id,name,x,z,asset,kind:'works',...extra});
const door=(to,name,x,z)=>entity('room-'+to,name,x,z,'arch',{to});
const room=(id,name,props,obstacles,entities)=>({id,name,tag:'Underlight Works',works:true,interior:false,color:0x6f7168,sky:0x263944,music:'discovery',bounds:{x:12,z:10},props,obstacles,entities,backdrop:[],roads:[],boundaries:[]});
const base=[prop('works_pipe',-10,-7),prop('works_pipe',10,-7),prop('works_pillar',-10,3),prop('works_pillar',10,3)];
const walls=[[-12,0,.7,22],[12,0,.7,22],[0,-10,24,.7],[0,10,24,.7]];
export function worksMap(s){const c=s.chapter;const maps={
 entry:room('entry','The Sunken Concourse',[...base,prop('works_turbine',-7,-4),prop('room_table',7,-4),prop('room_crate',8,-6)], [...walls,[-7,-4,4,4],[7,-4,3,2]],[
 entity('nessa','Nessa, keeper of the Works',-2,1,'polyfork_villager_female'),entity('works-rest','Rest at the maintenance camp',5,3,'room_hearth'),entity('works-board','Play Lantern Lines',6,-1,'room_ledger'),door('gallery','The gear galleries',0,-7),door('workshop','The forgotten workshop',-8,5),entity('works-leave','Return to Tidewheel Mill',0,8,'arch')]),
 gallery:room('gallery','The Hanging Galleries',[...base,prop('works_turbine',-7,-3),prop('works_turbine',7,-3),prop('works_bridge',0,-1)], [...walls,[-7,-3,4,4],[7,-3,4,4],[-7,0,10,3],[7,0,10,3]],[
 entity('route','Route the signal',-4,-6,'works_console'),...(!c.defeated.includes('gallery')?[entity('encounter-gallery','Copper patrol',4.6,3.6,'works_beetle',{encounter:'gallery'})]:[]),door('entry','Back to the concourse',0,8),door('reservoir','The counterweight reservoir',9,7),door('heart','The Heart chamber',0,-8)]),
 reservoir:room('reservoir','The Counterweight Reservoir',[...base,prop('works_tank',-7,-4),prop('works_tank',7,-4),prop('waterwheel',0,-8,1.5)], [...walls,[-7,-4,4,4],[7,-4,4,4],[0,-8,3,2],[-7,3,3.5,4],[7,3,3.5,4]],[
 entity('balance','Balance the counterweights',0,-4,'works_console'),...(!c.defeated.includes('reservoir')?[entity('encounter-reservoir','Charged relay patrol',4,3,'works_sentry',{encounter:'reservoir'})]:[]),door('gallery','Back to the galleries',0,8),door('workshop','Maintenance passage',-9,6)]),
 workshop:room('workshop','The Quiet Workshop',[...base,prop('shelf',-8,-5),prop('room_counter',0,-6),prop('room_table',7,-4),prop('works_turbine',-7,1)], [...walls,[-8,-5,3,2],[0,-6,4,2],[7,-4,3,2],[-7,1,4,4]],[
 entity('repair-lift',c.shortcut?'Service lift repaired':'Nessa’s field skill: repair lift',4,0,'works_console'),entity('works-cache',c.cache?'Empty engineer’s cache':'A hidden engineer’s cache',-9,6,'chest'),entity('works-rest','Rest at the workbench',-2,-3,'room_chair'),door('entry','Concourse shortcut',0,8),door('reservoir','The reservoir',9,7),door('heart','Service lift to the Heart',0,-8)]),
 heart:room('heart','The Unwinding Heart',[...base,prop('works_pipe',-6,-7),prop('works_pipe',6,-7),prop('works_bridge',0,-2)], [...walls,[-8,-5,4,4],[8,-5,4,4]],[
 entity('transfer','Configure the new load',-5,1,'works_console'),...(!c.defeated.includes('heart')?[entity('encounter-heart','The Unwinding Heart',0,-7.8,'works_heart',{encounter:'heart'})]:[entity('works-aftermath','The first returning light',0,-7.8,'crystal')]),door('gallery','Back to the galleries',0,8),door('workshop','Service lift',-9,6)])};
 return maps[c.room];
}
// Standing height on a Works bridge, measured from the bridge model: the deck rises 1.4m at its centre over 4m
// either side and is 2.45m wide each way; the side girders beyond that are solid (see prop-collision.js).
export function worksHeight(map,x,z){
 if(!map?.works)return 0;const b=(map.props||[]).find(p=>p.asset==='works_bridge');if(!b)return 0;const s=b.scale??1;
 return Math.abs(x-b.x)<2.45*s?Math.max(0,1-Math.abs(z-b.z)/(4*s))*1.4*s:0;
}
