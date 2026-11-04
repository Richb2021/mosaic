import test from 'node:test';
import assert from 'node:assert/strict';
import {worksMap,worksHeight} from '../src/chapter-maps.js';
import {solidProps,navigationMap} from '../src/prop-collision.js';
import {safePosition,blocked} from '../src/navigation.js';

const rooms=['entry','gallery','reservoir','workshop','heart'];
const map=(room,defeated=[])=>worksMap({chapter:{room,defeated}});

test('standing height on Works bridges follows the bridge model (peak 1.4m at its centre, 2.45m deck each side)', () => {
 for(const room of ['gallery','heart']){
  const m=map(room),b=m.props.find(p=>p.asset==='works_bridge');
  assert.equal(worksHeight(m,b.x,b.z),1.4,room+' centre');
  assert.ok(Math.abs(worksHeight(m,b.x+2.3,b.z+2)-0.7)<1e-9,room+' near the rail, halfway down');
  assert.equal(worksHeight(m,b.x+2.9,b.z),0,room+' beside the bridge is floor level');
  assert.equal(worksHeight(m,b.x,b.z+4.5),0,room+' past the ramp');
 }
 assert.equal(worksHeight(map('entry'),0,0),0,'rooms without a bridge are flat');
});

test('no Works character, console or enemy body overlaps a wall, rail or girder', () => {
 for(const room of rooms)for(const defeated of [[],rooms]){
  const m=map(room,defeated),solid=solidProps(m).obstacles,bodies=navigationMap({...m,obstacles:[]}).obstacles;
  for(const [x,z,w,h] of bodies)for(const [cx,cz,cw,ch] of solid){
   const ox=Math.min(x+w/2,cx+cw/2)-Math.max(x-w/2,cx-cw/2),oz=Math.min(z+h/2,cz+ch/2)-Math.max(z-h/2,cz-ch/2);
   assert.ok(!(ox>0.01&&oz>0.01),`${room}: body at ${x},${z} overlaps solid at ${cx},${cz}`);
  }
 }
});

test('a blocked position is moved into the main walkable area, never into an enclosed pocket', () => {
 // A small pocket fenced off at the top-left corner, right next to the blocked spot.
 const m={bounds:{x:6,z:6},obstacles:[[-4,-3.5,4,.4],[-1.8,-5,.4,3],[-4.5,-5.2,.5,.5]]};
 const start={x:-4.5,z:-5.2};assert.ok(blocked(m,start.x,start.z));
 const p=safePosition(m,start);assert.ok(p);
 assert.ok(!(p.x<-2&&p.z<-3.7),`snapped to ${p.x},${p.z}, inside the pocket`);
});
