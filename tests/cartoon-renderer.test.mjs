import test from 'node:test';
import assert from 'node:assert/strict';
import {captionPages,captionForTime,sceneAtTime,drawCartoonFrame,CARTOON_SCENES,videoMime,safeMediaFilename,finaliseCartoonVideo} from '../src/studio/media/cartoon-renderer.js';
function context(){const commands=[];return new Proxy({commands,measureText:text=>({width:text.length*14})},{get:(o,p)=>p in o?o[p]:(...args)=>commands.push([p,...args]),set:(o,p,v)=>{commands.push(['set',p,v]);o[p]=v;return true}})}
const base={id:'s1',speaker:'guide',scene:'observatory',action:'talk',text:'A half and two quarters describe the same portion of one whole.',sourceRefs:['source-1']};
test('all four settings render deterministically with original presenters and no external assets',()=>{
 const scenes=new Set();for(const scene of Object.keys(CARTOON_SCENES)){const a=context(),b=context(),options={segment:{...base,scene},elapsed:2,duration:10,playing:true};const r=drawCartoonFrame(a,options);drawCartoonFrame(b,options);assert.deepEqual(a.commands,b.commands);assert(a.commands.length>300);assert(!a.commands.some(c=>c[0]==='drawImage'));assert(a.commands.some(c=>c[0]==='fillText'&&c[1]==='Mira'));scenes.add(JSON.stringify(a.commands));assert.equal(r.scene,scene);}assert.equal(scenes.size,4);
});
test('unknown scenes, speakers and actions fail closed without drawing invented media',()=>{
 for(const bad of [{scene:'laboratory'}, {speaker:'celebrity'}, {action:'attack'}]){const c=context();assert.throws(()=>drawCartoonFrame(c,{segment:{...base,...bad}}));assert.equal(c.commands.length,0)}
});
test('caption pagination preserves full source text, word boundaries and long tokens',()=>{
 const original='First claim. '+Array.from({length:60},(_,i)=>'word'+i).join(' ')+' '+ 'x'.repeat(130)+' final claim.';
 const pages=captionPages(original,t=>t.length*10,200,3);assert(pages.length>5);assert(pages.every(p=>p.length<=3&&p.every(l=>l.length<=20)));assert.equal(pages.flat().join(' ').replace(/\s/g,''),original.replace(/\s/g,''));
 assert.equal(captionForTime(pages,0,60).page,0);assert.equal(captionForTime(pages,60,60).page,pages.length-1);
 const seen=new Set();for(let i=0;i<=600;i++)seen.add(captionForTime(pages,i/10,60).page);assert.equal(seen.size,pages.length);
});
test('caption bounds reject invalid input and never inject HTML',()=>{
 assert.throws(()=>captionPages('x'.repeat(4001),t=>t.length));assert.throws(()=>captionPages('x',t=>t.length,0));const c=context();drawCartoonFrame(c,{segment:{...base,text:'<script>not markup</script>'}});assert(c.commands.some(x=>x[0]==='fillText'&&x[1]==='<script>not markup</script>'));
});
test('caption page switching uses audio duration and scene offsets including inter-scene silence',()=>{
 assert.deepEqual(sceneAtTime([0,4.25,9.5],[4,5,2],0),{index:0,elapsed:0,duration:4});assert.deepEqual(sceneAtTime([0,4.25,9.5],[4,5,2],4.2),{index:0,elapsed:4,duration:4});assert.deepEqual(sceneAtTime([0,4.25,9.5],[4,5,2],4.25),{index:1,elapsed:0,duration:5});assert.equal(sceneAtTime([0,4.25,9.5],[4,5,2],100).index,2);assert.throws(()=>sceneAtTime([1,0],[2,2],0));assert.throws(()=>sceneAtTime([0],[0],0));
});
test('still artwork removes animation while captions continue and playing produces expressive changes',()=>{
 function art(t,still){const c=context();drawCartoonFrame(c,{segment:base,elapsed:t,duration:40,playing:true,reducedMotion:still});return c.commands.filter(x=>x[0]!=='fillRect'||x[2]!==708)}
 assert.deepEqual(art(2,true),art(3,true));assert.notDeepEqual(art(2,false),art(3,false));
 const think=context(),celebrate=context();drawCartoonFrame(think,{segment:{...base,action:'think'}});drawCartoonFrame(celebrate,{segment:{...base,action:'celebrate'}});assert.notDeepEqual(think.commands,celebrate.commands);
});
test('export only selects supported WebM and filenames cannot carry path components',()=>{
 assert.equal(videoMime(undefined),null);assert.equal(videoMime({isTypeSupported:type=>type==='video/webm;codecs=vp8,opus'}),'video/webm;codecs=vp8,opus');assert.equal(safeMediaFilename('../../<bad> Hello: world','webm'),'bad-Hello-world.webm');assert.equal(safeMediaFilename('', 'txt'),'mosaic-cartoon.txt');
});

