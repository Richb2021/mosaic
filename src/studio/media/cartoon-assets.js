import {drawViseme} from './cartoon-mouth.js';
// Original Mosaic cutout artwork. Authored shapes, not generated facts or geometry.
export const CARTOON_SCENES = Object.freeze({
 observatory:{label:'The observatory',sky:'#344b78',floor:'#a0a5c0',accent:'#f5cf77'},
 workshop:{label:'The invention room',sky:'#d6e4ef',floor:'#aeb8b4',accent:'#f3bb63'},
 garden:{label:'The glass garden',sky:'#badcde',floor:'#a8bd86',accent:'#f7cb76'},
 city:{label:'The riverside',sky:'#cbd8ef',floor:'#b6acb6',accent:'#dd875f'},
});
export const CARTOON_CAST=Object.freeze({guide:{name:'Mira',skin:'#bd7b60',hair:'#243c4d',coat:'#547995',shirt:'#e9d9b3',accent:'#efbd67'},learner:{name:'Kit',skin:'#e6ad88',hair:'#73504c',coat:'#db9c54',shirt:'#527b87',accent:'#adc4d3'}});
const ink='#253b51';
function path(c,points,fill,stroke=ink,width=3){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke()}}
function rect(c,x,y,w,h,fill,stroke=null,width=3){c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.strokeRect(x,y,w,h)}}
function oval(c,x,y,rx,ry,fill,stroke=null,width=3){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}}
function line(c,x,y,x2,y2,color=ink,width=3){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke()}
function arch(c,x,y,w,h,fill,stroke=ink){c.beginPath();c.moveTo(x,y+h);c.lineTo(x,y+w/2);c.bezierCurveTo(x,y-w*.17,x+w,y-w*.17,x+w,y+w/2);c.lineTo(x+w,y+h);c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=4;c.stroke()}
function plant(c,x,y,s=1,fill='#567d70'){c.save();c.translate(x,y);c.scale(s,s);line(c,0,5,0,-75,'#446d5b',5);for(let i=0;i<5;i++){const side=i%2?-1:1;c.save();c.translate(side*12,-15-i*13);c.rotate(side*.55);oval(c,0,0,17,8,fill);c.restore()}path(c,[[-22,0],[22,0],[16,32],[-16,32]],'#bc8a6d',null);line(c,-23,1,23,1,'#e0b38d',6);c.restore()}
function book(c,x,y,w,h,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);rect(c,0,0,w,h,color,ink,2);rect(c,4,4,3,h-8,'#ffffff55');line(c,8,12,w-5,12,'#fff1cf',2);line(c,8,h-12,w-5,h-12,'#fff1cf',2);c.restore()}
function clouds(c,color){for(const [x,y,s] of [[110,80,1],[820,64,.8],[1150,145,.7]]){oval(c,x,y,90*s,22*s,color);oval(c,x-20*s,y-16*s,45*s,25*s,color);oval(c,x+32*s,y-13*s,35*s,21*s,color)}}
function observatory(c){
 rect(c,0,0,1280,540,'#777e9e');arch(c,335,20,610,420,'#2c416b','#303f61');
 for(let i=0;i<43;i++){const x=360+(i*137)%550,y=55+(i*59)%320;oval(c,x,y,i%3===0?2.6:1.4,i%3===0?2.6:1.4,'#d9e5ec')}
 oval(c,760,138,49,49,'#f1dcb1');oval(c,780,119,42,43,'#2c416b');
 for(let i=1;i<4;i++)line(c,335+i*152,35,335+i*152,440,'#9194ae',9);line(c,335,250,945,250,'#9194ae',8);
 rect(c,325,440,630,22,'#d1c3b6','#404b65');rect(c,0,456,1280,84,'#a4a2b5');
 for(const x of [80,1050]){rect(c,x,80,150,350,'#4b5774',ink);rect(c,x+10,100,130,310,'#67738d');for(let j=0;j<3;j++){for(let k=0;k<5;k++)book(c,x+18+k*22,120+j*92,17,60-((k+j)%3)*7,['#bc8b74','#b8b89a','#96afb5'][k%3]);rect(c,x+10,183+j*92,130,9,'#b6aa9b')}}
 // An ornamental telescope, not a diagram of the topic.
 c.save();c.translate(633,320);c.rotate(-.38);rect(c,-105,-23,210,46,'#bd986a',ink);rect(c,83,-32,25,64,'#34475f',ink);rect(c,-112,-28,20,56,'#e1c194',ink);c.restore();line(c,650,340,600,470,ink,8);line(c,650,340,700,470,ink,8);line(c,650,340,650,470,ink,6);
 plant(c,210,428,.8,'#6a9890');plant(c,1090,430,.8,'#819f85');
}
function workshop(c){
 rect(c,0,0,1280,540,'#dfdfcc');rect(c,0,0,1280,38,'#485768');rect(c,80,55,210,256,'#eef0db',ink);rect(c,93,68,184,230,'#b5d7e3');c.save();c.beginPath();c.rect(93,68,184,230);c.clip();clouds(c,'#e0ebed');c.restore();for(const x of [80,290,1030,1220])rect(c,x,0,15,455,'#81938e');
 rect(c,345,80,585,266,'#6b8986',ink);rect(c,361,96,553,234,'#aac1ab');
 // Tool silhouettes. They have no implied scientific labels.
 for(let i=0;i<8;i++){const x=393+i*67;line(c,x,132,x,215,'#d2a269',10);oval(c,x,126,13,20,'#5c6e70',ink,2);oval(c,x,125,5,10,'#aac1ab');}
 rect(c,330,341,640,32,'#bb8f69',ink);rect(c,355,373,22,130,'#73847b',ink);rect(c,924,373,22,130,'#73847b',ink);rect(c,380,385,220,72,'#b3b8a1',ink);line(c,386,421,594,421,'#879580');oval(c,489,404,4,4,ink);oval(c,489,440,4,4,ink);
 rect(c,0,475,1280,65,'#a9b6ad');for(let i=0;i<6;i++)line(c,0,480+i*12,1280,480+i*12,'#96a89f',1);
 book(c,620,292,28,49,'#ba7768',-.1);book(c,654,279,30,62,'#789ba9',.05);plant(c,824,314,1,'#578879');
 rect(c,1045,355,120,110,'#9a9d80',ink);plant(c,1105,345,1.4,'#657f6c');line(c,190,65,190,299,'#6e8c91',5);line(c,94,180,278,180,'#6e8c91',5);
}
function garden(c){
 rect(c,0,0,1280,540,'#badcde');clouds(c,'#e4ece3');oval(c,1080,76,47,47,'#f3e2a9');
 path(c,[[0,275],[160,170],[320,250],[460,160],[680,295],[930,180],[1160,260],[1280,210],[1280,500],[0,500]],'#83aaa3',null);
 path(c,[[0,340],[150,280],[360,335],[620,247],[880,325],[1100,270],[1280,345],[1280,540],[0,540]],'#719a83',null);
 arch(c,305,85,650,360,'#d9eee377','#598982');for(let i=1;i<5;i++)line(c,305+i*130,120,305+i*130,445,'#6c9d92',5);line(c,305,276,955,276,'#6c9d92',5);
 rect(c,0,439,1280,101,'#a8bd86');path(c,[[540,440],[730,440],[910,540],[370,540]],'#d1c6a1',null);
 for(const [x,y,s] of [[110,400,2],[220,417,1.5],[1045,413,1.8],[1190,408,2.1],[725,419,1.2]])plant(c,x,y,s,['#527e5c','#658e6c'][x%2]);
 rect(c,440,379,390,22,'#bc9c77',ink);rect(c,463,402,15,60,'#8a8a70');rect(c,790,402,15,60,'#8a8a70');
 for(let i=0;i<3;i++){plant(c,510+i*115,373,.75,'#6b8a5b');oval(c,510+i*115,319,9,9,'#f0c474');}
 for(let i=0;i<12;i++){const x=30+i*107,y=482+(i%3)*16;line(c,x,y,x+8,y-15,'#759764',3);line(c,x+5,y-9,x+15,y-12,'#759764',3)}
}
function city(c){
 rect(c,0,0,1280,540,'#cbd8ef');clouds(c,'#e9e9ed');
 // Distant silhouettes and closer terraced buildings frame an explorable world.
 for(let i=0;i<11;i++){const x=i*130,y=134+(i%4)*23;rect(c,x,y,118,225,'#9faec5');path(c,[[x-6,y],[x+59,y-35],[x+124,y]],'#8396b1',null)}
 for(const [x,w,color] of [[-30,290,'#c9a18e'],[1020,290,'#a5adb1']]){rect(c,x,83,w,378,color,ink);path(c,[[x-20,83],[x+65,13],[x+w-38,13],[x+w+20,83]],'#596b82',ink);for(let row=0;row<2;row++)for(let col=0;col<3;col++){const xx=x+30+col*83,yy=114+row*118;arch(c,xx,yy,48,87,'#627e96');line(c,xx+24,yy+6,xx+24,yy+87,'#d2cfbb',3);line(c,xx,yy+44,xx+48,yy+44,'#d2cfbb',3)}rect(c,x+19,355,w-38,18,'#e1cda8');}
 rect(c,260,299,760,165,'#849ca8');for(let i=0;i<7;i++){line(c,265,320+i*19,1018,320+i*19,'#b0c4c9',3)}
 path(c,[[310,430],[421,282],[859,282],[970,430]],'#c7b9a5',ink);path(c,[[475,427],[513,346],[767,346],[805,427]],'#849ca8',ink);
 for(let i=0;i<12;i++)line(c,340+i*53,304,340+i*53,344,'#7b817f',7);line(c,335,300,944,300,'#e4d8bd',12);
 rect(c,0,446,1280,94,'#b6acb6');for(let row=0;row<4;row++)for(let col=0;col<14;col++){const x=col*105+(row%2)*50;line(c,x,451+row*24,x+88,451+row*24,'#9d96a5',2);line(c,x,451+row*24,x,467+row*24,'#9d96a5',2)}
 for(const x of [295,986]){line(c,x,217,x,465,'#485a70',7);rect(c,x-18,181,36,48,'#e7c688',ink);path(c,[[x-24,181],[x,164],[x+24,181]],'#485a70',ink);}
 plant(c,163,422,1.2,'#5c837d');plant(c,1117,422,1.2,'#5c837d');
}
export function drawBackground(c,scene){if(!CARTOON_SCENES[scene])throw Error('Choose an available cartoon setting.');({observatory,workshop,garden,city}[scene])(c);}
function arm(c,x,y,angle,color,skin,extension=1){c.save();c.translate(x,y);c.rotate(angle);c.scale(1,extension);path(c,[[-10,0],[17,2],[21,58],[-11,65]],color,ink,3);oval(c,6,68,14,15,skin,ink,3);line(c,14,63,18,66,'#a86d58',2);c.restore()}
export function drawCharacter(c,{speaker,x,y,scale=1,active=false,action='talk',time=0,moving=true,mouth='X',motion='idle'}){
 const p=CARTOON_CAST[speaker];if(!p)throw Error('Choose an available cartoon speaker.');
 const t=moving?time:0,talk=active&&moving,wiggle=talk?Math.sin(t*5)*.022:0,bob=talk?Math.sin(t*3)*2:0;
 c.save();c.translate(x,y);c.scale(scale,scale);oval(c,0,4,74,12,'#253b5124');
 const phase=Math.sin(Math.min(1,t/2)*Math.PI),lift=bob+(motion==='jump'?-phase*40:0),squash=motion==='pickup'?1-phase*.35:1;
 c.save();c.translate(0,lift);c.rotate(wiggle);c.scale(1,squash);
 // Shoes, trousers, shaped jacket and open book / notebook silhouette.
 for(const side of [-1,1]){const stride=['walk','run'].includes(motion)?Math.sin(t*(motion==='run'?10:6))*side*.45:motion==='kick'&&side===1?-phase*1.15*(speaker==='guide'?1:-1):0;c.save();c.translate(side*21,-98);c.rotate(stride);path(c,[[-16,0],[16,0],[18,86],[-16,86]],'#334f68');oval(c,0,90,24,11,'#294252',ink);line(c,-17,95,17,95,'#b6c4c7',3);c.restore();}
 path(c,[[-40,-191],[39,-191],[53,-91],[-50,-91]],p.coat,ink,4);path(c,[[-15,-188],[15,-188],[24,-95],[-22,-95]],p.shirt,null);line(c,-23,-178,-32,-100,'#ffffff55',2);
 const extension=motion==='pickup'?1+phase*1.55:1;
 const gesture=motion==='pickup'?0:motion==='reach'?-.95:action==='celebrate'?-2.5:action==='think'?2.2:active?-.65+Math.sin(t*2)*.12:.2;
 arm(c,-43,-181,.12,p.coat,p.skin);if(action!=='think')arm(c,44,-181,gesture,p.coat,p.skin,extension);
 if(speaker==='guide'){path(c,[[-13,-187],[30,-180],[24,-157],[-10,-163]],p.accent,ink,2);path(c,[[19,-169],[32,-167],[25,-125],[12,-130]],p.accent,ink,2);}
 else{line(c,-15,-178,-10,-151,p.accent,3);line(c,16,-178,11,-151,p.accent,3);}
 oval(c,0,-196,17,21,p.skin,ink);oval(c,-57,-243,13,20,p.skin,ink);oval(c,57,-243,13,20,p.skin,ink);
 // Distinct hair silhouettes and faces; gaze follows the other presenter.
 if(speaker==='guide'){oval(c,-3,-268,66,74,p.hair,ink);path(c,[[-66,-267],[-69,-200],[-42,-215],[-31,-287]],p.hair,ink);path(c,[[48,-290],[65,-265],[67,-207],[42,-215]],p.hair,ink)}
 oval(c,0,-254,56,64,p.skin,ink,3);
 if(speaker==='guide'){path(c,[[-56,-273],[-52,-298],[-27,-323],[11,-326],[50,-306],[58,-279],[23,-287],[2,-302],[-22,-283]],p.hair,ink,3);line(c,-33,-305,-13,-316,'#46616b',4);}
 else{for(let i=0;i<9;i++){const a=Math.PI+(i/8)*Math.PI,x=Math.cos(a)*51,y=-275+Math.sin(a)*37;oval(c,x,y,21,22,p.hair,ink,2)}oval(c,43,-286,25,20,p.hair,ink,2);}
 const gaze=speaker==='guide'?4:-4,blink=moving&&Math.floor(time*10)%51===0;
 if(blink){line(c,-33,-252,-15,-250,ink,3);line(c,13,-250,31,-252,ink,3)}else{oval(c,-23,-253,9,12,'#f8eedb');oval(c,23,-253,9,12,'#f8eedb');oval(c,-23+gaze,-252,4.2,6.5,ink);oval(c,23+gaze,-252,4.2,6.5,ink)}
 const raised=action==='think'?5:action==='celebrate'?7:active?3:0;
 line(c,-35,-272-raised,-15,-276-raised,p.hair,4);line(c,14,-276-raised,34,-272-raised,p.hair,4);
 c.beginPath();c.moveTo(0,-249);c.lineTo(-4,-236);c.quadraticCurveTo(0,-233,6,-237);c.strokeStyle='#9e6357';c.lineWidth=2.5;c.stroke();
 drawViseme(c,{x:1,y:-218,width:24,shape:mouth,paper:true});
 oval(c,-39,-233,10,5,'#dc927744');oval(c,39,-233,10,5,'#dc927744');
 if(speaker==='guide'){oval(c,-58,-225,5,5,p.accent);oval(c,58,-225,5,5,p.accent);}
 else{rect(c,-39,-130,36,29,'#5b8394',ink,2);line(c,-33,-122,-10,-122,'#c5e0dc',2);line(c,-33,-115,-18,-115,'#c5e0dc',2);}
 if(action==='think')arm(c,44,-181,gesture,p.coat,p.skin,extension);
 const hx=44+6*Math.cos(gesture)-68*extension*Math.sin(gesture),hy=(-181+6*Math.sin(gesture)+68*extension*Math.cos(gesture))*squash;
 c.restore();c.restore();return {hand:{x:x+scale*(hx*Math.cos(wiggle)-hy*Math.sin(wiggle)),y:y+scale*(hx*Math.sin(wiggle)+hy*Math.cos(wiggle)+lift)}};
}
