import {draftHash} from './game-modes/draft-engine.js';

// A programme link selects an exact chapter, including for signed-out learners.
// An unavailable link must never quietly start an unrelated adventure.
// Problems with the link itself (incomplete, not shared, changed) are marked so the game shows just the message.
const linkError=m=>Object.assign(Error(m),{chapterLink:true});
export async function resolveAdventureLink(search, included, fetchSaved) {
 const q=new URLSearchParams(search),id=q.get('rpg'),hash=q.get('hash');
 if(!id&&!hash)return null;
 if(!id||!hash)throw linkError('This adventure link is incomplete. Return to your learning programme.');
 const exact=included.find(b=>b.id===id&&draftHash(b)===hash);
 if(exact)return exact;
 if(!fetchSaved)throw linkError('Sign in to open this saved chapter, or return to your learning programme.');
 // A refusal means the chapter isn't shared with this person (or has changed); network errors keep their own message.
 let result;try{result=await fetchSaved(id,hash)}catch(e){if([403,404,422].includes(e?.status))throw linkError('This chapter isn’t available to you. It may not have been shared with you yet, or it has changed since. Ask whoever shared it, or return to your learning programme.');throw e}
 const bundle=result?.content;
 if(!bundle||bundle.id!==id||draftHash(bundle)!==hash)throw linkError('This exact chapter is unavailable. Return to your learning programme.');
 return bundle;
}