test('recorded WebM receives finite duration without rewriting encoded audio or video',async()=>{
 const header=[0x1a,0x45,0xdf,0xa3,0x80],segment=[0x18,0x53,0x80,0x67,0x01,0xff,0xff,0xff,0xff,0xff,0xff,0xff],info=[0x15,0x49,0xa9,0x66,0x87,0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40],cluster=[0x1f,0x43,0xb6,0x75,0x84,1,2,3,4];
 const input=new Blob([new Uint8Array([...header,...segment,...info,...cluster])],{type:'video/webm'}),output=await finaliseCartoonVideo(input,21.431),bytes=new Uint8Array(await output.arrayBuffer());
 assert.equal(output.size,input.size+11);assert.equal(output.type,'video/webm');assert.deepEqual([...bytes.slice(-cluster.length)],cluster);const at=header.length+segment.length+info.length;assert.deepEqual([...bytes.slice(at,at+3)],[0x44,0x89,0x88]);assert.equal(new DataView(bytes.buffer).getFloat64(at+3,false),21431);
 const again=await finaliseCartoonVideo(output,10);assert.equal(again.size,output.size);assert.equal(new DataView(await again.arrayBuffer()).getFloat64(at+3,false),10000);
 await assert.rejects(()=>finaliseCartoonVideo(new Blob(['not a video']),2));await assert.rejects(()=>finaliseCartoonVideo(input,Infinity));await assert.rejects(()=>finaliseCartoonVideo(input,0));
});

test('pause preserves the rendered pose and fallback pupils face the direction of travel',()=>{
 const segment={...base,direction:{blocking:'travel-right',shot:'wide',pace:'calm'}},a=context(),b=context();
 drawCartoonFrame(a,{segment,elapsed:3,duration:12,playing:true});drawCartoonFrame(b,{segment,elapsed:3,duration:12,playing:false});assert.deepEqual(a.commands,b.commands);
 function gaze(commands){let m=[1,0,0,1,0,0],stack=[],eyes=[],pupils=[];const multiply=n=>{const [a,b,c,d,e,f]=m,[A,B,C,D,E,F]=n;m=[a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f]};for(const [op,...v] of commands){if(op==='save')stack.push([...m]);if(op==='restore')m=stack.pop();if(op==='setTransform')m=v;if(op==='translate')multiply([1,0,0,1,...v]);if(op==='scale')multiply([v[0],0,0,v[1],0,0]);if(op==='rotate'){const s=Math.sin(v[0]),c=Math.cos(v[0]);multiply([c,s,-s,c,0,0])}if(op==='ellipse'){const x=m[0]*v[0]+m[2]*v[1]+m[4];if(v[2]===9&&v[3]===12)eyes.push(x);if(v[2]===4.2&&v[3]===6.5)pupils.push(x)}}assert.equal(eyes.length,4);return pupils.map((x,i)=>Math.sign(x-eyes[i]))}
 assert.deepEqual(gaze(a.commands),[1,1,1,1]);
 const left=context();drawCartoonFrame(left,{segment:{...segment,direction:{...segment.direction,blocking:'travel-left'}},elapsed:3,duration:12,playing:true});assert.deepEqual(gaze(left.commands),[-1,-1,-1,-1]);
 const rest=context();drawCartoonFrame(rest,{segment:{...segment,direction:{...segment.direction,blocking:'face-off'}},elapsed:6,duration:12,playing:true});assert.deepEqual(gaze(rest.commands),[1,1,-1,-1]);
});
