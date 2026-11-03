import test from 'node:test';import assert from 'node:assert/strict';import {D1} from './helpers/media-storage.mjs';
import {deletionPlan} from '../server/data-lifecycle.js';
import {collectionsAPI} from '../server/knowledge-collections.js';import {sqlDB} from '../server/data-control.js';import {extractResource} from '../server/content-service.js';
const manager='a'.repeat(64),learner='b'.repeat(64),stranger='c'.repeat(64);
test('collections require exact reviewed owned sources, explicit group recipients and membership bindings; withdrawal and revisions fail closed',async()=>{
 const env={DB:new D1(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:manager},db=sqlDB(env.DB);
 await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+learner,JSON.stringify({status:'active',manager,role:'learner',invite:'one'}),1);
 const r=await extractResource({title:'A source',text:'A fraction compares an equal part with its whole. Two quarters of the same whole have the same amount as one half.'});await db.run('INSERT INTO workshop_resources VALUES(?,?,?,?,?,?,?)','resource-a','personal:'+manager,r.title,r.checksum,JSON.stringify(r),'reviewed',1);
 const call=async(input,who=manager,post=true)=>{const request=new Request('https://test/api/learning/collections'+(!post?'?'+new URLSearchParams(input):''),{method:post?'POST':'GET',body:post?JSON.stringify(input):undefined});return (await collectionsAPI(request,env,{owner:who,principal:who,siteOwner:'personal:'+who,access:{role:who===manager?'administrator':'learner',admitted:true,canAuthor:who===manager,ageBand:'18plus'}})).json()};
 const body={action:'save',title:'Fractions collection',description:'Reviewed examples',sources:[{id:'resource-a',checksum:r.checksum}],readers:[learner],sharingConfirmed:true};
 await assert.rejects(()=>call({...body,readers:[stranger]}),/active members/);await assert.rejects(()=>call({...body,sharingConfirmed:false}),/Confirm permission/);
 const saved=await call(body);const plan=await deletionPlan(env,{owner:manager,siteOwner:'personal:'+manager,store:{allRows:async()=>[]},mode:'learner'});assert.equal(plan.collectionUpdates.length,0,'Personal progress deletion preserves curated workspace collections');assert.equal((await call({id:saved.id,sourceId:'resource-a'},learner,false)).collection.sources[0].units[0].excerpt,r.units[0].excerpt);
 await assert.rejects(()=>call({id:saved.id},stranger,false),/unavailable/);await assert.rejects(()=>call({...body,id:saved.id,revision:'stale'}),/changed/);
 const changed=await call({...body,id:saved.id,revision:saved.revision,readers:[]});await assert.rejects(()=>call({id:saved.id},learner,false),/unavailable/);
 await call({...body,id:saved.id,revision:changed.revision});await db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({status:'active',manager,role:'learner',invite:'replacement'}),'pilot-member:'+learner);
 await assert.rejects(()=>call({id:saved.id},learner,false),/unavailable/);
});
