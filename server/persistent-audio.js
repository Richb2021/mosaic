import {digest} from './content-service.js';
import {SPEECH_MODEL,speechConfiguration} from './media-audio.js';
import {need,sqlDB,readControls,parse,DAY} from './data-control.js';

export const AUDIO_RECIPE='mp3-44100-128-normalize0-speed1-temp05-top07-v1';
export async function persistentAudio({env,siteOwner,owner,j,draft,index,requestKey,requestHash,reserve,speech,now}){
 need(env.BUCKET,'Private audio storage is not connected. No narration request was sent.',503);
 const db=sqlDB(env.DB),hash=await digest(j.draft),segment=draft.segments[index];
 const voice=segment.speaker==='guide'?env.FISH_AUDIO_GUIDE_VOICE:env.FISH_AUDIO_LEARNER_VOICE;
 const id=await digest(JSON.stringify({siteOwner,owner,script:j.id,hash,index,voice,model:SPEECH_MODEL,recipe:AUDIO_RECIPE})),objectKey='narration/'+id+'.mp3';
 let previous=await db.one('SELECT * FROM media_assets WHERE id=?',id);
 if(previous?.status==='pending'&&now()-previous.updated>60000){const recovered=await env.BUCKET.head(objectKey);if(recovered){await db.run('UPDATE media_assets SET status=?,bytes=?,updated=? WHERE id=? AND status=?','ready',recovered.size,now(),id,'pending');previous={...previous,status:'ready'};}}
 const priorRequest=await db.one('SELECT request_hash FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);need(!priorRequest||priorRequest.request_hash===requestHash,'This narration identity belongs to different input.',409);
 if(previous?.status==='pending'&&now()-previous.updated>5*60000){await db.run('UPDATE media_assets SET status=? WHERE id=? AND status=?','failed',id,'pending');previous={...previous,status:'failed'};}
 if(previous?.status==='ready'){
  const {controls}=await readControls(env,siteOwner,owner,now()),days=parse(controls.learner.policy).mediaDays||0;
  if(days&&previous.created+days*DAY<=now())throw Object.assign(Error('This recording reached its retention limit. Open Your data to clear expired media before explicitly generating another recording.'),{status:410});
  const cached=await env.BUCKET.get(objectKey);
  if(cached)return new Response(cached.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Mosaic-Audio':'stored','X-Mosaic-Media-Id':id}});
  // Missing bytes are not permission to charge again silently.
  throw Object.assign(Error('This saved recording is unavailable. Delete its saved audio in Your data before requesting another recording.'),{status:409});
 }
 const previousRequest=await db.one('SELECT id FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);
 need(!previousRequest,'This narration request was already submitted. No repeat was sent.',409);
 need(!previous,'This recording is already being prepared or needs attention. No duplicate narration was sent. Open Your data to clear a failed recording before retrying.',409);
 need(speechConfiguration(env),'Narration is not connected. Saved recordings and transcripts remain available.',503);
 const inserted=await db.run('INSERT OR IGNORE INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)',id,siteOwner,owner,j.id,hash,index,objectKey,'pending',now(),now());
 need(inserted.meta.changes===1,'This recording is being prepared in another window. Try playback again after it finishes.',409);
 let audio;
 try{
  audio=await reserve({id:'audio-'+crypto.randomUUID(),recordType:'creative-audio',learnerOwner:owner,packId:parse(j.payload).packId,contentHash:parse(j.payload).contentHash,scriptId:j.id,index,mediaId:id},requestKey,requestHash,'audio-starting');
  const rendered=await speech(segment,env);
  // Deletion and policy changes hold the same workspace/learner guard as this request.
  await env.BUCKET.put(objectKey,rendered.bytes,{httpMetadata:{contentType:'audio/mpeg'},customMetadata:{scriptHash:hash,recipe:AUDIO_RECIPE}});
  const saved=await db.run('UPDATE media_assets SET status=?,bytes=?,updated=? WHERE id=? AND status=?','ready',rendered.bytes.byteLength,now(),id,'pending');
  need(saved.meta.changes===1,'The recording changed while saving. No repeat request was sent.',409);
  await db.run('UPDATE workshop_jobs SET status=?,updated=? WHERE id=? AND owner=?','audio-complete',now(),audio.id,siteOwner);
  return new Response(rendered.bytes,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Mosaic-Audio':'generated-and-saved','X-Mosaic-Media-Id':id}});
 }catch(e){
  // If R2 succeeded but the metadata acknowledgement was lost, recover bytes
  // without generating again on a later request.
  const object=await env.BUCKET.head(objectKey).catch(()=>null);
  if(object)await db.run('UPDATE media_assets SET status=?,bytes=?,updated=? WHERE id=?','ready',object.size,now(),id);
  else if(!audio)await db.run('DELETE FROM media_assets WHERE id=? AND status=?',id,'pending');
  else await db.run('UPDATE media_assets SET status=?,updated=? WHERE id=?','failed',now(),id);
  if(audio)await db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=?',object?'audio-complete':'audio-failed',object?null:'Narration did not finish; no automatic retry was sent.',now(),audio.id,siteOwner);
  throw e;
 }
}
